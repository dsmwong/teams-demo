import WebSocket from 'ws';
import { OpenAI } from 'openai';
import Twilio from 'twilio';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import { emit } from '../events';
import { getCustomerConfig, CustomerConfig } from '../customer-config';

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'send_otp',
      description: "Send a 6-digit SMS verification code to the caller's registered mobile number.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_otp',
      description: 'Verify the code spoken by the caller.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'The digits spoken by the caller, e.g. "123456"' },
        },
        required: ['code'],
      },
    },
  },
];

/** Split text into sentences and send each as a TTS token to ConversationRelay. */
function sendText(ws: WebSocket, text: string): void {
  // Split on sentence boundaries, preserving punctuation with each sentence
  const sentences = text.match(/[^.!?]+[.!?]*/g)?.map(s => s.trim()).filter(Boolean) ?? [text];
  for (let i = 0; i < sentences.length; i++) {
    ws.send(JSON.stringify({ type: 'text', token: sentences[i], last: i === sentences.length - 1 }));
  }
}

function buildSystemPrompt(customer: CustomerConfig): string {
  const base = fs.readFileSync(
    path.join(process.cwd(), 'prompts', 'system-prompt.md'),
    'utf-8'
  );
  const ctx = `## Customer on file
- Name: ${customer.name || 'Unknown'}
- Mobile: ${customer.mobile || 'Not registered'} (last 4: ${customer.mobile?.slice(-4) || '????'})
- Account type: ${customer.accountType || 'Unknown'}
- Account ending in: ${customer.accountLastFour || 'Unknown'}

`;
  return ctx + base;
}

async function executeTool(
  tc: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
  customer: CustomerConfig,
  attempts: number,
  setAttempts: (n: number) => void,
  callSid: string | undefined
): Promise<string> {
  const twilioClient = Twilio(config.twilio.accountSid, config.twilio.authToken);

  if (tc.function.name === 'send_otp') {
    try {
      await twilioClient.verify.v2
        .services(config.verify.serviceSid!)
        .verifications.create({ to: customer.mobile, channel: 'sms' });
      emit('cr', `OTP sent to ...${customer.mobile?.slice(-4)}`, undefined, callSid);
      return `Verification code sent to the number ending in ${customer.mobile?.slice(-4)}.`;
    } catch (err) {
      emit('error', `send_otp failed: ${(err as Error).message}`, undefined, callSid);
      return 'failed to send verification code — apologise to the caller and end with [VERIFY_FAILED].';
    }
  }

  if (tc.function.name === 'check_otp') {
    try {
      const args = JSON.parse(tc.function.arguments) as { code: string };
      const check = await twilioClient.verify.v2
        .services(config.verify.serviceSid!)
        .verificationChecks.create({ to: customer.mobile, code: args.code });

      if (check.status === 'approved') {
        emit('cr', 'OTP verified ✓', undefined, callSid);
        return 'approved';
      }

      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      emit('error', `OTP incorrect (attempt ${newAttempts}/2)`, undefined, callSid);

      if (newAttempts >= 2) {
        return 'failed — maximum attempts reached. Apologise to the caller and end with [VERIFY_FAILED].';
      }
      return `incorrect — ${2 - newAttempts} attempt(s) remaining. Ask the caller to try again.`;
    } catch (err) {
      emit('error', `check_otp failed: ${(err as Error).message}`, undefined, callSid);
      return 'failed to check verification code — apologise to the caller and end with [VERIFY_FAILED].';
    }
  }

  return 'unknown tool';
}

