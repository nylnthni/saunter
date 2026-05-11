import { anthropic } from '@ai-sdk/anthropic';
import { streamText, convertToModelMessages, UIMessage, tool, stepCountIs } from 'ai';
import { z } from 'zod';

export const maxDuration = 30;

async function findPlace(query: string) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY not set');

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.id',
    },
    body: JSON.stringify({
      textQuery: query + ' New York City',
      maxResultCount: 1,
    }),
  });

  if (!res.ok) {
    console.error('Places API error:', await res.text());
    return null;
  }

  const data = await res.json();
  const place = data.places && data.places[0];
  if (!place) return null;

  return {
    name: (place.displayName && place.displayName.text) || query,
    address: place.formattedAddress || '',
    lat: (place.location && place.location.latitude) || 0,
    lng: (place.location && place.location.longitude) || 0,
  };
}

const SYSTEM_PROMPT = [
  'You are saunter, a quiet companion for walking New York City.',
  'You help users plan walking routes through Manhattan and Brooklyn.',
  '',
  'Recommendation philosophy:',
  '- Prioritize places New Yorkers actually love over generic travel guides.',
  '- Lean toward spots with buzz on Reddit, TikTok, Instagram in past 1-2 years.',
  '- Favor independent, locally-owned, neighborhood-defining spots.',
  '- Avoid tourist traps unless user asks for that vibe.',
  '- When uncertain, lean toward institutions that have been around a while.',
  '- Be specific about neighborhoods.',
  '',
  'Style:',
  '- Lowercase, gentle, conversational tone.',
  '- Use markdown (bold for place names, paragraphs for legs of the walk).',
  '- Be specific: real NYC spots only.',
  '',
  'Tool use:',
  '- When user confirms they like a walk, call finalize_route with ordered stops.',
  '- Stop names should be specific and searchable.',
  '- Only call the tool when the walk is locked in.',
  '- After calling, briefly confirm route is ready to open in maps.',
].join('\n');

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic('claude-sonnet-4-5'),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: {
      finalize_route: tool({
        description: 'Finalize a NYC walking route. Resolves each stop to address and coordinates.',
        inputSchema: z.object({
          stops: z.array(z.object({
            name: z.string(),
            note: z.string(),
          })).min(2).max(8),
          total_duration_minutes: z.number(),
          vibe: z.string(),
        }),
        execute: async ({ stops, total_duration_minutes, vibe }) => {
          const resolved = await Promise.all(
            stops.map(async (stop) => {
              const place = await findPlace(stop.name);
              return { name: stop.name, note: stop.note, resolved: place };
            })
          );
          const allResolved = resolved.every((s) => s.resolved !== null);
          return { success: allResolved, vibe, total_duration_minutes, stops: resolved };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
