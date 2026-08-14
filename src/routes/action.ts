import { Router } from 'express';
import { config } from '../config';

const router = Router();

router.post('/', (req, res) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="30" action="/dial-action">
    <Teams>${config.teams.number}</Teams>
  </Dial>
</Response>`;
  res.type('text/xml').send(xml);
});

export default router;
