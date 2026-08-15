import { Router } from 'express';
import { config } from '../config';
import { emit } from '../events';

const router = Router();

router.post('/', (req, res) => {
  emit('clear', 'New call');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${config.greetingMessage}</Say>
  <Connect action="https://${config.host}/action" method="POST">
    <ConversationRelay url="wss://${config.host}/cr"/>
  </Connect>
</Response>`;
  emit('call', '📞 Inbound call — playing greeting');
  emit('twiml', '/inbound', xml);
  res.type('text/xml').send(xml);
});

export default router;
