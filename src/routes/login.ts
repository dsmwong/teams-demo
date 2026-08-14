import { Router } from 'express';
import { config } from '../config';

const router = Router();

router.post('/', (req, res) => {
  if (req.body?.password === config.demoPassword) {
    res.cookie('demo_auth', config.demoPassword, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.json({ success: true });
    return;
  }
  res.status(401).json({ error: 'Invalid password' });
});

export default router;
