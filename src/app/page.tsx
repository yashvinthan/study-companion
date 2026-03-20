import Link from 'next/link';
import { ArrowRight, Brain, LockKeyhole, ShieldCheck, Timer, Zap, Paperclip } from 'lucide-react';
import Footer from '@/components/Footer';
import Header from '@/components/Header';

const features = [
  {
    title: 'Never Forget Again',
    description: 'Our AI remembers your past mistakes and structures your quizzes to target your weakest subjects automatically.',
    icon: Brain,
    bg: 'bg-[#fffff8]',
    text: 'text-slate-900',
    rotation: '-rotate-1',
    width: 'lg:col-span-2',
    style: 'lined',
    accent: 'bg-emerald-500'
  },
  {
    title: 'Private & Secure',
    description: 'Your study history, notes, and academic progress are securely stored and strictly tied to your account.',
    icon: LockKeyhole,
    bg: 'bg-indigo-100',
    text: 'text-slate-900',
    rotation: 'rotate-2',
    width: 'lg:col-span-1',
    style: 'sticky',
    accent: 'bg-indigo-500'
  },
  {
    title: 'Instant Study Plans',
    description: 'Tell us a topic, and instantly get a tailored revision timeline with actionable, step-by-step guidance.',
    icon: Zap,
    bg: 'bg-yellow-200',
    text: 'text-slate-900',
    rotation: '-rotate-1',
    width: 'lg:col-span-1',
    style: 'sticky',
    accent: 'bg-amber-500'
  },
  {
    title: 'Smart Exam Tracking',
    description: 'Log your real study sessions and exam dates to get smart reminders and realistic daily schedules.',
    icon: Timer,
    bg: 'bg-[#fffff8]',
    text: 'text-slate-900',
    rotation: 'rotate-1',
    width: 'lg:col-span-2',
    style: 'indexed',
    accent: 'bg-rose-500'
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#0d1117] text-[var(--color-text)] relative overflow-hidden">
      <Header />

      <main className="relative flex-1">
        {/* Infinite Desk Grid Paper Background */ }
        <div className="pointer-events-none absolute inset-0 z-0 opacity-40">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:40px_40px]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#0d1117_90%)]" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center space-y-16 text-center">
            
            {/* Header section with Tack/Label */}
            <section className="flex flex-col items-center space-y-6 max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-900/80 px-4 py-2 text-xs font-mono uppercase tracking-widest text-slate-300 backdrop-blur-sm shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
                <Paperclip className="h-3.5 w-3.5 text-slate-400 rotate-45" />
                Your AI Study Workspace
              </div>

              <div className="space-y-4">
                <h1 className="text-balance text-5xl font-extrabold tracking-tight text-white sm:text-7xl">
                  Focus on mastering. <br />
                  <span className="relative inline-block mt-2">
                    <span className="absolute inset-x-0 bottom-3 h-5 bg-emerald-400/30 -skew-x-12" />
                    <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-emerald-100 to-white">We'll handle the memory.</span>
                  </span>
                </h1>
                <p className="max-w-2xl mx-auto text-lg leading-8 text-slate-400 mt-6 font-medium">
                  An intelligent study companion that tracks your weak areas, builds custom revision plans, and ensures you never forget what you've learned.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                <Link
                  href="/login"
                  className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white px-8 py-4 font-bold text-slate-950 shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] active:translate-y-0"
                >
                  Enter Workspace
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/login"
                  className="group inline-flex items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-900 px-8 py-4 font-bold text-white shadow-xl transition-all hover:-translate-y-1 hover:border-slate-600 active:translate-y-0"
                >
                  Create Account
                </Link>
              </div>
            </section>

            {/* Feature Cards Grid (Analog Note Style) */}
            <section className="grid gap-6 w-full lg:grid-cols-3 pt-12 items-start text-left">
              {features.map((feature) => (
                <div key={feature.title} className={`relative group ${feature.width}`}>
                  {/* Outer lifting shadow representing floating depth */}
                  <div className="absolute inset-4 bg-black/60 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10" />

                  <div className={`relative z-20 h-full transform transition-all duration-300 ${feature.rotation} group-hover:rotate-0 group-hover:-translate-y-2 p-7 rounded-xl border border-black/10 ${feature.bg} ${feature.text} shadow-[8px_8px_20px_rgba(0,0,0,0.6)] group-hover:shadow-[16px_16px_30px_rgba(0,0,0,0.7)] overflow-hidden`}>
                    
                    {/* Top tape piece */}
                     {feature.style === 'sticky' && (
                       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-4 bg-white/20 border border-white/10 backdrop-blur-sm -rotate-3 z-30 shadow-sm" />
                     )}

                    {/* Lined Paper Details */}
                    {feature.style === 'lined' && (
                      <>
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.04)_1px,transparent_1px)] bg-[size:100%_32px] top-6 pointer-events-none" />
                        <div className="absolute left-8 top-0 bottom-0 w-px bg-red-400/40 pointer-events-none" />
                      </>
                    )}

                    <div className={`flex h-full flex-col justify-between gap-6 ${feature.style === 'lined' ? 'pl-6' : ''}`}>
                      
                      {/* Top Right index mark */}
                      <div className="absolute top-4 right-5 flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-black/20" />
                        <span className="h-1.5 w-1.5 rounded-full bg-black/20" />
                      </div>

                      <div className="space-y-4">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-black/5 text-slate-800 ring-1 ring-inset ring-black/10">
                          <feature.icon className="h-6 w-6" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-xl font-extrabold tracking-tight">{feature.title}</h3>
                          <p className="text-sm font-medium leading-relaxed opacity-80">{feature.description}</p>
                        </div>
                      </div>

                      <div className="mt-4 h-1 w-full bg-black/10 rounded-full overflow-hidden">
                        <div className={`h-full ${feature.accent} w-1/3 opacity-80 group-hover:w-full transition-all duration-1000 ease-out`} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
