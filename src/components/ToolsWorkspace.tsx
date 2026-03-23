'use client';

import {
  FileText,
  MessageSquare,
  Layers,
  GraduationCap,
  ShieldAlert,
  SpellCheck,
  FileBox
} from 'lucide-react';
import StudyTimer from './StudyTimer';
import ScientificCalculator from './ScientificCalculator';

export default function ToolsWorkspace() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Interactive Widgets */}
        <div className="md:col-span-2 xl:col-span-1">
          <StudyTimer />
        </div>
        <div className="md:col-span-2 xl:col-span-2">
          <ScientificCalculator />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="app-eyebrow">AI Generators & Analysis</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <PlaceholderCard
            title="AI Summary"
            description="Summarize uploaded notes into paragraphs or bullet points."
            icon={FileText}
          />
          <PlaceholderCard
            title="Ask AI"
            description="Context-aware chat tied to your documents and memory."
            icon={MessageSquare}
          />
          <PlaceholderCard
            title="Smart Flashcards"
            description="Auto-generate flip-cards highlighting weak concepts."
            icon={Layers}
          />
          <PlaceholderCard
            title="Practice Exams"
            description="Generate adaptive MCQs based on past mistakes."
            icon={GraduationCap}
          />
          <PlaceholderCard
            title="AI Detection"
            description="Analyze text for AI generation with academic focus."
            icon={ShieldAlert}
          />
          <PlaceholderCard
            title="Report Analysis"
            description="Get grammar, clarity, and structural feedback."
            icon={SpellCheck}
          />
          <PlaceholderCard
            title="Report Generator"
            description="Generate long-form academic reports with references."
            icon={FileBox}
          />
        </div>
      </div>
    </div>
  );
}

function PlaceholderCard({ title, description, icon: Icon }: { title: string, description: string, icon: any }) {
  return (
    <article className="app-card flex flex-col p-5 opacity-70 hover:opacity-100 transition-opacity cursor-not-allowed">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-[var(--color-accent)]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-base font-medium text-white">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{description}</p>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-white/10 text-xs font-medium text-[var(--color-muted)] text-center uppercase tracking-wider">
        Coming Soon
      </div>
    </article>
  );
}
