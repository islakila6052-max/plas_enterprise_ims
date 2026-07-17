// src/components/ui/SetupBanner.jsx
/** Banner shown when Supabase env vars are missing. The app runs in demo
 *  mode with realistic sample data and an in-memory backend. */
export default function SetupBanner() {
  return (
    <div className="border-b border-brand-200 bg-brand-50 px-4 py-2.5 text-center text-sm text-brand-800">
      <strong className="font-semibold">Demo mode.</strong> Running with sample
      data — no backend required. To connect Supabase, copy{" "}
      <code className="rounded bg-brand-100 px-1">.env.example</code> to{" "}
      <code className="rounded bg-brand-100 px-1">.env</code> and set{" "}
      <code className="rounded bg-brand-100 px-1">VITE_SUPABASE_URL</code> and{" "}
      <code className="rounded bg-brand-100 px-1">VITE_SUPABASE_ANON_KEY</code>.
    </div>
  );
}
