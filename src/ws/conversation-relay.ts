import WebSocket from 'ws';
import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

function loadSystemPrompt(): string {
  return fs.readFileSync(
    path.join(process.cwd(), 'prompts', 'system-prompt.md'),
    'utf-8'
  );
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function handleConversationRelay(ws: WebSocket): void {
  // Client created inside function so each session gets a fresh instance (required for testability)
  const openai = new OpenAI({ apiKey: config.openai.apiKey });
  const history: ChatMessage[] = [];

  ws.on('message', async (data: Buffer) => {
    let msg: { type: string; voicePrompt?: string };
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (msg.type !== 'prompt' || !msg.voicePrompt) return;

    history.push({ role: 'user', content: msg.voicePrompt });

    try {
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: loadSystemPrompt() },
          ...history,
        ],
        stream: true,
      });

      let fullResponse = '';
      for await (const chunk of stream) {
        fullResponse += chunk.choices[0]?.delta?.content ?? '';
      }

      const shouldTransfer = fullResponse.includes('[TRANSFER]');
      const clean = fullResponse.replace('[TRANSFER]', '').trim();
      history.push({ role: 'assistant', content: clean });

      const words = clean.split(/\s+/).filter(Boolean);
      for (let i = 0; i < words.length; i++) {
        ws.send(JSON.stringify({ type: 'text', token: words[i], last: i === words.length - 1 }));
      }

      if (shouldTransfer) {
        ws.send(JSON.stringify({ type: 'end', handoffData: '{}' }));
      }
    } catch (err) {
      console.error('ConversationRelay OpenAI error:', err);
      ws.send(JSON.stringify({ type: 'end', handoffData: '{}' }));
    }
  });
}
