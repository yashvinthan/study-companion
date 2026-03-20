'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative min-h-screen px-4 py-8 text-[var(--color-text)] sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(73,215,181,0.12),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(255,184,108,0.12),transparent_20%)]" />

      <div className="relative mx-auto flex min-h-[80vh] max-w-3xl items-center justify-center">
        <section className="app-shell-panel w-full p-8 text-center sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-amber-300/20 bg-amber-400/10 text-amber-100">
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          </div>

          <p className="app-eyebrow mt-6">Workspace Error</p>
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.04em] text-white">
            This Page Couldn&apos;t Load
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--color-muted)]">
            A server error occurred while loading this part of the workspace. Retry first. If it
            keeps happening, check the server logs with digest {error.digest || 'not available'}.
          </p>

          <div className="mt-8 flex justify-center">
            <button type="button" onClick={() => unstable_retry()} className="app-action-primary">
              <RotateCw className="h-4 w-4" aria-hidden="true" />
              Reload
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
