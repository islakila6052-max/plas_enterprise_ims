// scripts/test_create_intern_user.mjs
// End-to-end check of the failing path: auth.admin.createUser fires
// on_auth_user_created -> handle_new_user -> ensure_role_rows, which previously
// broke on the renamed interns columns. Creates a temp user, verifies the
// auto-created intern row, then deletes the user.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const email = `__e2etest_${Date.now()}@example.com`;

console.log("Creating test intern user:", email);
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password: "TestPass!2026",
  email_confirm: true,
  user_metadata: { full_name: "E2E Test One", role: "intern" },
});
if (error) {
  console.error("CREATE FAILED:", error.message, error.code ?? "");
  process.exit(1);
}
console.log("Auth user created:", data.user.id);

const { data: intern, error: qErr } = await supabase
  .from("interns")
  .select("id, first_name, last_name, full_name, email, status")
  .eq("profile_id", data.user.id)
  .maybeSingle();
if (qErr) console.error("Query intern failed:", qErr.message);
console.log("Auto-created intern row:", intern ?? "(none)");

const del = await supabase.auth.admin.deleteUser(data.user.id);
console.log(del.error ? "CLEANUP FAILED: " + del.error.message : "Test user deleted.");
