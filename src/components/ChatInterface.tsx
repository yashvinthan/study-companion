'use client';

import { useCompletion } from '@ai-sdk/react';
import { Bot, Loader2, Paperclip, SendHorizontal, User, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const CHAT_REQUEST_TIMEOUT_MS = 90_000;
const MAX_ATTACHMENTS = 6;
const MAX_TEXT_ATTACHMENT_CHARS = 120_000;
const TEXT_MIME_PREFIX = 'text/';
const IMAGE_MIME_PREFIX = 'image/';
const DOC_MIME_TYPES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

type AttachmentKind = 'text' | 'pdf' | 'image' | 'doc';
type SearchMode = 'web' | 'academic' | 'social';

type ChatAttachment = {
  id: string;
  name: string;
  mimeType: string;
  kind: AttachmentKind;
  textContent?: string;
  dataUrl?: string;
};

const quickActions = [
  {
    label: 'Start Physics Quiz',
    description: 'Generate a kinematics question',
    prompt: 'Start a quiz on Physics: Kinematics.',
  },
  {
    label: 'Review Weak Areas',
    description: 'Show topics below threshold',
    prompt: 'Show my weak areas and what to revise first.',
  },
  {
    label: 'Build 7-Day Plan',
    description: 'Create the next study timeline',
    prompt: 'Create a 7-day study plan based on my current progress.',
  },
  {
    label: 'Log 45-Min Session',
    description: 'Save a physics revision block',
    prompt: 'Log a 45 minute Physics Kinematics session with confidence 3 out of 5.',
  },
] as const;

const modelOptions = [
  { value: '', label: 'Default model' },
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
  { value: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B (Groq)' },
] as const;

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: ChatAttachment[];
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
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [searchMode, setSearchMode] = useState<SearchMode>('web');
  const [deepResearch, setDeepResearch] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { complete, completion, input, setInput, handleInputChange, isLoading, error, stop } =
    useCompletion({
      api: '/api/chat',
      body: {
        student_id: studentId,
        search_mode: searchMode,
        deep_research: deepResearch,
        llm_model: selectedModel || undefined,
      },
      streamProtocol: 'text',
    });

  async function fileToDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }
        reject(new Error(`Failed to read ${file.name}.`));
      };
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }

  async function toChatAttachment(file: File): Promise<ChatAttachment | null> {
    const mimeType = file.type || 'application/octet-stream';
    const lowerName = file.name.toLowerCase();

    if (mimeType.startsWith(TEXT_MIME_PREFIX) || /\.(txt|md|csv|json|rtf)$/i.test(lowerName)) {
      const textContent = (await file.text()).slice(0, MAX_TEXT_ATTACHMENT_CHARS);
      return {
        id: crypto.randomUUID(),
        name: file.name,
        mimeType,
        kind: 'text',
        textContent,
      };
    }

    if (mimeType === 'application/pdf' || lowerName.endsWith('.pdf')) {
      return {
        id: crypto.randomUUID(),
        name: file.name,
        mimeType: 'application/pdf',
        kind: 'pdf',
        dataUrl: await fileToDataUrl(file),
      };
    }

    if (DOC_MIME_TYPES.has(mimeType) || /\.(doc|docx)$/i.test(lowerName)) {
      return {
        id: crypto.randomUUID(),
        name: file.name,
        mimeType,
        kind: 'doc',
        dataUrl: await fileToDataUrl(file),
      };
    }

    if (mimeType.startsWith(IMAGE_MIME_PREFIX)) {
      return {
        id: crypto.randomUUID(),
        name: file.name,
        mimeType,
        kind: 'image',
        dataUrl: await fileToDataUrl(file),
      };
    }

    return null;
  }

  async function handleAttachFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length === 0) {
      return;
    }

    const availableSlots = Math.max(0, MAX_ATTACHMENTS - attachments.length);
    const accepted = selected.slice(0, availableSlots);
    const converted = await Promise.all(accepted.map((file) => toChatAttachment(file)));
    const valid = converted.filter((item): item is ChatAttachment => item !== null);

    if (valid.length > 0) {
      setAttachments((current) => [...current, ...valid]);
    }

    event.target.value = '';
  }

  function removeAttachment(attachmentId: string) {
    setAttachments((current) => current.filter((item) => item.id !== attachmentId));
  }

  async function sendPrompt(prompt: string) {
    const trimmed = prompt.trim();
    if ((!trimmed && attachments.length === 0) || isLoading) {
      return;
    }

    const cleanMessages = messages.filter((message) => message.content.trim().length > 0);
    const outgoingAttachments = attachments;
    const nextMessages = [
      ...cleanMessages,
      {
        id: crypto.randomUUID(),
        role: 'user' as const,
        content: trimmed || 'Analyze the uploaded files.',
        attachments: outgoingAttachments,
      },
    ];

    setMessages(nextMessages);
    setInput('');
    setAttachments([]);

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    try {
      const assistantReply =
        (await Promise.race([
          complete(trimmed, {
            body: {
              messages: nextMessages,
              student_id: studentId,
              search_mode: searchMode,
              deep_research: deepResearch,
              llm_model: selectedModel || undefined,
            },
          }),
          new Promise<string>((_, reject) => {
            timeoutHandle = setTimeout(() => {
              stop();
              reject(
                new Error(
                  'This response is taking longer than expected. Please retry in a few seconds.',
                ),
              );
            }, CHAT_REQUEST_TIMEOUT_MS);
          }),
        ])) || '';

      const trimmedReply = assistantReply.trim();
      const safeReply =
        trimmedReply || 'I could not generate a response this time. Please retry.';
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: safeReply,
        },
      ]);
      onConversationSettled();
    } catch (error) {
      const fallbackMessage =
        error instanceof Error && error.message
          ? error.message
          : 'The request failed. Please try again.';
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: fallbackMessage,
        },
      ]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
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
            <span className="app-chip">Mode: {searchMode}</span>
            <span className="app-chip">{deepResearch ? 'Deep research on' : 'Deep research off'}</span>
            <span className="app-chip">{messages.length} messages</span>
          </div>
        </div>
      </header>

      <div className="border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="app-chip inline-flex items-center gap-2">
            Sources
            <select
              value={searchMode}
              onChange={(event) => setSearchMode(event.target.value as SearchMode)}
              className="bg-transparent text-xs outline-none"
              disabled={isLoading}
            >
              <option value="web">Web</option>
              <option value="academic">Academic</option>
              <option value="social">Social</option>
            </select>
          </label>
          <label className="app-chip inline-flex items-center gap-2">
            Model
            <select
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
              className="bg-transparent text-xs outline-none"
              disabled={isLoading}
            >
              {modelOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setDeepResearch((current) => !current)}
            disabled={isLoading}
            className={cn(
              'app-chip',
              deepResearch ? 'border-[var(--color-accent)]/50 text-[var(--color-accent)]' : '',
            )}
          >
            {deepResearch ? 'Deep research: ON' : 'Deep research: OFF'}
          </button>
        </div>
      </div>

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
                  {message.role === 'user' && message.attachments && message.attachments.length > 0 ? (
                    <div className="mt-3 space-y-1 text-xs text-emerald-200/90">
                      {message.attachments.map((attachment) => (
                        <p key={attachment.id}>
                          Attachment: {attachment.name} ({attachment.kind})
                        </p>
                      ))}
                    </div>
                  ) : null}
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
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.csv,.json,.pdf,.doc,.docx,.rtf,image/*"
            onChange={handleAttachFiles}
            className="hidden"
          />
          <input
            id="chat-prompt"
            name="prompt"
            value={input}
            onChange={handleInputChange}
            disabled={isLoading}
            autoComplete="off"
            spellCheck={false}
            placeholder="Ask anything, or upload notes/PDF/Word/images..."
            className="app-input h-14 pr-28"
          />
          <button
            type="button"
            aria-label="Attach files"
            disabled={isLoading || attachments.length >= MAX_ATTACHMENTS}
            onClick={() => fileInputRef.current?.click()}
            className="absolute right-12 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-transparent text-white transition-[filter,transform] duration-200 hover:-translate-y-0.5 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Paperclip className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="submit"
            aria-label="Send message"
            disabled={isLoading || (!input.trim() && attachments.length === 0)}
            className="absolute right-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent)] text-slate-950 transition-[filter,transform] duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <SendHorizontal className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {attachments.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <span
                key={attachment.id}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-slate-200"
              >
                {attachment.name}
                <button
                  type="button"
                  onClick={() => removeAttachment(attachment.id)}
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-200 hover:bg-white/15"
                  aria-label={`Remove ${attachment.name}`}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </form>
    </section>
  );
}
