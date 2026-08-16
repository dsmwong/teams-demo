import request from 'supertest';
import express from 'express';
import dialActionRouter from '../../src/routes/dial-action';

function makeApp() {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use('/dial-action', dialActionRouter);
  return app;
}

describe('POST /dial-action', () => {
  it('returns <Say> message then Flex Application TwiML when Teams timed out', async () => {
    const res = await request(makeApp())
      .post('/dial-action')
      .send({ DialCallStatus: 'no-answer' });
    expect(res.type).toMatch(/xml/);
    expect(res.text).toContain('<Say');
    expect(res.text).toContain('<Application>');
    expect(res.text).toContain('<ApplicationSid>APflex0000000000000000000000000000</ApplicationSid>');
    // Say must appear before Dial in the response
    expect(res.text.indexOf('<Say')).toBeLessThan(res.text.indexOf('<Dial'));
  });

  it('returns Flex Application TwiML when Teams call failed', async () => {
    const res = await request(makeApp())
      .post('/dial-action')
      .send({ DialCallStatus: 'failed' });
    expect(res.text).toContain('<Application>');
    expect(res.text).toContain('<ApplicationSid>');
  });

  it('returns empty response when Teams call completed normally', async () => {
    const res = await request(makeApp())
      .post('/dial-action')
      .send({ DialCallStatus: 'completed' });
    expect(res.text).not.toContain('<Application');
    expect(res.text).not.toContain('<Say');
  });
});
