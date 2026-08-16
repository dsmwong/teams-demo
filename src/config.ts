import dotenv from 'dotenv';
dotenv.config();

const REQUIRED = [
  'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_API_KEY',
  'TWILIO_API_SECRET', 'TWILIO_PHONE_NUMBER', 'TWILIO_TWIML_APP_SID',
  'TEAMS_NUMBER', 'FLEX_ACCOUNT_SID', 'FLEX_APPLICATION_SID',
  'OPENAI_API_KEY', 'GREETING_MESSAGE', 'DEMO_PASSWORD', 'HOST',
] as const;

for (const key of REQUIRED) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const config = {
  twilio: {
    accountSid:  process.env.TWILIO_ACCOUNT_SID!,
    authToken:   process.env.TWILIO_AUTH_TOKEN!,
    apiKey:      process.env.TWILIO_API_KEY!,
    apiSecret:   process.env.TWILIO_API_SECRET!,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER!,
    twimlAppSid: process.env.TWILIO_TWIML_APP_SID!,
  },
  teams: {
    number:  process.env.TEAMS_NUMBER!,
    timeout: parseInt(process.env.TEAMS_DIAL_TIMEOUT ?? '10', 10),
  },
  whatsapp: {
    // TwiML App SID in this account that receives A2A transfers from the external WhatsApp account
    a2aAppSid: process.env.WHATSAPP_A2A_APP_SID,
  },
  flex: {
    accountSid:      process.env.FLEX_ACCOUNT_SID!,
    applicationSid:  process.env.FLEX_APPLICATION_SID!,
    transferMessage: process.env.FLEX_TRANSFER_MESSAGE
      ?? "I'm sorry, the specialist is currently unavailable. Let me transfer you to our associate team who will be happy to help.",
    transferVoice:   process.env.FLEX_TRANSFER_VOICE ?? 'Polly.Olivia',
  },
  openai: { apiKey: process.env.OPENAI_API_KEY! },
  greetingMessage: process.env.GREETING_MESSAGE!,
  demoPassword:    process.env.DEMO_PASSWORD!,
  host:            process.env.HOST!,
  port:            parseInt(process.env.PORT ?? '3000', 10),
  cr: {
    ttsProvider:           process.env.CR_TTS_PROVIDER,
    voice:                 process.env.CR_VOICE,
    language:              process.env.CR_LANGUAGE,
    transcriptionProvider: process.env.CR_TRANSCRIPTION_PROVIDER,
    speechModel:           process.env.CR_SPEECH_MODEL,
  },
};
