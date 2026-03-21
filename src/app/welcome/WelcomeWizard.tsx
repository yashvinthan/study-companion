'use client';

import { ArrowRight, BookOpen, CheckCircle2, Globe2, Loader2, Sparkles, GraduationCap, School, Briefcase } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';

type EducationLevel = 'school' | 'college' | 'professional' | '';

export default function WelcomeWizard({ userName }: { userName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  // Form State
  const [educationLevel, setEducationLevel] = useState<EducationLevel>('');
  const [country, setCountry] = useState('');
  const [board, setBoard] = useState('');
  const [grade, setGrade] = useState('');

  async function handleComplete() {
    if (!country || !board || !grade || !educationLevel) {
      setError('Please fill in all details to continue.');
      return;
    }
    setError('');

    try {
      const res = await fetch('/api/profile/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          educationLevel,
          studyCountry: country,
          studyBoard: board,
          studyGrade: grade,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to complete onboarding.');
      }

      startTransition(() => {
        router.push('/app');
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    }
  }

  // Dynamic Content based on Education Level
  const formContent = {
    school: {
      boardLabel: 'Exam Board / Syllabus',
      boardPlaceholder: 'e.g. A-Levels, CBSE, IB Diploma...',
      boardOptions: ['CBSE', 'ICSE', 'State Board', 'IGCSE', 'IB Diploma', 'A-Levels', 'GCSE', 'High School Diploma (US)'],
      gradeLabel: 'Grade / Year Level',
      gradePlaceholder: 'e.g. Class 10, Class 12, PUC 2...',
      gradeOptions: ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11 / PUC 1', 'Class 12 / PUC 2'],
    },
    college: {
      boardLabel: 'University Name & Degree / Major',
      boardPlaceholder: 'e.g. Stanford BSc Computer Science...',
      boardOptions: ['BSc Computer Science', 'BA English', 'BTech', 'MBA', 'MBBS', 'BBA', 'BCA', 'LLB', 'BCom', 'Undeclared/General'],
      gradeLabel: 'Year of Study',
      gradePlaceholder: 'e.g. Freshman, Year 2, Senior...',
      gradeOptions: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Freshman', 'Sophomore', 'Junior', 'Senior', 'Masters Year 1', 'Masters Year 2', 'PhD / Doctorate'],
    },
    professional: {
      boardLabel: 'Focus Area / Certification',
      boardPlaceholder: 'e.g. AWS Solutions Architect, CMA...',
      boardOptions: ['AWS Certified', 'CPA', 'CFA', 'PMP', 'Self-Taught Programming', 'Language Learning', 'Digital Marketing', 'Data Science Bootcamp'],
      gradeLabel: 'Current Level',
      gradePlaceholder: 'e.g. Beginner, Intermediate, Professional...',
      gradeOptions: ['Beginner', 'Intermediate', 'Advanced', 'Professional', 'Expert'],
    },
  }[educationLevel as Exclude<EducationLevel, ''>] || {
    boardLabel: 'Field of Study',
    boardPlaceholder: '...',
    boardOptions: [],
    gradeLabel: 'Current Level',
    gradePlaceholder: '...',
    gradeOptions: [],
  };

  return (
    <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl sm:p-12">
      {/* Visual Progress Bar */}
      <div className="absolute left-0 top-0 h-1 w-full bg-slate-800">
        <div
          className="h-full bg-emerald-500 transition-all duration-500 ease-out"
          style={{ width: step === 1 ? '33%' : step === 2 ? '66%' : '100%' }}
        />
      </div>

      {step === 1 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-inner">
            <Sparkles className="h-8 w-8" />
          </div>
          <h1 className="mb-4 text-4xl font-extrabold text-white tracking-tight">
            Welcome to Analog Desk,<br />
            <span className="text-emerald-400">{userName}</span>.
          </h1>
          <p className="mb-8 text-lg text-slate-400 leading-relaxed font-medium">
            Your intelligence system for learning. To make Analog Desk work perfectly for you,
            we just need to calibrate it to your current academic stage.
          </p>
          <button
            onClick={() => setStep(2)}
            className="group mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-4 text-sm font-bold text-slate-950 transition-all hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.23)] hover:-translate-y-0.5"
          >
            Personalize my Workspace
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="animate-in fade-in slide-in-from-right-8 duration-500">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shadow-inner">
            <GraduationCap className="h-8 w-8" />
          </div>
          <h2 className="mb-2 text-3xl font-bold text-white tracking-tight">Where are you studying?</h2>
          <p className="mb-8 text-slate-400 font-medium">
            Select your current education tier so we understand your academic environment.
          </p>

          <div className="space-y-4">
            <button
              onClick={() => { setEducationLevel('school'); setStep(3); }}
              className={`w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-all ${educationLevel === 'school'
                  ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                  : 'border-white/10 bg-black/20 hover:bg-white/5 hover:border-white/20'
                }`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                <School className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-white">School / High School</h3>
                <p className="text-sm text-slate-400">Following a standard K-12 curriculum or board.</p>
              </div>
            </button>

            <button
              onClick={() => { setEducationLevel('college'); setStep(3); }}
              className={`w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-all ${educationLevel === 'college'
                  ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                  : 'border-white/10 bg-black/20 hover:bg-white/5 hover:border-white/20'
                }`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-white">College / University</h3>
                <p className="text-sm text-slate-400">Focusing on specialized higher education degrees.</p>
              </div>
            </button>

            <button
              onClick={() => { setEducationLevel('professional'); setStep(3); }}
              className={`w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-all ${educationLevel === 'professional'
                  ? 'border-violet-500 bg-violet-500/10 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
                  : 'border-white/10 bg-black/20 hover:bg-white/5 hover:border-white/20'
                }`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400">
                <Briefcase className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-white">Professional / Self-Taught</h3>
                <p className="text-sm text-slate-400">Studying independently for certifications or skills.</p>
              </div>
            </button>
          </div>

          <div className="mt-8">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-4 rounded-xl text-sm font-semibold text-slate-400 hover:text-white transition-colors hover:bg-white/5"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="animate-in fade-in slide-in-from-right-8 duration-500">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-inner">
            <BookOpen className="h-8 w-8" />
          </div>
          <h2 className="mb-2 text-3xl font-bold text-white tracking-tight">The Details</h2>
          <p className="mb-8 text-slate-400 font-medium">
            We use this to calibrate our AI models to your exact examination boards and grading standards.
          </p>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-slate-400" />
                Country of Study
              </label>
              <AutocompleteInput
                placeholder="e.g. United Kingdom, India, USA..."
                value={country}
                onChange={setCountry}
                options={['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Singapore', 'Malaysia', 'United Arab Emirates']}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300">
                {formContent.boardLabel}
              </label>
              <AutocompleteInput
                placeholder={formContent.boardPlaceholder}
                value={board}
                onChange={setBoard}
                options={formContent.boardOptions}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300">
                {formContent.gradeLabel}
              </label>
              <AutocompleteInput
                placeholder={formContent.gradePlaceholder}
                value={grade}
                onChange={setGrade}
                options={formContent.gradeOptions}
              />
            </div>
          </div>

          {error && (
            <p className="mt-6 text-sm font-medium text-red-200 bg-red-500/10 border border-red-500/30 px-5 py-4 rounded-[1.2rem] shadow-sm">
              {error}
            </p>
          )}

          <div className="mt-8 flex gap-4">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-4 rounded-xl text-sm font-semibold text-slate-400 hover:text-white transition-colors hover:bg-white/5"
            >
              Back
            </button>
            <button
              onClick={handleComplete}
              disabled={isPending}
              className="flex-1 group flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 text-sm font-bold text-slate-950 transition-all hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 shadow-[0_4px_14px_0_rgba(255,255,255,0.39)] hover:shadow-[0_6px_20px_rgba(255,255,255,0.23)] hover:-translate-y-0.5"
            >
              {isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
              {isPending ? 'Configuring Intelligence...' : 'Complete Setup'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
