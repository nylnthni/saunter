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

type FinalizeRouteResult = {
  success: boolean;
  vibe: string;
  total_duration_minutes: number;
  stops: Array<{
    name: string;
    note: string;
    resolved: { name: string; address: string; lat: number; lng: number } | null;
  }>;
};

type LatLng = { lat: number; lng: number };

function buildGoogleMapsUrl(points: LatLng[]): string | null {
  if (points.length === 0) return null;
  const origin = points[0];
  const destination = points[points.length - 1];
  const waypoints = points.slice(1, -1).map((p) => `${p.lat},${p.lng}`).join('|');

  const base = `https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}`;
  if (!waypoints) return base;
  return `${base}&waypoints=${encodeURIComponent(waypoints)}`;
}

/** Apple Maps does not support multi-stop walking; open first stop only. */
function buildAppleMapsFirstStopUrl(first: LatLng | undefined): string | null {
  if (!first) return null;
  return `https://maps.apple.com/?dirflg=w&daddr=${first.lat},${first.lng}`;
}

function buildAddressListForCopy(
  stops: Array<{ name: string; resolved: { address: string } }>,
): string {
  return stops
    .map((s, i) => `${i + 1}. ${s.name} — ${s.resolved.address}`)
    .join('\n');
}

function FinalizeRouteCard({ finalize }: { finalize: FinalizeRouteResult }) {
  const [copied, setCopied] = useState(false);

  const resolvedStops = finalize.stops
    .filter((s) => s.resolved)
    .map((s) => ({
      name: s.name,
      note: s.note,
      resolved: s.resolved!,
    }));

  const failedCount = finalize.stops.length - resolvedStops.length;
  const points: LatLng[] = resolvedStops.map((s) => ({
    lat: s.resolved.lat,
    lng: s.resolved.lng,
  }));

  const googleUrl = buildGoogleMapsUrl(points);
  const appleFirstUrl = buildAppleMapsFirstStopUrl(points[0]);

  async function handleCopyAddresses() {
    if (resolvedStops.length === 0) return;
    const text = buildAddressListForCopy(resolvedStops);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard failures
    }
  }

  return (
    <div className="mt-3 rounded-3xl border border-white/40 bg-white/40 p-4 shadow-lg shadow-black/5 backdrop-blur-2xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            vibe
          </div>
          <div className="mt-1 font-serif text-sm text-slate-900">{finalize.vibe}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            total duration
          </div>
          <div className="mt-1 font-serif text-sm text-slate-900">
            {finalize.total_duration_minutes} min
          </div>
        </div>
      </div>

      {failedCount > 0 && (
        <div className="mb-4 rounded-2xl border border-white/40 bg-slate-900/10 px-3 py-2 text-xs text-slate-700">
          warning: some stops couldn&apos;t be resolved.
        </div>
      )}

      <div className="mb-6 space-y-3">
        {resolvedStops.map((stop, idx) => (
          <div
            key={`${stop.name}-${idx}`}
            className="rounded-2xl border border-white/40 bg-white/20 p-3"
          >
            <div className="font-serif text-sm text-slate-900">{stop.name}</div>
            <div className="mt-0.5 text-xs text-slate-600">{stop.resolved.address}</div>
            {stop.note && (
              <div className="mt-2 text-sm leading-relaxed text-slate-800">{stop.note}</div>
            )}
          </div>
        ))}

        {resolvedStops.length === 0 && (
          <div className="text-sm text-slate-600">no resolved stops yet.</div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <a
          className={`flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-xl bg-slate-900/70 px-3 py-3 text-center text-xs font-semibold text-white transition hover:bg-slate-900/85 normal-case ${
            googleUrl ? '' : 'cursor-not-allowed opacity-60'
          }`}
          href={googleUrl ?? '#'}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            if (!googleUrl) e.preventDefault();
          }}
        >
          Google Maps <span aria-hidden>↗</span>
        </a>
        <a
          className={`flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-xl bg-slate-900/70 px-3 py-3 text-center text-xs font-semibold text-white transition hover:bg-slate-900/85 normal-case ${
            appleFirstUrl ? '' : 'cursor-not-allowed opacity-60'
          }`}
          href={appleFirstUrl ?? '#'}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            if (!appleFirstUrl) e.preventDefault();
          }}
        >
          Apple Maps (first stop) <span aria-hidden>↗</span>
        </a>
      </div>

      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={handleCopyAddresses}
          disabled={resolvedStops.length === 0}
          className={`border-b border-transparent pb-0.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
            copied
              ? 'cursor-default text-emerald-700'
              : 'text-slate-600 hover:border-slate-400/80 hover:text-slate-900'
          }`}
        >
          {copied ? '✓ copied' : 'Copy all addresses'}
        </button>
      </div>

      <p className="mx-auto mt-2 max-w-md text-center text-xs italic leading-snug text-slate-500 normal-case">
        apple maps doesn&apos;t support multi-stop walking — open the first stop, or copy the
        list to add stops manually.
      </p>
    </div>
  );
}

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
                      {(() => {
                        const finalizePart = [...message.parts]
                          .reverse()
                          .find(
                            (part: any) =>
                              part?.type === 'tool-finalize_route' &&
                              part?.state === 'output-available' &&
                              part?.output,
                          ) as { output: FinalizeRouteResult } | undefined;

                        const finalize = finalizePart?.output;
                        if (!finalize) return null;

                        return <FinalizeRouteCard finalize={finalize} />;
                      })()}
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
