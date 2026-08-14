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
  teams:  { number: process.env.TEAMS_NUMBER! },
  flex: {
    accountSid:     process.env.FLEX_ACCOUNT_SID!,
    applicationSid: process.env.FLEX_APPLICATION_SID!,
  },
  openai: { apiKey: process.env.OPENAI_API_KEY! },
  greetingMessage: process.env.GREETING_MESSAGE!,
  demoPassword:    process.env.DEMO_PASSWORD!,
  host:            process.env.HOST!,
  port:            parseInt(process.env.PORT ?? '3000', 10),
};
