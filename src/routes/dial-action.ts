import { Router } from 'express';
import { config } from '../config';
import { emit } from '../events';

const router = Router();

router.post('/', (req, res) => {
  const status = req.body?.DialCallStatus;
  if (status === 'completed') {
    emit('call', 'Teams call completed');
    res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    return;
  }

  emit('transfer', `Teams no answer (${status ?? 'unknown'}) — playing message then transferring to Flex`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${config.flex.transferVoice}">${config.flex.transferMessage}</Say>
  <Dial>
    <Application>
      <ApplicationSid>${config.flex.applicationSid}</ApplicationSid>
    </Application>
  </Dial>
</Response>`;
  emit('twiml', '/dial-action', xml);
  res.type('text/xml').send(xml);
});

export default router;
