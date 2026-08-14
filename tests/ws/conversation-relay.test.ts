import WebSocket from 'ws';

// Self-contained mock factory (no outer variable references — jest.mock is hoisted)
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('You are a banking assistant.'),
}));

jest.mock('openai', () => {
  const chunks = [
    { choices: [{ delta: { content: 'I can help with that. ' } }] },
    { choices: [{ delta: { content: 'Transferring you now. [TRANSFER]' } }] },
  ];
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            [Symbol.asyncIterator]: async function* () {
              for (const chunk of chunks) yield chunk;
            },
          }),
        },
      },
    })),
  };
});

import { handleConversationRelay } from '../../src/ws/conversation-relay';

describe('handleConversationRelay', () => {
  function makeMockWs() {
    const sent: string[] = [];
    const handlers: Record<string, Function> = {};
    const ws = {
      on:   jest.fn((ev: string, fn: Function) => { handlers[ev] = fn; }),
      send: jest.fn((data: string) => sent.push(data)),
    } as unknown as WebSocket;
    return { ws, sent, handlers };
  }

  it('sends text tokens and an end message when agent includes [TRANSFER]', async () => {
    const { ws, sent, handlers } = makeMockWs();
    handleConversationRelay(ws);

    await handlers['message'](
      Buffer.from(JSON.stringify({ type: 'prompt', voicePrompt: 'I need help' }))
    );

    const parsed = sent.map(s => JSON.parse(s));
    expect(parsed.some(m => m.type === 'text')).toBe(true);
    expect(parsed.some(m => m.last === true)).toBe(true);
    expect(parsed.filter(m => m.type === 'end')).toHaveLength(1);
    expect(parsed.filter(m => m.type === 'text').every(m => !String(m.token).includes('[TRANSFER]'))).toBe(true);
  });

  it('sends end message when OpenAI throws', async () => {
    const { OpenAI } = require('openai');
    (OpenAI as jest.Mock).mockImplementationOnce(() => ({
      chat: { completions: { create: jest.fn().mockRejectedValue(new Error('API error')) } },
    }));

    const { ws, sent, handlers } = makeMockWs();
    handleConversationRelay(ws);  // creates a new OpenAI instance — picks up mockImplementationOnce

    await handlers['message'](
      Buffer.from(JSON.stringify({ type: 'prompt', voicePrompt: 'test' }))
    );

    const parsed = sent.map(s => JSON.parse(s));
    expect(parsed.some(m => m.type === 'end')).toBe(true);
  });

  it('ignores non-prompt message types without sending anything', async () => {
    const { ws, sent, handlers } = makeMockWs();
    handleConversationRelay(ws);

    await handlers['message'](
      Buffer.from(JSON.stringify({ type: 'setup', callSid: 'CA123' }))
    );

    expect(sent).toHaveLength(0);
  });
});
