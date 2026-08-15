import request from 'supertest';
import express from 'express';
import inboundRouter from '../../src/routes/inbound';

function makeApp() {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use('/inbound', inboundRouter);
  return app;
}

describe('POST /inbound', () => {
  it('returns XML content-type', async () => {
    const res = await request(makeApp()).post('/inbound').send({});
    expect(res.status).toBe(200);
    expect(res.type).toMatch(/xml/);
  });

  it('contains <Say> with the configured greeting', async () => {
    const res = await request(makeApp()).post('/inbound').send({});
    expect(res.text).toContain('<Say>Welcome to test</Say>');
  });

  it('contains <Connect> with action URL and <ConversationRelay> with wss url', async () => {
    const res = await request(makeApp()).post('/inbound').send({});
    expect(res.text).toContain('<Connect action="https://test.example.com/action"');
    expect(res.text).toContain('<ConversationRelay');
    expect(res.text).toContain('wss://test.example.com/cr');
  });
});
