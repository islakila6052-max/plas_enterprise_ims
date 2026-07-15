import Button from "@/components/Button";

const Home = () => {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <section className="w-full max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-sky-950/50 backdrop-blur">
        <div className="mb-4 inline-flex items-center rounded-full border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">
          Starter Ready
        </div>
        <h1 className="mb-3 text-4xl font-black tracking-tight sm:text-5xl">
          React + Vite is Working
        </h1>
        <p className="mb-6 text-lg text-slate-300">Tailwind CSS is Working</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button>Tailwind Utility Check</Button>
          <span className="rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300">
            bg-emerald-500/15 utility is rendering
          </span>
        </div>
      </section>
    </main>
  );
};

export default Home;
