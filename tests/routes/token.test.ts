// jest.mock MUST come before any imports from src/
jest.mock('twilio', () => {
  const MockAT = jest.fn().mockImplementation(() => ({
    addGrant: jest.fn(),
    toJwt: jest.fn().mockReturnValue('mock.jwt.token'),
  }));
  (MockAT as any).VoiceGrant = jest.fn().mockImplementation(() => ({}));
  return { jwt: { AccessToken: MockAT } };
});

import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import tokenRouter from '../../src/routes/token';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/token', tokenRouter);
  return app;
}

describe('GET /token', () => {
  it('returns 401 without auth cookie', async () => {
    const res = await request(makeApp()).get('/token');
    expect(res.status).toBe(401);
  });

  it('returns a token string when authenticated', async () => {
    const res = await request(makeApp())
      .get('/token')
      .set('Cookie', 'demo_auth=testpassword123');
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(0);
  });
});
