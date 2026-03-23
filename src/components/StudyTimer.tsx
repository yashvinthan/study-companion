'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Save, Timer as TimerIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type TimerMode = 'pomodoro' | 'shortBreak' | 'longBreak';

const TIMES = {
  pomodoro: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

export default function StudyTimer() {
  const [mode, setMode] = useState<TimerMode>('pomodoro');
  const [timeLeft, setTimeLeft] = useState(TIMES.pomodoro);
  const [isActive, setIsActive] = useState(false);
  const [showLogForm, setShowLogForm] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [confidence, setConfidence] = useState<'1'|'2'|'3'|'4'|'5'>('3');

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (isActive && timeLeft === 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsActive(false);
      if (mode === 'pomodoro') {
        setShowLogForm(true);
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, timeLeft, mode]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(TIMES[mode]);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const switchMode = (newMode: TimerMode) => {
    setMode(newMode);
    setTimeLeft(TIMES[newMode]);
    setIsActive(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((TIMES[mode] - timeLeft) / TIMES[mode]) * 100;

  async function handleLogSession(e: React.FormEvent) {
    e.preventDefault();
    setIsLogging(true);
    setLogError(null);
    setLogSuccess(false);

    try {
      const res = await fetch('/api/schedule/study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          topic,
          durationMinutes: 25, // Assuming a full Pomodoro was completed
          confidenceScore: parseInt(confidence, 10),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to log session');
      }

      setLogSuccess(true);
      setTimeout(() => {
        setShowLogForm(false);
        setSubject('');
        setTopic('');
        setLogSuccess(false);
      }, 2000);
    } catch (err) {
      setLogError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLogging(false);
    }
  }

  return (
    <div className="app-card h-full p-5 sm:p-6 flex flex-col items-center">
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-[var(--color-accent)]/10 p-2">
            <TimerIcon className="h-5 w-5 text-[var(--color-accent)]" />
          </div>
          <h2 className="text-lg font-semibold text-white">Study Timer</h2>
        </div>
        <span className="app-chip">
          {mode === 'pomodoro' ? 'Focus' : mode === 'shortBreak' ? 'Short Break' : 'Long Break'}
        </span>
      </div>

      {!showLogForm ? (
        <>
          <div className="mt-8 flex gap-2 rounded-2xl bg-white/5 p-1">
            <button
              onClick={() => switchMode('pomodoro')}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                mode === 'pomodoro' ? 'bg-[var(--color-accent)] text-slate-900' : 'text-white hover:bg-white/10'
              )}
            >
              Pomodoro
            </button>
            <button
              onClick={() => switchMode('shortBreak')}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                mode === 'shortBreak' ? 'bg-[var(--color-accent)] text-slate-900' : 'text-white hover:bg-white/10'
              )}
            >
              Short Break
            </button>
            <button
              onClick={() => switchMode('longBreak')}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                mode === 'longBreak' ? 'bg-[var(--color-accent)] text-slate-900' : 'text-white hover:bg-white/10'
              )}
            >
              Long Break
            </button>
          </div>

          <div className="relative mt-12 flex h-48 w-48 items-center justify-center rounded-full bg-white/5 shadow-inner">
            <svg className="absolute inset-0 h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="4"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="4"
                strokeDasharray={`${progress * 2.83} 283`}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <span className="text-5xl font-mono font-bold tracking-tighter text-white">
              {formatTime(timeLeft)}
            </span>
          </div>

          <div className="mt-10 flex gap-4">
            <button
              onClick={toggleTimer}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent)] text-slate-900 transition-transform hover:scale-105 active:scale-95"
            >
              {isActive ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />}
            </button>
            <button
              onClick={resetTimer}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10 active:scale-95"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={handleLogSession} className="mt-8 flex w-full flex-col gap-4">
          <div className="rounded-xl border border-green-400/30 bg-green-500/10 p-4 text-center">
            <h3 className="text-lg font-semibold text-green-400">Pomodoro Completed!</h3>
            <p className="mt-1 text-sm text-green-200">Log this session to your memory.</p>
          </div>

          <div className="space-y-4 text-left">
            <div>
              <label htmlFor="timer-subject" className="app-label">Subject</label>
              <input
                id="timer-subject"
                required
                className="app-input"
                placeholder="e.g. Mathematics"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="timer-topic" className="app-label">Topic</label>
              <input
                id="timer-topic"
                required
                className="app-input"
                placeholder="e.g. Linear Algebra"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="timer-confidence" className="app-label">Confidence (1-5)</label>
              <select
                id="timer-confidence"
                className="app-input"
                value={confidence}
                onChange={(e) => setConfidence(e.target.value as any)}
              >
                <option value="1">1 - Struggling</option>
                <option value="2">2 - Needs Work</option>
                <option value="3">3 - Okay</option>
                <option value="4">4 - Good</option>
                <option value="5">5 - Mastered</option>
              </select>
            </div>
          </div>

          {logError && <p className="text-sm text-red-400">{logError}</p>}
          {logSuccess && <p className="text-sm text-green-400">Session logged successfully!</p>}

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setShowLogForm(false);
                switchMode('shortBreak');
              }}
              className="app-action-secondary flex-1"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={isLogging || logSuccess}
              className="app-action-primary flex-1 justify-center"
            >
              {isLogging ? 'Saving...' : 'Save Session'}
              <Save className="ml-2 h-4 w-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
