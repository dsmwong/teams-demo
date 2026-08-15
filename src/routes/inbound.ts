import { Router } from 'express';
import { config } from '../config';

const router = Router();

router.post('/', (req, res) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${config.greetingMessage}</Say>
  <Connect>
    <ConversationRelay url="wss://${config.host}/cr" action="https://${config.host}/action"/>
  </Connect>
</Response>`;
  res.type('text/xml').send(xml);
});

export default router;
