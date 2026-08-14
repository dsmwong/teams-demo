import request from 'supertest';
import express from 'express';
import actionRouter from '../../src/routes/action';

function makeApp() {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use('/action', actionRouter);
  return app;
}

describe('POST /action', () => {
  it('returns XML content-type', async () => {
    const res = await request(makeApp()).post('/action').send({});
    expect(res.type).toMatch(/xml/);
  });

  it('contains <Teams> with configured number', async () => {
    const res = await request(makeApp()).post('/action').send({});
    expect(res.text).toContain('<Teams>+61400000001</Teams>');
  });

  it('dials with 30 second timeout', async () => {
    const res = await request(makeApp()).post('/action').send({});
    expect(res.text).toContain('timeout="30"');
  });

  it('sets /dial-action as the fallback action URL', async () => {
    const res = await request(makeApp()).post('/action').send({});
    expect(res.text).toContain('action="/dial-action"');
  });
});
