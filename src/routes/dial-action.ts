import { Router } from 'express';
import { config } from '../config';

const router = Router();

router.post('/', (req, res) => {
  if (req.body?.DialCallStatus === 'completed') {
    res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    return;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Application applicationSid="${config.flex.applicationSid}"/>
  </Dial>
</Response>`;
  res.type('text/xml').send(xml);
});

export default router;
