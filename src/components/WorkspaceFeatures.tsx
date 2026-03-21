import Link from 'next/link';
import {
  AlarmClock,
  Bot,
  Calculator,
  ClipboardCheck,
  FileSearch,
  Files,
  Layers,
  MessageSquareText,
  Sparkles,
} from 'lucide-react';

interface FeatureCard {
  title: string;
  description: string;
  bullets: string[];
  href?: string;
  status: 'Available' | 'Coming soon';
  icon: typeof Sparkles;
}

const workspaceFeatures: FeatureCard[] = [
  {
    title: 'AI Summary Generator',
    description:
      'Generate comprehensive summaries in paragraph or bullet point format. Customize word count and detail level.',
    bullets: ['Paragraph and bullet formats', 'Adjustable word limits', 'Multi-language support'],
    status: 'Coming soon',
    icon: Sparkles,
  },
  {
    title: 'Ask AI / Q&A Chat',
    description:
      'Have conversations with your documents. Ask questions and get instant, context-aware answers.',
    bullets: ['Chat-based interface', 'Persistent conversations', 'Document-aware responses'],
    href: '/app/chat',
    status: 'Available',
    icon: MessageSquareText,
  },
  {
    title: 'Smart Flashcards',
    description:
      'Auto-generate flashcards from any document. Study with flip cards covering key terms and concepts.',
    bullets: ['Auto-extraction of key terms', 'Interactive flip cards', 'Edit and customize cards'],
    status: 'Coming soon',
    icon: Layers,
  },
  {
    title: 'Practice Exams',
    description:
      'Generate multiple choice questions and matching exercises. Test your knowledge with AI-created exams.',
    bullets: ['MCQ with explanations', 'Matching exercises', 'Customizable question count'],
    href: '/app/plan',
    status: 'Available',
    icon: ClipboardCheck,
  },
  {
    title: 'Study Timer',
    description:
      'Stay focused with a Pomodoro-style timer. Track your study sessions and build productive habits.',
    bullets: ['Pomodoro technique', 'Session tracking', 'Statistics and analytics'],
    href: '/app/schedule',
    status: 'Available',
    icon: AlarmClock,
  },
  {
    title: 'AI Detection',
    description:
      'Check if text appears AI-generated. Optimized for academic writing to help maintain authenticity.',
    bullets: ['Academic writing focus', 'Detailed analysis', 'Improvement suggestions'],
    status: 'Coming soon',
    icon: Bot,
  },
  {
    title: 'Report Analysis',
    description:
      'Get AI feedback on grammar, clarity, structure, and content quality. Improve your academic writing.',
    bullets: ['Grammar and spelling check', 'Structure analysis', 'Quality scoring'],
    status: 'Coming soon',
    icon: FileSearch,
  },
  {
    title: 'Report Generator',
    description:
      'Generate comprehensive reports with customizable word counts and optional reference sheets.',
    bullets: ['Up to 48,000 words', 'Reference sheet option', 'Word count customization'],
    status: 'Coming soon',
    icon: Files,
  },
  {
    title: 'Scientific Calculator',
    description:
      'Built-in scientific calculator for math problems. Supports complex equations and functions.',
    bullets: ['Scientific functions', 'Math equation support', 'LaTeX rendering'],
    status: 'Coming soon',
    icon: Calculator,
  },
];

function FeatureStatus({ status }: { status: FeatureCard['status'] }) {
  const styles =
    status === 'Available'
      ? 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100'
      : 'border-white/15 bg-white/5 text-[var(--color-muted)]';

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${styles}`}>
      {status}
    </span>
  );
}

export default function WorkspaceFeatures() {
  return (
    <section className="app-card p-5 sm:p-6">
      <div className="space-y-2">
        <p className="app-eyebrow">Tools</p>
        <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">Study workspace features</h2>
        <p className="app-copy max-w-3xl">
          Access focused tools for revision, exam preparation, writing support, and daily study flow.
        </p>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {workspaceFeatures.map((feature) => (
          <article key={feature.title} className="app-card-soft flex h-full flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                <feature.icon className="h-5 w-5 text-[var(--color-accent)]" aria-hidden="true" />
              </div>
              <FeatureStatus status={feature.status} />
            </div>

            <div className="mt-4 space-y-3">
              <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
              <p className="text-sm leading-6 text-[var(--color-muted)]">{feature.description}</p>
              <ul className="space-y-1 text-sm text-[var(--color-muted)]">
                {feature.bullets.map((bullet) => (
                  <li key={bullet}>• {bullet}</li>
                ))}
              </ul>
            </div>

            <div className="mt-5">
              {feature.href ? (
                <Link href={feature.href} className="app-action-secondary">
                  Open feature
                </Link>
              ) : (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-[var(--color-muted)]">
                  Will be available soon
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
