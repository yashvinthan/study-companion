import { redirect } from 'next/navigation';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import LoginForm from '@/components/LoginForm';
import { getCurrentSession } from '@/lib/auth';
import { isGoogleOAuthConfigured } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Sign in to StudyTether to access your personalized study dashboard and plan.',
  robots: {
    index: false,
    follow: false,
  },
};

const securityNotes = [
  'Your study history and quiz scores are auto-saved.',
  'Your academic data is securely locked to your account.',
  'Smart notifications adapt to your real exams and goals.',
  'Easily track all your past mistakes for rapid revision.',
];

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session) {
    redirect('/app');
  }

  const googleEnabled = isGoogleOAuthConfigured();

  return (
    <div className="flex min-h-screen flex-col bg-[#0d1117] text-[#e2e8f0] relative overflow-hidden">
      <Header />

      <main className="relative flex flex-1 items-center px-4 py-10 sm:px-6 lg:px-8">
        {/* Infinite Desk Grid Paper Background */ }
        <div className="pointer-events-none absolute inset-0 z-0 opacity-40">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:40px_40px]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#0d1117_90%)]" />
        </div>

        <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-12 lg:grid-cols-[1fr_420px] lg:items-start">
          
          <section className="space-y-8 lg:pt-8 w-full max-w-lg mx-auto lg:mx-0">
            <LoginForm googleEnabled={googleEnabled} />
          </section>

          {/* Right Column: Floating Security Posture Notecard */}
          <section className="app-shell-panel hidden lg:block relative p-7 bg-[#fffff8] text-slate-900 border border-black/10 shadow-[8px_8px_20px_rgba(0,0,0,0.5)] transform rotate-1 rounded-xl">
            
            {/* Top tape piece */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-white/40 border border-black/5 backdrop-blur-sm -rotate-2 z-30 shadow-sm" />

            {/* Lined Paper Details inside card */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[size:100%_24px] top-6 pointer-events-none" />
            <div className="absolute left-6 top-0 bottom-0 w-px bg-red-400/30 pointer-events-none" />

            <div className="relative z-10 pl-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/5 text-slate-800 ring-1 ring-inset ring-black/10">
                  <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Student Workspace</p>
                  <h2 className="text-xl font-extrabold text-slate-900">Your Private Study Zone</h2>
                </div>
              </div>

              <div className="mt-8 space-y-5">
                {securityNotes.map((note) => (
                  <article key={note} className="flex items-start gap-4">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    <p className="text-sm font-medium leading-relaxed text-slate-700 opacity-90">{note}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  );
}
