# WhatsApp / Flex Account A2A Setup

To route a WhatsApp Voice call from your Flex/WhatsApp account into the Teams Demo:

## What you need from the demo account

- `TWILIO_PHONE_NUMBER` — the demo E.164 number (from your demo `.env`)

## Steps in the Flex/WhatsApp account

1. Log in to the [Twilio Console](https://console.twilio.com) for the **Flex/WhatsApp account**.

2. Create a TwiML Bin (or configure a TwiML App) with the following content:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Number>+1XXXXXXXXXX</Number>
  </Dial>
</Response>
```

Replace `+1XXXXXXXXXX` with the demo account's `TWILIO_PHONE_NUMBER`.

3. Assign this TwiML Bin/App to the WhatsApp sender or phone number in the Flex account you will call from.

## How it works

The WhatsApp Voice call is forwarded to the demo phone number via PSTN. The demo server handles everything from that point — greeting, AI agent, Teams transfer, and Flex fallback all run identically to the Voice SDK client path.

The demo server has no WhatsApp-specific code.
