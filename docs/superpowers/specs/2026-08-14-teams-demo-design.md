# Teams Demo — Design Spec

**Date:** 2026-08-14  
**Status:** Approved  

---

## Context

This is a demo application showing an end-to-end call flow from a browser-based Voice SDK client (or WhatsApp via a separate Flex account) through a Conversation Relay AI agent into Microsoft Teams, with automatic fallback to a Flex contact centre agent if Teams doesn't answer.

The primary audience is a live on-stage demo. The app must be reliable, simple to operate, and light-themed for presentation.

---

## Call Flow

```
Voice SDK (browser)          WhatsApp (Flex/WA account — A2A config only)
        │                                   │
        └──────────────┬────────────────────┘
                       ↓
           Demo Phone Number (this account)
           Webhook → POST /inbound
                       ↓
           Express Server — /inbound
           TwiML: <Say> greeting + <Connect><ConversationRelay url="wss://…/cr">
                       ↓
           ConversationRelay WebSocket (/cr)
           OpenAI agent (business bank context)
           System prompt from prompts/system-prompt.md
           Fakes calendar availability in-prompt (no tool calls)
                       ↓ agent announces availability, sends {type:"end"}
           Express Server — /action
           TwiML: <Dial timeout="30" action="/dial-action"><Teams>+E.164</Teams></Dial>
                  ↙                              ↘
      Teams answers                         Timeout (30s)
      Call connected                        Express Server — /dial-action
      Demo complete                         TwiML: <Dial><Application applicationSid="AP_FLEX"/></Dial>
                                                   ↓
                                            Flex agent answers
```

---

## Architecture

**Single Express + ws service deployed on Fly.io.**  
Handles HTTP (TwiML webhooks + static UI) and WebSocket (ConversationRelay) in one process.

---

## File Structure

```
teams-demo/
├── src/
│   ├── server.ts                  # Express app + WebSocket upgrade for /cr
│   ├── config.ts                  # Typed .env loader — fails fast on missing vars
│   ├── routes/
│   │   ├── inbound.ts             # POST /inbound — greeting + CR TwiML
│   │   ├── action.ts              # POST /action — Teams dial TwiML
│   │   ├── dial-action.ts         # POST /dial-action — Flex A2A fallback TwiML
│   │   └── token.ts               # GET /token — Twilio Access Token for Voice SDK
│   ├── ws/
│   │   └── conversation-relay.ts  # WebSocket handler, CR ↔ OpenAI bridge
│   └── middleware/
│       └── auth.ts                # Password check — protects /token + UI page
├── prompts/
│   └── system-prompt.md           # CR agent persona — edit without redeploying
├── public/
│   └── index.html                 # Voice SDK client UI (light theme)
├── tests/
│   ├── routes/                    # Unit tests per route
│   └── ws/                        # Unit tests for CR WebSocket handler
├── fly.toml
├── Dockerfile
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Components

### `src/config.ts`
Loads all env vars at startup. If any required var is missing, throws with a clear message before the server binds. Exports a typed `config` object used throughout the app.

### `src/routes/inbound.ts`
Handles `POST /inbound` from Twilio when a call arrives on the demo number.  
Returns TwiML:
```xml
<Response>
  <Say>{{GREETING_MESSAGE}}</Say>
  <Connect>
    <ConversationRelay url="wss://{{HOST}}/cr"/>
  </Connect>
</Response>
```

### `src/routes/action.ts`
Handles `POST /action` — called by Twilio when ConversationRelay ends.  
Returns TwiML:
```xml
<Response>
  <Dial timeout="30" action="/dial-action">
    <Teams>{{TEAMS_NUMBER}}</Teams>
  </Dial>
</Response>
```

### `src/routes/dial-action.ts`
Handles `POST /dial-action` — called by Twilio when the Teams `<Dial>` times out or fails.  
Returns TwiML:
```xml
<Response>
  <Dial>
    <Application applicationSid="{{FLEX_APPLICATION_SID}}"/>
  </Dial>
</Response>
```
If that dial also fails, returns:
```xml
<Response>
  <Say>Sorry, no agents are available right now. Please try again later.</Say>
