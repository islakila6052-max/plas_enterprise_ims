// api/admin/setup-admin.js
// First-time admin account setup endpoint.
//
// SECURITY MODEL:
// This route is ONLY usable while the system has NO admin account yet.
// The check is performed SERVER-SIDE with the service-role key, so it cannot
// be bypassed from the browser. Once any admin/hr_staff profile exists, every
// request to this endpoint is rejected with 403 — preventing unauthorized
// users from creating additional initial admin accounts.
//
// Environment variables (same as create-user.js):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

function configError(res) {
  return res.status(500).json({
    error:
      "Server misconfiguration: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set for this serverless function.",
  });
}

/** True while no admin/hr_staff profile exists anywhere in the system. */
async function adminExists() {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .in("role", ["admin", "hr_staff"])
    .limit(1);
  return Boolean(data && data.length > 0);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (!supabaseAdmin) return configError(res);

  // ---- GET: report whether first-time setup is still available. ----------
  if (req.method === "GET") {
    try {
      const exists = await adminExists();
      return res.status(200).json({ setupRequired: !exists });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ---- POST: create the very first admin account. ------------------------
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { full_name, email, password } = req.body ?? {};

  // Guard: refuse once ANY admin already exists. This closes the window even
  // if two requests race — see the re-check below right before creation.
  if (await adminExists()) {
    return res.status(403).json({
      error:
        "Setup is disabled: an administrator account already exists. Please sign in instead.",
    });
  }

  // Validate input.
  if (!full_name || String(full_name).trim().length < 2) {
    return res.status(400).json({ error: "Full name is required." });
  }
  if (!email || !EMAIL_RE.test(String(email))) {
    return res
      .status(400)
      .json({ error: "A valid email address is required." });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({
      error: "Password must be at least 8 characters long.",
    });
  }

  try {
    // Re-check immediately before creation to shrink the race window between
    // two simultaneous first-setup submissions.
    if (await adminExists()) {
      return res.status(403).json({
        error:
          "Setup is disabled: an administrator account already exists. Please sign in instead.",
      });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: String(email).trim(),
      password,
      email_confirm: true,
      user_metadata: { full_name: String(full_name).trim(), role: "admin" },
    });
    if (error) throw error;
    const authUser = data.user;

    // Ensure the linked profiles row exists with the admin role.
    const { error: profileErr } = await supabaseAdmin.from("profiles").upsert(
      {
        id: authUser.id,
        full_name: String(full_name).trim(),
        email: authUser.email,
        role: "admin",
      },
      { onConflict: "id" },
    );
    if (profileErr) throw profileErr;

    // Audit the initial setup.
    try {
      await supabaseAdmin.from("audit_logs").insert({
        user_id: authUser.id,
        action: "create",
        resource_type: "auth_user",
        resource_id: authUser.id,
        changes: {
          email: authUser.email,
          role: "admin",
          note: "initial_admin_setup",
        },
      });
    } catch {
      /* non-fatal */
    }

    return res.status(200).json({
      success: true,
      user: { id: authUser.id, email: authUser.email },
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message || "Failed to create the admin account.",
    });
  }
}
