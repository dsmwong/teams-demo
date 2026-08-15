import { Router } from 'express';
import { config } from '../config';

const router = Router();

router.post('/', (req, res) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${config.greetingMessage}</Say>
  <Connect action="https://${config.host}/action" method="POST">
    <ConversationRelay url="wss://${config.host}/cr"/>
  </Connect>
</Response>`;
  res.type('text/xml').send(xml);
});

export default router;
