import { Router } from 'express';
import { config } from '../config';
import { emit } from '../events';

const router = Router();

router.post('/', (req, res) => {
  const callSid = req.body?.CallSid as string | undefined;
  const from    = req.body?.From    as string | undefined;
  emit('clear', from ?? 'unknown', undefined, callSid);

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
  emit('call', 'Inbound call — playing greeting', undefined, callSid);
  emit('twiml', '/inbound', xml, callSid);
  res.type('text/xml').send(xml);
});

export default router;
