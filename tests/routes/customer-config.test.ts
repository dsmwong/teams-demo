import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import customerConfigRouter from '../../src/routes/customer-config';
import { setCustomerConfig } from '../../src/customer-config';

beforeEach(() => setCustomerConfig({ name: '', mobile: '', accountType: '', accountLastFour: '' }));

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/customer-config', customerConfigRouter);
  return app;
}

describe('GET /customer-config', () => {
  it('returns 401 without auth cookie', async () => {
    const res = await request(makeApp()).get('/customer-config');
    expect(res.status).toBe(401);
  });

  it('returns defaults when authenticated', async () => {
    const res = await request(makeApp())
      .get('/customer-config')
      .set('Cookie', 'demo_auth=testpassword123');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: '', mobile: '', accountType: '', accountLastFour: '' });
  });
});

describe('POST /customer-config', () => {
  it('returns 401 without auth cookie', async () => {
    const res = await request(makeApp()).post('/customer-config').send({ name: 'Dan' });
    expect(res.status).toBe(401);
  });

  it('updates and returns new config when authenticated', async () => {
    const res = await request(makeApp())
      .post('/customer-config')
      .set('Cookie', 'demo_auth=testpassword123')
      .send({ name: 'Dan', mobile: '+61412345678', accountType: 'Business Savings', accountLastFour: '1234' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: 'Dan',
      mobile: '+61412345678',
      accountType: 'Business Savings',
      accountLastFour: '1234',
    });
  });
});
