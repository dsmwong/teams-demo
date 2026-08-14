const REQUIRED_VARS = [
  'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_API_KEY',
  'TWILIO_API_SECRET', 'TWILIO_PHONE_NUMBER', 'TWILIO_TWIML_APP_SID',
  'TEAMS_NUMBER', 'FLEX_ACCOUNT_SID', 'FLEX_APPLICATION_SID',
  'OPENAI_API_KEY', 'GREETING_MESSAGE', 'DEMO_PASSWORD', 'HOST',
];

describe('config', () => {
  const original = { ...process.env };

  afterEach(() => {
    Object.keys(process.env).forEach(k => delete process.env[k]);
    Object.assign(process.env, original);
    jest.resetModules();
  });

  it('exports config with all values when env is complete', () => {
    const { config } = require('../src/config');
    expect(config.twilio.accountSid).toBe(process.env.TWILIO_ACCOUNT_SID);
    expect(config.teams.number).toBe(process.env.TEAMS_NUMBER);
    expect(config.greetingMessage).toBe(process.env.GREETING_MESSAGE);
  });

  REQUIRED_VARS.forEach(varName => {
    it(`throws containing "${varName}" when it is missing`, () => {
      delete process.env[varName];
      expect(() => require('../src/config')).toThrow(varName);
    });
  });
});
