# WhatsApp / Flex Account A2A Setup

This guide explains how to connect a WhatsApp Voice call from your external Flex/WhatsApp Twilio account into the Teams Demo via Application-to-Application (A2A) transfer.

## How it works

```
WhatsApp caller
  → External Flex/WhatsApp account (Account B)
  → Webhook: https://teams-demo.fly.dev/whatsapp-inbound
  → Returns A2A TwiML → dials TwiML App in demo account (Account A)
  → Demo account routes to /inbound
  → Greeting → ConversationRelay AI → Teams transfer
```

## What you need from the demo account

| Value | Where to find it |
|---|---|
| `WHATSAPP_A2A_APP_SID` | In your demo `.env` — created during setup |
| Webhook URL | `https://teams-demo.fly.dev/whatsapp-inbound` |

The TwiML App (`WHATSAPP_A2A_APP_SID`) was created in the demo account with its Voice URL pointing to `https://teams-demo.fly.dev/inbound`. You can verify it in the Twilio Console under **Voice → TwiML Apps → Teams Demo - WhatsApp A2A Receiver**.

## Steps in the external Flex/WhatsApp account

1. Log in to the [Twilio Console](https://console.twilio.com) for **Account B** (your Flex/WhatsApp account).

2. Navigate to the WhatsApp sender or phone number that will be used to place test calls.

3. Set its **A call comes in** webhook (Voice URL) to:

   ```
   https://teams-demo.fly.dev/whatsapp-inbound
   ```

   HTTP method: **POST**

4. That's it. When Account B receives a WhatsApp Voice call, it will POST to the webhook URL above. The demo app responds with TwiML that A2A-transfers the call into the demo account's TwiML App, which routes to `/inbound` and starts the demo flow.

## What the TwiML looks like

The `/whatsapp-inbound` endpoint returns:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Application>
      <ApplicationSid>AP76c8f687e2bcc6929046a5d0646d2a1a</ApplicationSid>
    </Application>
  </Dial>
</Response>
```

## Troubleshooting

- **500 error from /whatsapp-inbound**: `WHATSAPP_A2A_APP_SID` is missing — run `pnpm fly:secrets && pnpm fly:deploy`.
- **Call connects but doesn't go through the demo flow**: Verify the TwiML App's Voice URL is `https://teams-demo.fly.dev/inbound` (POST).
- **The demo server has no WhatsApp-specific code** — both Voice SDK and WhatsApp paths converge at `/inbound` and follow the same flow.
