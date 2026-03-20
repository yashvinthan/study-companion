import Link from 'next/link';
import { BookOpen } from 'lucide-react';

export default function Header() {
  return (
    <header className="relative z-20 border-b border-slate-800/80 bg-[#0d1117]/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-400/30 group-hover:bg-emerald-500/20 transition-all">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="font-sans text-lg font-extrabold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
              Study<span className="text-emerald-400">Companion</span>
            </span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-1.5 text-xs font-bold text-slate-200 shadow-sm backdrop-blur-sm transition-all hover:bg-slate-800 hover:text-white"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
