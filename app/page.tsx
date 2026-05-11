'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

const PLACEHOLDER_PROMPTS = [
  'west village, then along the river.',
  'dumbo, over the bridge, dinner in chinatown.',
  'museum uptown, then a lap in the park.',
  'lower east side, essex market, end on the high line.',
];

const PROMPT_FADE_MS = 1000;

function textFromMessage(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export default function Page() {
  const transport = useRef(new DefaultChatTransport({ api: '/api/chat' })).current;

  const { messages, sendMessage, status } = useChat({ transport });

  const [input, setInput] = useState('');
  const [promptIdx, setPromptIdx] = useState(0);
  const [promptOpaque, setPromptOpaque] = useState(true);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPromptOpaque(false);
      window.setTimeout(() => {
        setPromptIdx((i) => (i + 1) % PLACEHOLDER_PROMPTS.length);
        setPromptOpaque(true);
      }, PROMPT_FADE_MS);
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || status !== 'ready') return;
    await sendMessage({ text: trimmed });
    setInput('');
  }

  const chatMessages = messages.filter(
    (m) => m.role === 'user' || m.role === 'assistant',
  );

  const showPlaceholderOverlay = input.length === 0;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-gradient-to-b from-sky-50 via-slate-50 to-sky-100 lowercase">
      <div
        className="pointer-events-none absolute bottom-8 right-6 h-80 w-80 rounded-full bg-sky-200/20 blur-[120px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-200/20 blur-[120px]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex h-[100dvh] max-w-2xl flex-col gap-4 p-4">
        <header className="rounded-3xl border border-white/40 bg-white/30 px-6 py-5 shadow-lg shadow-black/5 backdrop-blur-2xl">
          <h1 className="font-serif text-3xl font-normal tracking-tight text-slate-900 italic">
            saunter
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            plan a walk in new york.
          </p>
        </header>

        <main className="flex min-h-0 flex-1 flex-col rounded-3xl border border-white/40 bg-white/30 shadow-lg shadow-black/5 backdrop-blur-2xl">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5">
            {chatMessages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-2 text-center">
                <p className="text-base text-slate-700">
                  say a neighborhood, how long you want to walk, or where you want to
                  end up.
                </p>
              </div>
            ) : (
              chatMessages.map((message) => {
                const isUser = message.role === 'user';
                const body = textFromMessage(message);
                return (
                  <div
                    key={message.id}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-3xl border px-4 py-3 shadow-md shadow-black/5 ${
                        isUser
                          ? 'border-white/20 bg-slate-900/80 text-white'
                          : 'border-white/40 bg-white/40 text-slate-900'
                      }`}
                    >
                      <p
                        className={`mb-2 text-[10px] font-normal tracking-wide text-slate-500 ${
                          isUser ? 'text-white/60' : ''
                        }`}
                      >
                        {isUser ? 'you' : 'planner'}
                      </p>
                      <div
                        className={
                          isUser
                            ? 'prose prose-invert prose-sm max-w-none font-serif leading-relaxed'
                            : 'prose prose-slate prose-sm max-w-none font-serif leading-relaxed'
                        }
                      >
                        <ReactMarkdown>{body}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {status === 'submitted' && (
              <p className="px-1 text-sm text-slate-500">one moment.</p>
            )}

            <div ref={scrollAnchorRef} />
          </div>

          <form
            onSubmit={onSubmit}
            className="border-t border-white/40 p-4 backdrop-blur-2xl"
          >
            <div className="flex gap-2 rounded-2xl border border-white/40 bg-white/30 p-2 shadow-inner shadow-black/5 transition-[border-color,box-shadow,background-color] duration-1000 ease-in-out focus-within:border-white/60 focus-within:bg-white/40 focus-within:shadow-[0_0_0_1px_rgba(255,255,255,0.35)]">
              <div className="relative min-w-0 flex-1">
                <input
                  className="w-full rounded-xl border border-white/50 bg-white/40 px-3 py-2 text-sm text-slate-900 outline-none transition-[background-color,box-shadow,border-color,color] duration-1000 ease-in-out placeholder:text-transparent focus:border-white/60 focus:bg-white/50 focus:ring-2 focus:ring-slate-400/25"
                  placeholder=""
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={status !== 'ready'}
                  aria-label="message"
                />
                {showPlaceholderOverlay && (
                  <span
                    className={`pointer-events-none absolute left-3 top-1/2 max-w-[calc(100%-0.5rem)] -translate-y-1/2 truncate text-left text-sm text-slate-500 transition-opacity duration-1000 ease-in-out ${
                      promptOpaque ? 'opacity-60' : 'opacity-0'
                    }`}
                  >
                    {PLACEHOLDER_PROMPTS[promptIdx]}
                  </span>
                )}
              </div>
              <button
                type="submit"
                disabled={status !== 'ready' || !input.trim()}
                className="rounded-xl border border-white/50 bg-slate-900/80 px-4 py-2 text-sm font-normal text-white shadow-sm transition-[background-color,border-color,opacity,transform] duration-1000 ease-in-out enabled:hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                send
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
