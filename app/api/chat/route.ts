import { anthropic } from '@ai-sdk/anthropic';
import { streamText, convertToModelMessages, UIMessage } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic('claude-sonnet-4-5'),
    system: `You are a NYC walk planner. You help users plan walking routes through Manhattan with stops at bars, restaurants, and cafes. For now, respond conversationally — you'll get tools to find real places in a future version. Be specific and concrete with neighborhood recommendations. Use your knowledge of NYC to suggest real, well-known spots.`,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}