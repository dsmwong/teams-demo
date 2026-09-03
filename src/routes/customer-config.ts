import { Router } from 'express';
import { getCustomerConfig, setCustomerConfig } from '../customer-config';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/',  requireAuth, (_req, res) => res.json(getCustomerConfig()));
router.post('/', requireAuth, (req, res) => {
  const { name, mobile, accountType, accountLastFour } = req.body;
  setCustomerConfig({ name, mobile, accountType, accountLastFour });
  res.json(getCustomerConfig());
});

export default router;
