import { Router } from 'express';
import twilio from 'twilio';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant  = AccessToken.VoiceGrant;

  const token = new AccessToken(
    config.twilio.accountSid,
    config.twilio.apiKey,
    config.twilio.apiSecret,
    { identity: 'demo-caller' }
  );

  token.addGrant(new VoiceGrant({
    outgoingApplicationSid: config.twilio.twimlAppSid,
    incomingAllow: false,
  }));

  res.json({ token: token.toJwt(), phoneNumber: config.twilio.phoneNumber });
});

export default router;
