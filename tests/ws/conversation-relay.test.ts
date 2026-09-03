import WebSocket from 'ws';

// Must be before any imports from src/
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('You are a banking assistant.'),
}));

jest.mock('twilio', () => {
  return jest.fn().mockReturnValue({
    verify: {
      v2: {
        services: jest.fn().mockReturnValue({
          verifications: {
            create: jest.fn().mockResolvedValue({ status: 'pending' }),
          },
          verificationChecks: {
            create: jest.fn().mockResolvedValue({ status: 'approved' }),
          },
        }),
      },
    },
  });
});

// Mock customer-config to return a test customer
jest.mock('../../src/customer-config', () => ({
  getCustomerConfig: jest.fn().mockReturnValue({
    name: 'Dan',
    mobile: '+61412345678',
    accountType: 'Business Savings',
    accountLastFour: '1234',
  }),
}));

jest.mock('openai', () => {
  const makeTextResponse = (content: string) => ({
    choices: [{
      finish_reason: 'stop',
      message: { role: 'assistant', content, tool_calls: undefined },
    }],
  });

  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue(
            makeTextResponse('I will transfer you now. [TRANSFER]')
          ),
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

  it('sends text tokens and transfer end message when agent includes [TRANSFER]', async () => {
    const { ws, sent, handlers } = makeMockWs();
    handleConversationRelay(ws);
    await handlers['message'](Buffer.from(JSON.stringify({ type: 'setup', callSid: 'CA123' })));
    await handlers['message'](Buffer.from(JSON.stringify({ type: 'prompt', voicePrompt: 'Hello' })));

    const parsed = sent.map(s => JSON.parse(s));
    expect(parsed.some(m => m.type === 'text')).toBe(true);
    const endMsg = parsed.find(m => m.type === 'end');
    expect(endMsg).toBeDefined();
    expect(JSON.parse(endMsg.handoffData).reason).toBe('transfer');
  });

  it('sends verify_failed end message when agent includes [VERIFY_FAILED]', async () => {
    const { OpenAI } = require('openai');
    (OpenAI as jest.Mock).mockImplementationOnce(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{
              finish_reason: 'stop',
              message: { role: 'assistant', content: 'Sorry, cannot verify you. [VERIFY_FAILED]', tool_calls: undefined },
            }],
          }),
        },
      },
    }));

    const { ws, sent, handlers } = makeMockWs();
    handleConversationRelay(ws);
    await handlers['message'](Buffer.from(JSON.stringify({ type: 'setup', callSid: 'CA456' })));
    await handlers['message'](Buffer.from(JSON.stringify({ type: 'prompt', voicePrompt: 'test' })));

    const parsed = sent.map(s => JSON.parse(s));
    const endMsg = parsed.find(m => m.type === 'end');
    expect(endMsg).toBeDefined();
    expect(JSON.parse(endMsg.handoffData).reason).toBe('verify_failed');
  });

  it('ignores non-prompt message types without sending anything', async () => {
    const { ws, sent, handlers } = makeMockWs();
    handleConversationRelay(ws);
    await handlers['message'](Buffer.from(JSON.stringify({ type: 'setup', callSid: 'CA789' })));
    await handlers['message'](Buffer.from(JSON.stringify({ type: 'interrupt' })));
    expect(sent).toHaveLength(0);
  });
});