</Response>
```

### `src/routes/token.ts`
Handles `GET /token` — returns a Twilio Access Token (Voice grant) for the Voice SDK client.  
Protected by auth middleware. Token identity is a fixed demo caller identity.

### `src/ws/conversation-relay.ts`
Handles the WebSocket connection from Twilio ConversationRelay.  
- Reads `prompts/system-prompt.md` on each new session
- Streams turns to OpenAI Chat Completions (GPT-4o)
- When the agent decides to transfer, sends `{ "type": "end", "handoffData": "{}" }` to Twilio
- On OpenAI error: logs the error and sends `{ "type": "end" }` to proceed to transfer

### `src/middleware/auth.ts`
Simple password middleware. Checks a session cookie against `DEMO_PASSWORD` from config.  
Protects: `GET /` (UI page) and `GET /token`.

### `public/index.html`
Single-page Voice SDK client. Light theme, no build step.  
**States:**
- **Idle** — green dial button, "SDK Ready" indicator
- **Connecting** — spinner, status badge updates
- **Greeting / Talking to AI agent / Transferring to Teams** — status badge progresses
- **In call with Teams** — red hang-up button
- **Call ended / Error** — reset to idle with message

**Status badge progression:**  
`Idle → Connecting… → Greeting → Talking to AI agent… → Transferring to Teams… → In call with Teams → Call ended`

### `prompts/system-prompt.md`
Agent persona for the ConversationRelay session. Initial context: business bank account.  
Instructs the agent to:
- Greet the caller, ask for their name and nature of their enquiry
- Fake a calendar lookup by generating a plausible near-future availability (e.g. "John is available tomorrow at 2pm")
- Announce the availability and tell the caller they are being transferred
- End the session

This file is read at runtime — edit and the next call picks up the change without redeploying.

---

## Environment Variables

| Variable | Description |
|---|---|
| `TWILIO_ACCOUNT_SID` | Demo account SID |
| `TWILIO_AUTH_TOKEN` | Demo account Auth Token |
| `TWILIO_API_KEY` | API Key SID (for Voice SDK token) |
| `TWILIO_API_SECRET` | API Key Secret |
| `TWILIO_PHONE_NUMBER` | Demo inbound phone number (E.164) |
| `TWILIO_TWIML_APP_SID` | TwiML App SID for Voice SDK |
| `TEAMS_NUMBER` | Microsoft Teams E.164 number to dial |
| `FLEX_ACCOUNT_SID` | Flex account SID (for A2A reference) |
| `FLEX_APPLICATION_SID` | TwiML Application SID in the Flex account |
| `OPENAI_API_KEY` | OpenAI API key for ConversationRelay |
| `GREETING_MESSAGE` | TTS greeting (e.g. "Welcome to Teams demo") |
| `DEMO_PASSWORD` | Password for UI and token endpoint |
| `HOST` | Public hostname of this service (e.g. teams-demo.fly.dev) |

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Missing env var at startup | `config.ts` throws with the missing var name — app never starts |
| OpenAI error mid-CR session | Log error, send `{type:"end"}` — call proceeds to Teams transfer |
| Teams dial timeout (30s) | Twilio calls `/dial-action` automatically — Flex A2A attempted |
| Flex A2A fails | Return `<Say>` apology and hang up |
| Voice SDK error | Display error state in UI, reset button to idle |

---

## Testing

**Framework:** Jest + ts-jest

| Test | Approach |
|---|---|
| `routes/inbound` | Mock Twilio POST, assert TwiML contains `<ConversationRelay>` |
| `routes/action` | Assert TwiML contains `<Teams>` with correct number and timeout |
| `routes/dial-action` | Assert TwiML contains `<Application>` with Flex SID |
| `routes/token` | Assert Access Token returned; assert 401 without password |
| `ws/conversation-relay` | Mock WS + OpenAI; assert correct message flow and `{type:"end"}` on transfer intent |
| `config` | Assert throws with clear message for each missing required var |
| `middleware/auth` | Assert 401 on wrong password, 200 on correct |

Tests are written before implementation (TDD). Each route file has a corresponding test file in `tests/routes/`.

---

## Deployment

Single Fly.io service. `fly.toml` exposes port 3000. `Dockerfile` uses Node 22 (matches `.nvmrc`).

Secrets set via `fly secrets set KEY=VALUE` — not committed to the repo.

---

## WhatsApp / Flex Account Setup Guide

To route a WhatsApp Voice call from the Flex/WhatsApp account into this demo:

1. In the Flex/WhatsApp account, create a TwiML App (or use an existing Studio Flow)
2. Configure it to return the following TwiML when a WhatsApp voice call arrives:
   ```xml
   <Response>
     <Dial>
       <Application applicationSid="{{THIS_DEMO_TWIML_APP_SID}}"/>
     </Dial>
   </Response>
   ```
   Where `{{THIS_DEMO_TWIML_APP_SID}}` is the TwiML App SID from this demo account (the one that points to `/inbound`).
3. This routes the inbound call into this demo account's flow — the rest of the demo proceeds identically to the Voice SDK path.

> **Note:** The demo server itself requires no WhatsApp-specific code or configuration.
