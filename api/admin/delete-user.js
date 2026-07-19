// api/admin/delete-user.js
// Serverless function (Vercel) that hard-deletes an auth user (and, by cascade,
// their profiles row). Placing this at /api/admin/delete-user (project root,
// sibling to src/) ensures Vercel deploys it as a function.
//
// Environment (server-only, NOT the VITE_* frontend vars):
//   SUPABASE_URL                 e.g. https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    service-role key (secret, bypasses RLS)
//   SUPABASE_ANON_KEY            anon/public key (verifies the caller's session)
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;
const supabaseAnon = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

async function getCallerProfile(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!supabaseAnon) return null;
  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("id", data.user.id)
    .single();
  return profile || null;
}

export default async function handler(req, res) {
  if (!supabaseAdmin || !supabaseAnon) {
    return res.status(500).json({
      error:
        "Server misconfiguration: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY are not set for this serverless function.",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Only admins / HR staff may delete users.
  const caller = await getCallerProfile(req.headers.authorization);
  if (!caller || !["admin", "hr_staff"].includes(caller.role)) {
    return res.status(403).json({ error: "Forbidden: insufficient privileges to delete users" });
  }

  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  // Prevent an admin from deleting their own account (lockout guard).
  if (caller.id === userId) {
    return res.status(400).json({ error: "You cannot delete your own account." });
  }

  try {
    // Hard delete the auth user. profiles.id REFERENCES auth.users ON DELETE
    // CASCADE, so the profile row is removed too. Intern/supervisor rows that
    // reference profile_id are SET NULL (handled by their FKs), so callers must
    // delete those rows explicitly before/after this call as needed.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId, true);
    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(400).json({ error: error.message || "Failed to delete user" });
  }
}
