export default function Loading() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#0d1117] font-mono">
      {/* Background Grid */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-4">
        {/* Animated highlighter or dot loader representing drawing loading states */}
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.3s]" />
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.15s]" />
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-400/80 animate-pulse">
          SYS::LOADING_WORKSPACE...
        </p>
      </div>
    </div>
  );
}
