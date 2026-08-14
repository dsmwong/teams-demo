import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import loginRouter from '../../src/routes/login';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use('/login', loginRouter);
  return app;
}

describe('POST /login', () => {
  it('sets demo_auth cookie and returns success on correct password', async () => {
    const res = await request(makeApp())
      .post('/login')
      .send({ password: 'testpassword123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies?.some((c: string) => c.startsWith('demo_auth='))).toBe(true);
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(makeApp())
      .post('/login')
      .send({ password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });
});