async function runAgentLoop(
  openai: OpenAI,
  history: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  customer: CustomerConfig,
  ws: WebSocket,
  callSid: string | undefined,
  attempts: number,
  setAttempts: (n: number) => void
): Promise<void> {
  while (true) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: buildSystemPrompt(customer) },
        ...history,
      ],
      tools: TOOLS,
    });

    const choice = response.choices[0];

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      // Push the raw assistant message with tool_calls so OpenAI knows which calls were made
      history.push(choice.message as OpenAI.Chat.Completions.ChatCompletionMessageParam);
      for (const tc of choice.message.tool_calls) {
        const result = await executeTool(tc, customer, attempts, setAttempts, callSid);
        history.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result,
        });
      }
      continue; // loop back to get agent's next response
    }

    // Text response — push the cleaned message (no control tokens in history)
    const fullResponse = choice.message.content ?? '';
    const shouldTransfer     = fullResponse.includes('[TRANSFER]');
    const shouldVerifyFailed = fullResponse.includes('[VERIFY_FAILED]');
    const clean = fullResponse.replace('[TRANSFER]', '').replace('[VERIFY_FAILED]', '').trim();

    history.push({ role: 'assistant', content: clean });
    emit('ai', `Agent: "${clean.length > 120 ? clean.slice(0, 120) + '…' : clean}"`, undefined, callSid);

    sendText(ws, clean);

    if (shouldTransfer) {
      emit('transfer', 'Agent triggering transfer to Teams', undefined, callSid);
      ws.send(JSON.stringify({ type: 'end', handoffData: JSON.stringify({ reason: 'transfer' }) }));
    } else if (shouldVerifyFailed) {
      emit('transfer', 'Verification failed — routing to Flex', undefined, callSid);
      ws.send(JSON.stringify({ type: 'end', handoffData: JSON.stringify({ reason: 'verify_failed' }) }));
    }
    return;
  }
}

export function handleConversationRelay(ws: WebSocket): void {
  console.log('[CR] WebSocket connected');
  emit('cr', 'ConversationRelay connected');
  const openai = new OpenAI({ apiKey: config.openai.apiKey });
  const history: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  let callSid: string | undefined;
  let customer: CustomerConfig = { name: '', mobile: '', accountType: '', accountLastFour: '' };
  let verificationAttempts = 0;

  ws.on('close', (code, reason) => {
    console.log(`[CR] WebSocket closed code=${code} reason=${reason.toString()}`);
  });

  ws.on('message', async (data: Buffer) => {
    let msg: { type: string; voicePrompt?: string; callSid?: string };
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    console.log(`[CR] message type=${msg.type}${msg.type === 'prompt' ? ` voice="${msg.voicePrompt}"` : ''}`);

    if (msg.type === 'setup') {
      callSid  = msg.callSid;
      customer = getCustomerConfig(); // snapshot at session start
      emit('cr', `Setup — CallSid: ${callSid ?? 'unknown'}`, undefined, callSid);
      return;
    }

    if (msg.type !== 'prompt' || !msg.voicePrompt) return;

    // Guard: if no customer mobile is configured we can't verify — route to Flex immediately
    if (!customer.mobile?.trim()) {
      emit('transfer', 'Customer not configured — routing to Flex', undefined, callSid);
      const notRecognised = "I'm sorry, I don't recognise the number you're calling from. Let me transfer you to our associate team who will be happy to help.";
      sendText(ws, notRecognised);
      ws.send(JSON.stringify({ type: 'end', handoffData: JSON.stringify({ reason: 'verify_failed' }) }));
      return;
    }

    emit('cr', `Caller: "${msg.voicePrompt}"`, undefined, callSid);
    history.push({ role: 'user', content: msg.voicePrompt });

    try {
      await runAgentLoop(
        openai, history, customer, ws, callSid,
        verificationAttempts,
        (n) => { verificationAttempts = n; }
      );
    } catch (err) {
      console.error('ConversationRelay error:', err);
      emit('error', `CR error: ${(err as Error).message}`, undefined, callSid);
      const sorry = "I'm sorry, there was a technical issue. Let me transfer you to our associate team who will be happy to help.";
      sendText(ws, sorry);
      ws.send(JSON.stringify({ type: 'end', handoffData: JSON.stringify({ reason: 'verify_failed' }) }));
    }
  });
}
