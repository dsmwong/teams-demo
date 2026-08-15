import { Router } from 'express';
import { config } from '../config';
import { emit } from '../events';

const router = Router();

router.post('/', (req, res) => {
  emit('clear', 'New call');

  const { cr } = config;
  const crAttrs = [
    `url="wss://${config.host}/cr"`,
    `welcomeGreeting="${config.greetingMessage}"`,
    cr.ttsProvider           ? `ttsProvider="${cr.ttsProvider}"`                     : '',
    cr.voice                 ? `voice="${cr.voice}"`                                  : '',
    cr.language              ? `language="${cr.language}"`                            : '',
    cr.transcriptionProvider ? `transcriptionProvider="${cr.transcriptionProvider}"` : '',
    cr.speechModel           ? `speechModel="${cr.speechModel}"`                     : '',
  ].filter(Boolean).join('\n      ');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect action="https://${config.host}/action"
           method="POST">
    <ConversationRelay
      ${crAttrs}/>
  </Connect>
</Response>`;
  emit('call', '📞 Inbound call — playing greeting');
  emit('twiml', '/inbound', xml);
  res.type('text/xml').send(xml);
});

export default router;
