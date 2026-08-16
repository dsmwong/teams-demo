# Teams Demo

A live demo app showing an end-to-end AI-assisted call flow that connects callers through a conversational AI banking agent to a Microsoft Teams specialist, with automatic fallback to a Flex contact centre agent.

## What it does

1. **Caller dials in** — via browser Voice SDK, PSTN phone number, or WhatsApp Voice
2. **AI agent greets and qualifies** — ConversationRelay + OpenAI GPT-4o, ElevenLabs TTS, Deepgram ASR (Australian English)
3. **Transfers to Teams** — dials the configured Teams number with a 10-second timeout
4. **Falls back to Flex** — if Teams doesn't answer, plays an audio message then A2A transfers to a Flex contact centre in a separate account

A browser UI displays a Voice SDK dialler alongside a **Live Activity panel** showing call events, TwiML, and conversation transcripts in real time — filterable per call.

```
Caller (Voice SDK / PSTN / WhatsApp)
  → Twilio phone number → /inbound
  → ConversationRelay (OpenAI GPT-4o + ElevenLabs + Deepgram)
  → Teams dial (10 s timeout)
       ├─ answered → call connected
       └─ no answer → Polly.Olivia-Neural message → Flex A2A
```

## Architecture

Single **Node.js / TypeScript / Express** server deployed on [Fly.io](https://fly.io).

| Path | Purpose |
|---|---|
| `POST /inbound` | TwiML webhook for inbound calls — returns greeting + ConversationRelay |
| `POST /action` | Called when CR session ends — returns Teams `<Dial>` TwiML |
| `POST /dial-action` | Called on Teams timeout — plays message then A2A transfers to Flex |
| `GET /token` | Returns a Twilio Access Token for the Voice SDK browser client |
| `POST /login` | Sets a session cookie for the demo UI |
| `GET /log-stream` | Server-Sent Events stream for the Live Activity panel |
| `POST /whatsapp-inbound` | Webhook for the external WhatsApp/Flex account — returns A2A TwiML |
| `WebSocket /cr` | ConversationRelay bridge to OpenAI |

## Prerequisites

- Node.js 22 (`nvm use` — version is pinned in `.nvmrc`)
- [pnpm](https://pnpm.io) — `npm install -g pnpm`
- A [Twilio account](https://www.twilio.com) with [ConversationRelay access](https://console.twilio.com/us1/voice/conversation-relay)
- An [OpenAI API key](https://platform.openai.com)
- An [ElevenLabs voice ID](https://elevenlabs.io) (or remove the `CR_*` vars to use Twilio defaults)
- A separate Twilio account with Flex enabled (for the fallback)
- [Fly.io CLI](https://fly.io/docs/hands-on/install-flyctl/) — `fly auth login`

## Setup

```bash
git clone https://github.com/dsmwong/teams-demo.git
cd teams-demo
nvm use          # switches to Node 22
pnpm install
cp .env.example .env
# fill in .env — see Configuration section below
```

## Local development

```bash
pnpm dev         # starts ts-node server on http://localhost:3000
```

For Twilio webhooks to reach localhost you'll need a tunnel (e.g. ngrok). Point your Twilio phone number and TwiML App Voice URL to `https://<tunnel>/inbound`.

## Running tests

```bash
pnpm test        # runs all 34 Jest tests
pnpm test:watch  # watch mode
```

## Deployment (Fly.io)

### First time

```bash
pnpm fly:init      # creates the Fly.io app (once)
pnpm fly:secrets   # pushes all .env values as secrets
pnpm fly:deploy    # builds Docker image and deploys
```

Or in one command:

```bash
pnpm fly:setup     # init + secrets + deploy
```

### Subsequent deploys

```bash
pnpm fly:deploy    # redeploy after code changes
pnpm fly:secrets   # re-run after changing .env values, then deploy
```

### Other commands

```bash
pnpm fly:logs      # stream live logs
pnpm fly:open      # open deployed URL in browser
pnpm fly:status    # machine / deployment status
```

## Twilio setup

After deploying, configure your Twilio resources to point at `https://teams-demo.fly.dev`:

### Phone number

In the [Twilio Console](https://console.twilio.com) → Phone Numbers → your number:
- **A call comes in** → Webhook → `https://teams-demo.fly.dev/inbound` (POST)

### TwiML App (Voice SDK)

Console → Voice → TwiML Apps → create or update:
- **Voice Request URL** → `https://teams-demo.fly.dev/inbound` (POST)
- Copy the **SID** into `TWILIO_TWIML_APP_SID` in your `.env`

Both resources are created automatically if you run the provided setup scripts in the project. Check `CLAUDE.md` for the exact CLI commands.

## WhatsApp / external account setup

See [`docs/whatsapp-flex-setup.md`](docs/whatsapp-flex-setup.md) for instructions on connecting a WhatsApp Voice call from an external Flex/WhatsApp Twilio account.

The webhook URL to configure is:

```
https://teams-demo.fly.dev/whatsapp-inbound
```

This URL is also shown in the demo UI after login (with a copy button).

## Using the demo

1. Open `https://teams-demo.fly.dev` and log in with your `DEMO_PASSWORD`
2. The **Voice SDK Client** (left panel) shows the demo phone number, WhatsApp number, and a Voice SDK dialler
3. The **Live Activity panel** (right) shows real-time call events — use the dropdown to filter by caller when multiple calls are active
4. Click the green phone button to place a call via the browser, or dial the PSTN/WhatsApp numbers directly

## Configuration

All configuration lives in `.env`. See [`.env.example`](.env.example) for full documentation of every variable. Key groups:

| Group | Variables |
|---|---|
| Twilio credentials | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY`, `TWILIO_API_SECRET` |
| Phone numbers | `TWILIO_PHONE_NUMBER`, `TWILIO_TWIML_APP_SID` |
| Teams | `TEAMS_NUMBER`, `TEAMS_DIAL_TIMEOUT` |
| Flex fallback | `FLEX_ACCOUNT_SID`, `FLEX_APPLICATION_SID`, `FLEX_TRANSFER_MESSAGE`, `FLEX_TRANSFER_VOICE` |
| OpenAI | `OPENAI_API_KEY` |
| ConversationRelay voice | `CR_TTS_PROVIDER`, `CR_VOICE`, `CR_LANGUAGE`, `CR_TRANSCRIPTION_PROVIDER`, `CR_SPEECH_MODEL` |
| Demo | `GREETING_MESSAGE`, `DEMO_PASSWORD`, `HOST` |
| WhatsApp | `WHATSAPP_A2A_APP_SID`, `WHATSAPP_PHONE_NUMBER` |

## Agent persona

The AI agent's behaviour is defined in [`prompts/system-prompt.md`](prompts/system-prompt.md). Edit this file to change the agent's context, script, or language — changes take effect on the next call without redeploying.

The agent signals transfer intent by including `[TRANSFER]` at the end of its final response. The server strips this token before sending the text to TTS and then sends `{type:"end"}` to ConversationRelay, which triggers the Teams dial.

## Tech stack

| | |
|---|---|
| Runtime | Node.js 22, TypeScript 5 |
| Framework | Express 4, ws 8 |
| AI | OpenAI GPT-4o via ConversationRelay |
| TTS | ElevenLabs (via Twilio ConversationRelay) |
| ASR | Deepgram nova-2-general (via Twilio ConversationRelay) |
| Testing | Jest + ts-jest + supertest |
| Deployment | Fly.io (Sydney region) |
| Package manager | pnpm |
