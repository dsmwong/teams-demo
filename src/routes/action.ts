import { Router } from 'express';
import { config } from '../config';
import { emit } from '../events';

const router = Router();

router.post('/', (req, res) => {
  const callSid = req.body?.CallSid as string | undefined;
  emit('transfer', `CR ended — dialling Teams ${config.teams.number}`, undefined, callSid);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="${config.teams.timeout}" action="/dial-action">
    <Teams>${config.teams.number}</Teams>
  </Dial>
</Response>`;
  emit('twiml', '/action', xml, callSid);
  res.type('text/xml').send(xml);
});

export default router;
