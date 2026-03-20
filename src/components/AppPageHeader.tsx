import type { ReactNode } from 'react';

interface AppPageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  meta?: ReactNode;
}

export default function AppPageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: AppPageHeaderProps) {
  return (
    <section className="app-shell-panel p-6 sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <p className="app-eyebrow">{eyebrow}</p>
          <h1 className="app-title">{title}</h1>
          <p className="app-copy">{description}</p>
          {meta ? <div className="flex flex-wrap gap-2 pt-1">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}
