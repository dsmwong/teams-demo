import { Router } from 'express';
import { config } from '../config';
import { emit } from '../events';

const router = Router();

router.post('/', (req, res) => {
  const callSid     = req.body?.CallSid as string | undefined;
  let handoffData: { reason?: string } = {};
  try {
    handoffData = JSON.parse(req.body?.HandoffData || '{}');
  } catch { /* ignore malformed */ }

  if (handoffData.reason === 'verify_failed') {
    emit('transfer', 'Verification failed — transferring to Flex', undefined, callSid);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${config.flex.transferVoice}">${config.flex.transferMessage}</Say>
  <Dial>
    <Application>
      <ApplicationSid>${config.flex.applicationSid}</ApplicationSid>
    </Application>
  </Dial>
</Response>`;
    emit('twiml', '/action (verify_failed)', xml, callSid);
    return res.type('text/xml').send(xml);
  }

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
