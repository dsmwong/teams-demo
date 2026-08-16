import { Router } from 'express';
import { config } from '../config';
import { emit } from '../events';

const router = Router();

router.post('/', (req, res) => {
  emit('transfer', `CR ended — dialling Teams ${config.teams.number}`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="${config.teams.timeout}" action="/dial-action">
    <Teams>${config.teams.number}</Teams>
  </Dial>
</Response>`;
  emit('twiml', '/action', xml);
  res.type('text/xml').send(xml);
});

export default router;
