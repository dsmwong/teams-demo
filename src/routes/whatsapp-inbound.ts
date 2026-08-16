import { Router } from 'express';
import { config } from '../config';

const router = Router();

router.post('/', (req, res) => {
  if (!config.whatsapp.a2aAppSid) {
    res.status(500).type('text/plain').send('WHATSAPP_A2A_APP_SID is not configured');
    return;
  }

  // This TwiML is executed by the EXTERNAL WhatsApp/Flex account.
  // It performs an Application-to-Application (A2A) transfer into this demo account
  // by dialling the TwiML App that routes to /inbound.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Application>
      <ApplicationSid>${config.whatsapp.a2aAppSid}</ApplicationSid>
    </Application>
  </Dial>
</Response>`;

  res.type('text/xml').send(xml);
});

export default router;
