import { Router } from 'express';
import { callEvents } from '../events';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const onLog = (event: object) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  callEvents.on('log', onLog);
  const heartbeat = setInterval(() => res.write(':\n\n'), 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    callEvents.off('log', onLog);
  });
});

export default router;
