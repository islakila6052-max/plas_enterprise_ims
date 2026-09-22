// src/services/announcementService.js
import { supabase } from "@/lib/supabase";

/**
 * Safely execute a Supabase query, returning null on network failure.
 * Used for non-critical queries that should not crash the UI.
 */
async function safeQuery(fn) {
  try {
    return await fn();
  } catch (err) {
    console.error("[IMS] Safe query failed:", err.message);
    return null;
  }
}

/**
 * True while the connected database is expected to have the
 * `announcement_likes` table (supabase/migrations/0043_announcement_likes.sql).
 * Starts optimistically and is downgraded the first time PostgREST reports the
 * table/relationship as missing, so the announcement list keeps working on
 * databases that predate the migration instead of failing with an opaque error.
 */
let likesAvailable = true;

/** PostgREST / Postgres codes raised when the likes table is not there yet. */
function isMissingLikesTable(error) {
  if (!error) return false;
  const code = error.code ?? "";
  return (
    code === "PGRST200" || // relationship not found in the schema cache
    code === "PGRST205" || // table not found in the schema cache
    code === "42P01" // undefined_table
  );
}

/**
 * Flatten the embedded `announcement_likes(count)` aggregate and merge the
 * viewer's own like state. Every row exposes `like_count` (number) and
 * `liked_by_me` (boolean) so components never have to guard for undefined.
 */
function shapeAnnouncement(row, likedIds) {
  const { announcement_likes: aggregate, ...rest } = row;
  const total = Array.isArray(aggregate) ? aggregate[0]?.count : aggregate?.count;
  return {
    ...rest,
    like_count: Number(total ?? 0),
    liked_by_me: likedIds ? likedIds.has(row.id) : false,
  };
}

/** Fresh total like count for one announcement (null when unreadable). */
async function countLikes(announcementId) {
  const { count, error } = await supabase
    .from("announcement_likes")
    .select("*", { count: "exact", head: true })
    .eq("announcement_id", announcementId);
  return error ? null : count ?? 0;
}

export const announcementService = {
  /**
   * Paginated announcement list.
   *
   * @param {Object}  options
   * @param {string}  [options.category]  Category filter.
   * @param {number}  [options.page]      1-based page number.
   * @param {number}  [options.pageSize]  Rows per page.
   * @param {string}  [options.userId]    Viewer id — used to resolve
   *                                      `liked_by_me` per row.
   * @returns {Promise<{data: Array, count: number, likesAvailable: boolean}>}
   */
  async list({ category, page = 1, pageSize = 20, userId = null } = {}) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const runQuery = () => {
      let query = supabase
        .from("announcements")
        .select(likesAvailable ? "*, announcement_likes(count)" : "*", {
          count: "exact",
        })
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (category) query = query.eq("category", category);
      return query;
    };

    let { data, error, count } = await runQuery();

    // Likes table not created yet (migration 0080 pending): fall back to the
    // plain list so announcements still render.
    if (error && likesAvailable && isMissingLikesTable(error)) {
      likesAvailable = false;
      ({ data, error, count } = await runQuery());
    }
    if (error) throw new Error(error.message);

    const rows = data ?? [];

    // Which of these announcements has the signed-in user already liked?
    let likedIds = null;
    if (userId && likesAvailable && rows.length > 0) {
      const { data: mine, error: mineError } = await supabase
        .from("announcement_likes")
        .select("announcement_id")
        .eq("user_id", userId)
        .in(
          "announcement_id",
          rows.map((r) => r.id),
        );
      if (!mineError) {
        likedIds = new Set((mine ?? []).map((r) => r.announcement_id));
      }
    }

    return {
      data: rows.map((row) => shapeAnnouncement(row, likedIds)),
      count: count ?? 0,
      likesAvailable,
    };
  },

  async create(payload) {
    const { data, error } = await supabase.from("announcements").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, payload) {
    const { data, error } = await supabase.from("announcements").update(payload).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    return data;
  },

  async remove(id) {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return;
  },

  /**
   * Like or unlike one announcement for the signed-in user.
   *
   * Safe against double-clicks, retries and multiple tabs: the intent is
   * re-read before it is applied and the DB's unique (announcement_id,
   * user_id) constraint turns a duplicate insert into a no-op.
   *
   * @returns {Promise<{liked: boolean, count: number|null}>} `count` is the
   *          fresh server-side total (null when it could not be read).
   */
  async toggleLike(announcementId, userId) {
    if (!announcementId || !userId) {
      throw new Error("Please sign in again to like this announcement.");
    }

    const { data: existing, error: findError } = await supabase
      .from("announcement_likes")
      .select("id")
      .eq("announcement_id", announcementId)
      .eq("user_id", userId)
      .maybeSingle();
    if (findError) throw new Error(findError.message);

    if (existing) {
      const { error } = await supabase
        .from("announcement_likes")
        .delete()
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { liked: false, count: await countLikes(announcementId) };
    }

    const { error } = await supabase
      .from("announcement_likes")
      .insert({ announcement_id: announcementId, user_id: userId });
    if (error) {
      // 23505 = unique_violation: a parallel tab or a fast double-click already
      // stored this like. That is the desired end state, so don't surface it.
      if (error.code === "23505") {
        return { liked: true, count: await countLikes(announcementId) };
      }
      throw new Error(error.message);
    }
    return { liked: true, count: await countLikes(announcementId) };
  },

  /** Whether like/unlike is supported by the connected database. */
  likesAvailable() {
    return likesAvailable;
  },

  /**
   * Fetch announcement count with graceful degradation.
   * Returns safe defaults on network failure.
   */
  async getStats() {
    const result = await safeQuery(() =>
      supabase.from("announcements").select("*", { count: "exact", head: true })
    );
    return { totalAnnouncements: result?.count ?? 0 };
  },
};
