'use client';

import { Chrome, Loader2, LogIn, UserPlus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState, useTransition } from 'react';

interface LoginFormProps {
  googleEnabled: boolean;
}

function getOAuthErrorMessage(errorCode: string | null) {
  switch (errorCode) {
    case 'google_unavailable':
      return 'Google sign-in is not configured for this deployment.';
    case 'google_start_failed':
    case 'google_signin_failed':
      return 'Google sign-in could not be completed. Try again.';
    default:
      return '';
  }
}

export default function LoginForm({ googleEnabled }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const oauthError = getOAuthErrorMessage(searchParams.get('error'));

    if (oauthError) {
      setError(oauthError);
    }
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    try {
      const response = await fetch(isSignUp ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          isSignUp
            ? {
                email,
                password,
                fullName: name,
              }
            : {
                email,
                password,
              },
        ),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to continue.');
      }

      startTransition(() => {
        router.push('/app');
        router.refresh();
      });
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Unable to continue.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative group w-full">
      {/* Outer lifting shadow */}
      <div className="absolute inset-4 bg-black/60 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0" />

      <div className="relative z-10 w-full p-8 sm:p-10 rounded-2xl bg-slate-900/90 border border-white/10 shadow-[8px_8px_20px_rgba(0,0,0,0.6)] backdrop-blur-md overflow-hidden">
        
        {/* Top tape piece */}
        <div className="absolute top-0 right-12 w-16 h-4 bg-white/20 border border-white/10 backdrop-blur-sm rotate-2 z-30 shadow-sm" />

        {/* Inner subtle grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100%_32px] top-6 pointer-events-none" />

        <div className="relative z-20 space-y-3">
          <p className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1 text-xs font-mono uppercase tracking-widest text-emerald-400 border border-emerald-500/20">
            {isSignUp ? 'Create Account' : 'Authenticate'}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            {isSignUp ? 'Launch your Workspace' : 'Resume your Session'}
          </h1>
          <p className="text-sm font-medium leading-relaxed text-slate-400">
            {isSignUp
              ? 'Create a secure account to track your progress, save your study plans, and build your digital academic memory.'
              : 'Sign in to jump right back into your dashboard, pending quizzes, and tailored study plans.'}
          </p>
        </div>

        <div className="relative z-20 mt-8 space-y-5">
          {googleEnabled ? (
            <>
              <a href="/api/auth/google/start" className="group flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 font-semibold text-white transition-all hover:bg-white/10">
                <Chrome className="h-5 w-5 transition-transform group-hover:scale-110" aria-hidden="true" />
                {isSignUp ? 'Sign up with Google' : 'Sign in with Google'}
              </a>
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-slate-500 py-2">
                <div className="h-px flex-1 bg-white/10" />
                <span>Or use email</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
            </>
          ) : null}

          {isSignUp ? (
            <Field label="Full name" htmlFor="auth-name">
              <input
                id="auth-name"
                name="fullName"
                value={name}
                onChange={(event) => setName(event.target.value)}
                type="text"
                autoComplete="name"
                required
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all shadow-inner"
                placeholder="Real name..."
              />
            </Field>
          ) : null}

          <Field label="Email address" htmlFor="auth-email">
            <input
              id="auth-email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              spellCheck={false}
              required
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all shadow-inner"
              placeholder="student@example.com..."
            />
          </Field>

          <Field label="Password" htmlFor="auth-password">
            <input
              id="auth-password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all shadow-inner"
              placeholder={
                isSignUp
                  ? 'Strong password required...'
                  : 'Enter your password...'
              }
            />
          </Field>
        </div>

        {error ? (
          <div aria-live="polite" className="relative z-20 mt-6 rounded-[1.2rem] border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm font-medium text-red-200">
            {error}
          </div>
        ) : null}

        <div className="relative z-20 mt-8 space-y-4">
          <button type="submit" disabled={isPending} className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-4 text-sm font-bold text-slate-950 transition-all hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.23)] hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none">
            {isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : isSignUp ? (
              <UserPlus className="h-5 w-5 transition-transform group-hover:scale-110" aria-hidden="true" />
            ) : (
              <LogIn className="h-5 w-5 transition-transform group-hover:scale-110" aria-hidden="true" />
            )}
            {isSignUp ? 'Commit Registration' : 'Secure Sign In'}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-slate-400 transition-colors hover:text-white hover:bg-white/5"
          >
            {isSignUp ? 'Switch to Sign In' : 'Register New Account'}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block space-y-2">
      <span className="text-sm font-bold text-slate-300">{label}</span>
      {children}
    </label>
  );
}
