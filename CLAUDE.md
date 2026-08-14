# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # start dev server (ts-node)
pnpm build        # compile TypeScript → dist/
pnpm start        # run compiled server
pnpm test         # run all tests (Jest)
pnpm test:watch   # run tests in watch mode
```

## Architecture

Single Express + WebSocket server (TypeScript) deployed on Fly.io.

- **Entry point:** `src/server.ts` — mounts all routes, handles WebSocket upgrade for `/cr`
- **TwiML webhooks:** `src/routes/` — `inbound` (greeting + CR), `action` (Teams dial), `dial-action` (Flex fallback), `token` (Voice SDK), `login` (auth cookie)
- **ConversationRelay:** `src/ws/conversation-relay.ts` — bridges Twilio CR WebSocket to OpenAI GPT-4o; detects `[TRANSFER]` token to trigger call transfer
- **Auth:** cookie-based (`demo_auth`); `src/middleware/auth.ts` protects `/token`
- **UI:** `public/index.html` — static single-page Voice SDK client (light theme)
- **Agent persona:** `prompts/system-prompt.md` — edit freely in local dev; in production the file is baked into the container image so a `fly deploy` is needed after changes

## Environment variables

All required vars listed in `.env.example`. Set via `fly secrets set` for production; copy `.env.example` → `.env` for local dev.

## Deployment

```bash
fly secrets set KEY=VALUE ...
fly deploy
```

Health check: `GET /health` → `{"status":"ok"}`

## WhatsApp / Flex setup

See `docs/whatsapp-flex-setup.md` for configuring the Flex/WhatsApp account to A2A-transfer calls into this demo.
