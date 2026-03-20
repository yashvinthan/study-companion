'use client';

import { useCompletion } from '@ai-sdk/react';
import { Bot, Loader2, SendHorizontal, User } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const quickActions = [
  {
    label: 'Start Physics Quiz',
    description: 'Generate a kinematics question',
    prompt: '/quiz Physics:Kinematics',
  },
  {
    label: 'Review Weak Areas',
    description: 'Show topics below threshold',
    prompt: '/mistakes',
  },
  {
    label: 'Build 7-Day Plan',
    description: 'Create the next study timeline',
    prompt: '/plan 7',
  },
  {
    label: 'Log 45-Min Session',
    description: 'Save a physics revision block',
    prompt: '/study Physics|Kinematics|45|3',
  },
] as const;

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

interface ChatInterfaceProps {
  studentId: string;
  onConversationSettled: () => void;
}

export default function ChatInterface({
  studentId,
  onConversationSettled,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { complete, completion, input, setInput, handleInputChange, isLoading, error, stop } =
    useCompletion({
      api: '/api/chat',
      body: { student_id: studentId },
      streamProtocol: 'text',
    });

  async function sendPrompt(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed || isLoading) {
      return;
    }

    const nextMessages = [
      ...messages,
      {
        id: crypto.randomUUID(),
        role: 'user' as const,
        content: trimmed,
      },
    ];

    setMessages(nextMessages);
    setInput('');

    try {
      const assistantReply =
        (await complete(trimmed, {
          body: {
            messages: nextMessages,
            student_id: studentId,
          },
        })) || '';

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: assistantReply,
        },
      ]);
      onConversationSettled();
    } catch {
      // Inline error state is rendered below the composer.
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendPrompt(input);
  }

  return (
    <section className="app-shell-panel flex min-h-[42rem] flex-col overflow-hidden">
      <header className="border-b border-white/10 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <p className="app-eyebrow">Chat Coach</p>
            <h2 className="app-title">Ask for revision help, quizzes, plans, or study logging</h2>
            <p className="app-copy">
              Every request reads from the signed-in student&apos;s real study history before
              responding.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="app-chip">{error ? 'Attention needed' : 'Groq + memory live'}</span>
            <span className="app-chip">{messages.length} messages</span>
          </div>
        </div>
      </header>

      <div className="border-b border-white/10 px-4 py-4 sm:px-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => sendPrompt(action.prompt)}
              className="app-card-soft p-4 text-left transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08]"
            >
              <p className="text-sm font-medium text-white">{action.label}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
                {action.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.length === 0 ? (
          <div className="app-card flex min-h-[20rem] flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
              <Bot className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-medium text-white">Start with a real study task</p>
              <p className="app-copy max-w-md">
                Try a quiz, review weak areas, or log the study session you just finished. The
                dashboard and activity pages refresh automatically after each exchange.
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={cn('flex gap-3', message.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'flex max-w-[92%] gap-3 sm:max-w-[78%]',
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row',
                )}
              >
                <div
                  className={cn(
                    'mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border',
                    message.role === 'user'
                      ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/14 text-[var(--color-accent)]'
                      : 'border-white/10 bg-white/[0.05] text-white',
                  )}
                >
                  {message.role === 'user' ? (
                    <User className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Bot className="h-4 w-4" aria-hidden="true" />
                  )}
                </div>
                <div
                  className={cn(
                    'rounded-[1.6rem] border px-4 py-3 text-sm leading-7 shadow-[0_12px_40px_rgba(0,0,0,0.25)]',
                    message.role === 'user'
                      ? 'border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10 text-emerald-50'
                      : 'border-white/10 bg-black/20 text-slate-100',
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                </div>
              </div>
            </article>
          ))
        )}

        {isLoading ? (
          <div className="app-card-soft flex items-center justify-between gap-3 px-4 py-3 text-sm text-[var(--color-muted)]">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent)]" aria-hidden="true" />
              Thinking through your study history...
            </div>
            <button type="button" onClick={stop} className="app-action-secondary px-3 py-1.5 text-xs">
              Stop
            </button>
          </div>
        ) : null}

        {error ? (
          <div
            aria-live="polite"
            className="rounded-[1.2rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          >
            {error.message}
          </div>
        ) : null}

        {isLoading && completion ? (
          <article className="flex gap-3">
            <div className="flex max-w-[92%] gap-3 sm:max-w-[78%]">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white">
                <Bot className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="rounded-[1.6rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-7 text-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
                <p className="whitespace-pre-wrap break-words">{completion}</p>
              </div>
            </div>
          </article>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-white/10 bg-black/20 px-4 py-4 sm:px-6">
        <label htmlFor="chat-prompt" className="sr-only">
          Study coach message
        </label>
        <div className="relative flex items-center">
          <input
            id="chat-prompt"
            name="prompt"
            value={input}
            onChange={handleInputChange}
            disabled={isLoading}
            autoComplete="off"
            spellCheck={false}
            placeholder="Ask about a topic, request a plan, or type a question..."
            className="app-input h-14 pr-16"
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent)] text-slate-950 transition-[filter,transform] duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <SendHorizontal className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
