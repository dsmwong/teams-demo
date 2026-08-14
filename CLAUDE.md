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
# First time — creates app, uploads secrets from .env, deploys
pnpm fly:setup

# Or step by step:
pnpm fly:init      # create the Fly.io app (once)
pnpm fly:secrets   # push all .env values as secrets (re-run after .env changes)
pnpm fly:deploy    # build and deploy

# Day-to-day
pnpm fly:deploy    # redeploy after code changes
pnpm fly:logs      # stream logs
pnpm fly:open      # open the deployed URL
pnpm fly:status    # check machine/deployment status
```

Requires the [Fly.io CLI](https://fly.io/docs/hands-on/install-flyctl/) and `fly auth login`.

Health check: `GET /health` → `{"status":"ok"}`

## WhatsApp / Flex setup

See `docs/whatsapp-flex-setup.md` for configuring the Flex/WhatsApp account to A2A-transfer calls into this demo.
