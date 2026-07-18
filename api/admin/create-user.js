// api/admin/create-user.js
// NOTE: This file MUST live in an /api folder at the PROJECT ROOT (sibling to
// src/, package.json) so Vercel deploys it as a serverless function. Files under
// src/api/ are bundled into the frontend and will NOT be deployed as functions.
import { createClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS for the actual user creation.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Anon client: used ONLY to verify the *caller's* identity from their
// session JWT before we touch anything with the service role.
const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
);

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
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // --- RBAC: only HR Admin / HR Staff may create users -----------------------
  const caller = await getCallerProfile(req.headers.authorization);
  const allowed = caller && ["admin", "hr_staff"].includes(caller.role);
  if (!allowed) {
    return res.status(403).json({ error: "Forbidden: admin privileges required" });
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
