/** Banner shown when Supabase env vars are missing so the app still boots. */
export default function SetupBanner() {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-800">
      <strong className="font-semibold">Supabase not configured.</strong> Copy{" "}
      <code className="rounded bg-amber-100 px-1">.env.example</code> to{" "}
      <code className="rounded bg-amber-100 px-1">.env</code> and set{" "}
      <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_URL</code> and{" "}
      <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_ANON_KEY</code>.
    </div>
  );
}
