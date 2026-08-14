import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.cookies?.demo_auth === config.demoPassword) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}
