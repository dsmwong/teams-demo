# Teams Demo

A live stage demo app showing an end-to-end AI-assisted call flow: caller identity verification via OTP, a conversational AI banking agent, transfer to a Microsoft Teams specialist via Operator Connect, and automatic fallback to a Flex contact centre.

## What it does

1. **Caller dials in** — via browser Voice SDK, PSTN phone number, or WhatsApp Voice
2. **Identity verification** — ConversationRelay AI agent greets the caller by name, sends a 6-digit SMS code via Twilio Verify, and confirms identity before proceeding
3. **AI agent qualifies** — takes the banking enquiry, fakes a calendar check, announces a time slot
4. **Transfers to Teams** — dials the configured Teams number (via Twilio Operator Connect) with a configurable timeout
5. **Falls back to Flex** — if Teams doesn't answer, plays an audio message then A2A transfers to a Flex contact centre in a separate account

A browser UI shows a Voice SDK dialler, a **Live Activity panel** with real-time call events and conversation transcripts (filterable per call), and an **architecture diagram** modal for stage presentation.

```
Caller (Voice SDK / PSTN / WhatsApp)
  → Twilio phone number → /inbound
  → ConversationRelay (OpenAI GPT-4o + ElevenLabs TTS + Deepgram ASR en-AU)
      ├─ Identity check: Twilio Verify SMS OTP (max 2 attempts)
      │    └─ unrecognised / fail → Flex A2A
      └─ Verified → enquiry → calendar → Teams transfer
           ├─ answered → call connected (Twilio Operator Connect)
           └─ timeout  → Polly.Olivia-Neural message → Flex A2A

Direct path (Operator Connect):
  Caller dials Teams number directly → Microsoft Teams → specialist
  (no Twilio programmability — carrier-grade PSTN)
```

## Architecture

