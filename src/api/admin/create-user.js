// src/api/admin/create-user.js
import { createClient } from "@supabase/supabase-js";

/**
 * Backend API endpoint (Vercel/Node) that creates an auth user using the
 * Supabase Admin API (service_role). This MUST use the service-role key and is
 * never exposed to the browser. The frontend calls this route via fetch().
 *
 * Body: { email, password, user_metadata: { full_name, role } }
 * Response: { success: true, user: { id, email } } | { error: string }
 */

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password, user_metadata } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: user_metadata?.full_name || "",
        role: user_metadata?.role || "intern",
      },
    });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      user: { id: data.user.id, email: data.user.email },
    });
  } catch (err) {
    // Surface a friendly message for common Supabase auth errors.
    const message = err?.message || "Failed to create user";
    const status = /already registered|already been registered/i.test(message) ? 409 : 400;
    return res.status(status).json({ error: message });
  }
}
