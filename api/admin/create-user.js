// api/admin/create-user.js
// NOTE: This file MUST live in an /api folder at the PROJECT ROOT (sibling to
// src/, package.json) so Vercel deploys it as a serverless function. Files under
// src/api/ are bundled into the frontend and will NOT be deployed as functions.
//
// Environment variables for the SERVERLESS function (set in the Vercel project
// dashboard under Settings > Environment Variables). These are NOT the VITE_*
// vars — Vite inlines VITE_* vars into the browser bundle at build time and they
// are NOT available to serverless functions at runtime. Use these exact names:
//   SUPABASE_URL                 e.g. https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    service-role key (server-side only, secret)
//   SUPABASE_ANON_KEY            anon/public key (used to verify the caller)
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // Surface a clear, actionable error instead of a cryptic "Invalid supabaseUrl".
  // eslint-disable-next-line no-console
  console.error(
    "[create-user] Missing server env vars. Set SUPABASE_URL and " +
      "SUPABASE_SERVICE_ROLE_KEY in the Vercel project (Settings > Environment Variables). " +
      "These are NOT the VITE_* vars used by the frontend.",
  );
}

// Service-role client: bypasses RLS for the actual user creation.
const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Anon client: used ONLY to verify the *caller's* identity from their
// session JWT before we touch anything with the service role.
const supabaseAnon = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/**
 * Resolve the caller's role from their session token.
 * Returns the profile row (with role) or null if unauthenticated/invalid.
 */
async function getCallerProfile(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!supabaseAnon) return null; // mis-configured: fail open is unsafe, so we treat as unauthenticated
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
  // Fail fast with a clear message if the function is mis-configured.
  if (!supabaseAdmin || !supabaseAnon) {
    return res.status(500).json({
      error:
        "Server misconfiguration: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY are not set for this serverless function. Set them in the Vercel project dashboard (they are not the VITE_* frontend vars).",
    });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // --- RBAC: HR Admin / HR Staff may create any user. Supervisors may create
  //     interns (their own assigned interns). Interns cannot create users. ----
  const caller = await getCallerProfile(req.headers.authorization);
  const allowedRoles = ["admin", "hr_staff", "supervisor"];
  const allowed = caller && allowedRoles.includes(caller.role);
  if (!allowed) {
    return res.status(403).json({ error: "Forbidden: insufficient privileges to create users" });
  }
  // Supervisors are restricted to creating interns only.
  if (caller.role === "supervisor" && user_metadata?.role && user_metadata.role !== "intern") {
    return res.status(403).json({ error: "Forbidden: supervisors can only create intern accounts" });
  }

  const { email, password, user_metadata } = req.body;

  // Validate required fields
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    // Create user using admin API
    const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: user_metadata?.full_name || "",
        role: user_metadata?.role || "intern",
      },
    });

    if (error) throw error;

    // Audit the admin action.
    try {
      await supabaseAdmin.from("audit_logs").insert({
        user_id: caller.id,
        action: "create",
        resource_type: "auth_user",
        resource_id: user.id,
        changes: { email, role: user_metadata?.role || "intern" },
      });
    } catch {
      /* non-fatal */
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
      },
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(400).json({
      error: error.message || "Failed to create user",
    });
  }
}