Single **Node.js / TypeScript / Express** server deployed on [Fly.io](https://fly.io).

| Path | Purpose |
|---|---|
| `POST /inbound` | TwiML webhook for inbound calls — greeting + ConversationRelay |
| `POST /action` | Called when CR session ends — routes to Teams dial or Flex based on `HandoffData.reason` |
| `POST /dial-action` | Called on Teams timeout — plays message then A2A transfers to Flex |
| `GET /token` | Returns a Twilio Access Token + customer details for the Voice SDK browser client |
| `POST /login` | Sets a session cookie for the demo UI |
| `GET /customer-config` | Returns current "customer on file" details (auth-protected) |
| `POST /customer-config` | Updates "customer on file" details (auth-protected) |
| `GET /log-stream` | Server-Sent Events stream for the Live Activity panel |
| `POST /whatsapp-inbound` | Webhook for the external WhatsApp/Flex account — returns A2A TwiML |
| `WebSocket /cr` | ConversationRelay bridge to OpenAI (with Verify tool calling) |

## Prerequisites

- Node.js 22 (`nvm use` — version pinned in `.nvmrc`)
- [pnpm](https://pnpm.io) — `npm install -g pnpm`
- A [Twilio account](https://www.twilio.com) with:
  - [ConversationRelay access](https://console.twilio.com/us1/voice/conversation-relay)
  - [ElevenLabs TTS enabled](https://console.twilio.com/us1/voice/conversation-relay) (for the agent voice)
  - A [Verify Service](https://console.twilio.com/us1/verify/services) for SMS OTP
- An [OpenAI API key](https://platform.openai.com)
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
pnpm test        # runs all Jest tests
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

### Verify Service

Console → Verify → Services → create:
- Copy the **SID** (starts with `VA`) into `VERIFY_SERVICE_SID` in your `.env`

Both the TwiML App and Verify Service are created automatically by the provided setup scripts. Check `CLAUDE.md` for the exact CLI commands.

## WhatsApp / external account setup

See [`docs/whatsapp-flex-setup.md`](docs/whatsapp-flex-setup.md) for instructions on connecting a WhatsApp Voice call from an external Flex/WhatsApp Twilio account.

The webhook URL to configure is:

```
https://teams-demo.fly.dev/whatsapp-inbound
```

This URL is shown in the demo UI after login with a one-click copy button.

## Using the demo

### Before presenting

1. Open `https://teams-demo.fly.dev` and log in with your `DEMO_PASSWORD`
2. Click the **Customer Config** button (gear icon) in the dial card
3. Enter the "customer on file" details: name, mobile number, account type, last 4 digits
4. Click **Save** — these persist in your browser's `localStorage` and survive redeploys

### During the demo

- The **left panel** shows the Voice SDK dialler, demo phone number (for PSTN callers), WhatsApp number with QR code, and a copy button for the WhatsApp webhook URL
- The **right panel** shows the Live Activity log — all call events, TwiML, and conversation transcripts in real time. Use the dropdown to filter by caller when multiple calls are active.
- The **Architecture** button opens a two-column diagram showing the Operator Connect direct path (left) and the Twilio Programmable Voice path (right)
- Use the **mute button** (appears when a call is connected) to mute/unmute your microphone

### Call flow (Twilio path)

1. Caller dials in (Voice SDK, PSTN, or WhatsApp)
2. Agent greets caller by name and explains identity verification is required
3. Caller confirms → agent sends SMS OTP via Twilio Verify
4. Caller says the 6-digit code → agent verifies (max 2 attempts)
5. Verified → agent takes enquiry, announces a time slot, transfers to Teams
6. If Teams doesn't answer within the timeout → audio message → Flex fallback

### Unrecognised / error paths

| Scenario | What happens |
|---|---|
| Customer config not set (no mobile) | Agent: "I don't recognise your number" → Flex |
| OTP send/check API error | Agent apologises → Flex |
| 2 wrong OTP attempts | Agent apologises → Flex |
| Teams timeout | Polly.Olivia-Neural message → Flex |

## Configuration

All configuration lives in `.env`. See [`.env.example`](.env.example) for full documentation of every variable.

| Group | Variables |
|---|---|
| Twilio credentials | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY`, `TWILIO_API_SECRET` |
| Phone numbers | `TWILIO_PHONE_NUMBER`, `TWILIO_TWIML_APP_SID` |
| Teams | `TEAMS_NUMBER`, `TEAMS_DIAL_TIMEOUT` |
| Twilio Verify | `VERIFY_SERVICE_SID` |
| Flex fallback | `FLEX_ACCOUNT_SID`, `FLEX_APPLICATION_SID`, `FLEX_TRANSFER_MESSAGE`, `FLEX_TRANSFER_VOICE` |
| OpenAI | `OPENAI_API_KEY` |
| ConversationRelay voice | `CR_TTS_PROVIDER`, `CR_VOICE`, `CR_LANGUAGE`, `CR_TRANSCRIPTION_PROVIDER`, `CR_SPEECH_MODEL` |
| Conversation Intelligence | `CR_INTELLIGENCE_SERVICE_SID` |
| Demo | `GREETING_MESSAGE`, `DEMO_PASSWORD`, `HOST` |
| WhatsApp | `WHATSAPP_A2A_APP_SID`, `WHATSAPP_PHONE_NUMBER` |

## Agent persona

The AI agent's behaviour is defined in [`prompts/system-prompt.md`](prompts/system-prompt.md). Edit this file to change the agent's context, script, or persona — changes take effect on the next call without redeploying.

The agent uses two signals:
- `[TRANSFER]` — appended to the agent's final message to trigger the Teams dial
- `[VERIFY_FAILED]` — appended when verification fails, routes directly to Flex

The "customer on file" details (name, mobile, account type, last 4 digits) are injected dynamically at the start of the system prompt each session, based on what is set in the Customer Config panel.

## Tech stack

| | |
|---|---|
| Runtime | Node.js 22, TypeScript 5 |
| Framework | Express 4, ws 8 |
| AI | OpenAI GPT-4o via ConversationRelay (function calling) |
| TTS | ElevenLabs (via Twilio ConversationRelay) |
| ASR | Deepgram nova-2-general en-AU (via Twilio ConversationRelay) |
| Identity | Twilio Verify (SMS OTP) |
| Testing | Jest + ts-jest + supertest |
| Deployment | Fly.io (Sydney region, single machine) |
| Package manager | pnpm |
