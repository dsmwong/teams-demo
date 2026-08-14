# Teams Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single Express + WebSocket server that handles inbound Twilio voice calls, runs a ConversationRelay AI agent (business banking context), dials Microsoft Teams, and falls back to Flex via A2A — plus a browser-based Voice SDK client UI for live demo.

**Architecture:** Single TypeScript/Express server handles HTTP TwiML webhooks, a WebSocket `/cr` endpoint for ConversationRelay (bridging to OpenAI GPT-4o), and static serving of the Voice SDK client. One Fly.io service, one deploy.

**Tech Stack:** Node 22, TypeScript 5, Express 4, ws 8, Twilio SDK 5, OpenAI SDK 4, cookie-parser, Jest + ts-jest + supertest, pnpm, Fly.io

---

## File Map

| File | Responsibility |
|---|---|
| `src/config.ts` | Load + validate all env vars at startup; export typed `config` |
| `src/middleware/auth.ts` | Check `demo_auth` cookie; 401 if missing/wrong |
| `src/routes/login.ts` | `POST /login` — set auth cookie on correct password |
| `src/routes/inbound.ts` | `POST /inbound` — TwiML: `<Say>` + `<ConversationRelay>` |
| `src/routes/action.ts` | `POST /action` — TwiML: `<Dial><Teams>` with 30s timeout |
| `src/routes/dial-action.ts` | `POST /dial-action` — TwiML: Flex `<Application>` fallback |
| `src/routes/token.ts` | `GET /token` (auth-protected) — Twilio Access Token |
| `src/ws/conversation-relay.ts` | WebSocket handler: ConversationRelay ↔ OpenAI bridge |
| `src/server.ts` | Express app wiring + HTTP→WebSocket upgrade for `/cr` |
| `prompts/system-prompt.md` | CR agent persona — read at runtime, no redeploy needed |
| `public/index.html` | Voice SDK client — light theme, login overlay + dial UI |
| `tests/setup.ts` | Set required env vars for all test files |
| `tests/config.test.ts` | Config throws on each missing var |
| `tests/middleware/auth.test.ts` | Auth middleware 401/pass-through |
| `tests/routes/login.test.ts` | Login sets/rejects cookie |
| `tests/routes/inbound.test.ts` | Inbound TwiML shape |
| `tests/routes/action.test.ts` | Action TwiML shape |
| `tests/routes/dial-action.test.ts` | Fallback logic per DialCallStatus |
| `tests/routes/token.test.ts` | Auth enforcement on token endpoint |
| `tests/ws/conversation-relay.test.ts` | CR message flow + `[TRANSFER]` detection |
| `jest.config.js` | Jest + ts-jest config |
| `tsconfig.json` | TypeScript compiler config |
| `Dockerfile` | Node 22 Alpine, pnpm build |
| `fly.toml` | Fly.io service config |
| `.env.example` | All required vars documented |



---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `jest.config.js`
- Create: `tsconfig.test.json`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Initialise pnpm and create package.json**

```bash
pnpm init
```

Replace the generated `package.json` with:

```json
{
  "name": "teams-demo",
  "version": "1.0.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "ts-node src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest --forceExit",
    "test:watch": "jest --watch --forceExit"
  },
  "dependencies": {
    "cookie-parser": "^1.4.7",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "openai": "^4.52.7",
    "twilio": "^5.3.2",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/cookie-parser": "^1.4.7",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/node": "^22.0.0",
    "@types/supertest": "^6.0.2",
    "@types/ws": "^8.5.11",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.2",
    "ts-node": "^10.9.2",
    "typescript": "^5.5.3"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
pnpm install
```

Expected: `node_modules/` created, `pnpm-lock.yaml` generated.

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create tsconfig.test.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "."
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 5: Create jest.config.js**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/setup.ts'],
  globals: {
    'ts-jest': { tsconfig: 'tsconfig.test.json' }
  },
  forceExit: true,
};
```

- [ ] **Step 6: Create tests/setup.ts**

```typescript
process.env.TWILIO_ACCOUNT_SID   = 'ACtest000000000000000000000000000';
process.env.TWILIO_AUTH_TOKEN    = 'test_auth_token_000000000000000000';
process.env.TWILIO_API_KEY       = 'SKtest0000000000000000000000000000';
process.env.TWILIO_API_SECRET    = 'test_api_secret_000000000000000000';
process.env.TWILIO_PHONE_NUMBER  = '+15551234567';
process.env.TWILIO_TWIML_APP_SID = 'APtest0000000000000000000000000000';
process.env.TEAMS_NUMBER         = '+61400000001';
process.env.FLEX_ACCOUNT_SID     = 'ACflex000000000000000000000000000';
process.env.FLEX_APPLICATION_SID = 'APflex0000000000000000000000000000';
process.env.OPENAI_API_KEY       = 'sk-test-key-000000000000000000000000';
process.env.GREETING_MESSAGE     = 'Welcome to test';
process.env.DEMO_PASSWORD        = 'testpassword123';
process.env.HOST                 = 'test.example.com';
```

- [ ] **Step 7: Create .env.example**

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_API_KEY=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_SECRET=your_api_secret
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
TWILIO_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TEAMS_NUMBER=+61xxxxxxxxx
FLEX_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FLEX_APPLICATION_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-...
GREETING_MESSAGE=Welcome to Teams Demo
DEMO_PASSWORD=choose_a_strong_password
HOST=teams-demo.fly.dev
PORT=3000
```

- [ ] **Step 8: Create .gitignore**

```
node_modules/
dist/
.env
.superpowers/
*.js.map
```

- [ ] **Step 9: Create required directories**

```bash
mkdir -p src/routes src/middleware src/ws tests/routes tests/middleware tests/ws prompts public docs
```

- [ ] **Step 10: Commit**

```bash
git init
git add .
git commit -m "chore: project scaffold"
```

---

## Task 2: Config Module

**Files:**
- Create: `src/config.ts`
- Create: `tests/config.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/config.test.ts
const REQUIRED_VARS = [
  'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_API_KEY',
  'TWILIO_API_SECRET', 'TWILIO_PHONE_NUMBER', 'TWILIO_TWIML_APP_SID',
  'TEAMS_NUMBER', 'FLEX_ACCOUNT_SID', 'FLEX_APPLICATION_SID',
  'OPENAI_API_KEY', 'GREETING_MESSAGE', 'DEMO_PASSWORD', 'HOST',
];

describe('config', () => {
  const original = { ...process.env };

  afterEach(() => {
    Object.keys(process.env).forEach(k => delete process.env[k]);
    Object.assign(process.env, original);
    jest.resetModules();
  });

  it('exports config with all values when env is complete', () => {
    const { config } = require('../src/config');
    expect(config.twilio.accountSid).toBe(process.env.TWILIO_ACCOUNT_SID);
    expect(config.teams.number).toBe(process.env.TEAMS_NUMBER);
    expect(config.greetingMessage).toBe(process.env.GREETING_MESSAGE);
  });

  REQUIRED_VARS.forEach(varName => {
    it(`throws containing "${varName}" when it is missing`, () => {
      delete process.env[varName];
      expect(() => require('../src/config')).toThrow(varName);
    });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test tests/config.test.ts
```

Expected: FAIL — `Cannot find module '../src/config'`

- [ ] **Step 3: Implement src/config.ts**

```typescript
import dotenv from 'dotenv';
dotenv.config();

const REQUIRED = [
  'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_API_KEY',
  'TWILIO_API_SECRET', 'TWILIO_PHONE_NUMBER', 'TWILIO_TWIML_APP_SID',
  'TEAMS_NUMBER', 'FLEX_ACCOUNT_SID', 'FLEX_APPLICATION_SID',
  'OPENAI_API_KEY', 'GREETING_MESSAGE', 'DEMO_PASSWORD', 'HOST',
] as const;

for (const key of REQUIRED) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const config = {
  twilio: {
    accountSid:  process.env.TWILIO_ACCOUNT_SID!,
    authToken:   process.env.TWILIO_AUTH_TOKEN!,
    apiKey:      process.env.TWILIO_API_KEY!,
    apiSecret:   process.env.TWILIO_API_SECRET!,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER!,
    twimlAppSid: process.env.TWILIO_TWIML_APP_SID!,
  },
  teams:  { number: process.env.TEAMS_NUMBER! },
  flex: {
    accountSid:     process.env.FLEX_ACCOUNT_SID!,
    applicationSid: process.env.FLEX_APPLICATION_SID!,
  },
  openai: { apiKey: process.env.OPENAI_API_KEY! },
  greetingMessage: process.env.GREETING_MESSAGE!,
  demoPassword:    process.env.DEMO_PASSWORD!,
  host:            process.env.HOST!,
  port:            parseInt(process.env.PORT ?? '3000', 10),
};
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
pnpm test tests/config.test.ts
```

Expected: PASS — 14 tests

- [ ] **Step 5: Commit**

```bash
git add src/config.ts tests/config.test.ts tests/setup.ts jest.config.js tsconfig.test.json
git commit -m "feat: config module with startup validation"
```

---

## Task 3: Auth Middleware + Login Route

**Files:**
- Create: `src/middleware/auth.ts`
- Create: `src/routes/login.ts`
- Create: `tests/middleware/auth.test.ts`
- Create: `tests/routes/login.test.ts`

- [ ] **Step 1: Write failing test for auth middleware**

```typescript
// tests/middleware/auth.test.ts
import { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../src/middleware/auth';

describe('requireAuth', () => {
  const next = jest.fn() as jest.MockedFunction<NextFunction>;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;

  beforeEach(() => jest.clearAllMocks());

  it('calls next() when demo_auth cookie matches DEMO_PASSWORD', () => {
    const req = { cookies: { demo_auth: 'testpassword123' } } as unknown as Request;
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when cookie is absent', () => {
    const req = { cookies: {} } as unknown as Request;
    requireAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when cookie value is wrong', () => {
    const req = { cookies: { demo_auth: 'wrongpassword' } } as unknown as Request;
    requireAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
```

- [ ] **Step 2: Write failing test for login route**

```typescript
// tests/routes/login.test.ts
import request from 'supertest';
import { app } from '../../src/server';

describe('POST /login', () => {
  it('sets demo_auth cookie and returns success on correct password', async () => {
    const res = await request(app)
      .post('/login')
      .send({ password: 'testpassword123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const cookies = res.headers['set-cookie'] as string[];
    expect(cookies?.some((c: string) => c.startsWith('demo_auth='))).toBe(true);
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/login')
      .send({ password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
pnpm test tests/middleware/auth.test.ts tests/routes/login.test.ts
```

Expected: FAIL — modules not found

- [ ] **Step 4: Implement src/middleware/auth.ts**

```typescript
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.cookies?.demo_auth === config.demoPassword) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}
```

- [ ] **Step 5: Implement src/routes/login.ts**

```typescript
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
```

- [ ] **Step 6: Create a minimal src/server.ts so tests can import `app`**

```typescript
import express from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './config';
import loginRouter from './routes/login';

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/login', loginRouter);

const server = http.createServer(app);
export { app, server };

if (require.main === module) {
  server.listen(config.port, () => console.log(`Server running on port ${config.port}`));
}
```

- [ ] **Step 7: Run tests to confirm they pass**

```bash
pnpm test tests/middleware/auth.test.ts tests/routes/login.test.ts
```

Expected: PASS — 5 tests

- [ ] **Step 8: Commit**

```bash
git add src/middleware/auth.ts src/routes/login.ts src/server.ts \
        tests/middleware/auth.test.ts tests/routes/login.test.ts
git commit -m "feat: auth middleware and login route"
```

---

## Task 4: Inbound Route

**Files:**
- Create: `src/routes/inbound.ts`
- Create: `tests/routes/inbound.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/routes/inbound.test.ts
import request from 'supertest';
import { app } from '../../src/server';

describe('POST /inbound', () => {
  it('returns XML content-type', async () => {
    const res = await request(app).post('/inbound').send({});
    expect(res.status).toBe(200);
    expect(res.type).toMatch(/xml/);
  });

  it('contains <Say> with the configured greeting', async () => {
    const res = await request(app).post('/inbound').send({});
    expect(res.text).toContain('<Say>Welcome to test</Say>');
  });

  it('contains <ConversationRelay> pointing to wss host', async () => {
    const res = await request(app).post('/inbound').send({});
    expect(res.text).toContain('<ConversationRelay');
    expect(res.text).toContain('wss://test.example.com/cr');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test tests/routes/inbound.test.ts
```

Expected: FAIL — 404 on POST /inbound

- [ ] **Step 3: Implement src/routes/inbound.ts**

```typescript
import { Router } from 'express';
import { config } from '../config';

const router = Router();

router.post('/', (req, res) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${config.greetingMessage}</Say>
  <Connect>
    <ConversationRelay url="wss://${config.host}/cr"/>
  </Connect>
</Response>`;
  res.type('text/xml').send(xml);
});

export default router;
```

- [ ] **Step 4: Add route to src/server.ts** (after loginRouter line)

```typescript
import inboundRouter from './routes/inbound';
// ...
app.use('/inbound', inboundRouter);
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
pnpm test tests/routes/inbound.test.ts
```

Expected: PASS — 3 tests

- [ ] **Step 6: Commit**

```bash
git add src/routes/inbound.ts src/server.ts tests/routes/inbound.test.ts
git commit -m "feat: inbound route — greeting + ConversationRelay TwiML"
```

---

## Task 5: Action Route

**Files:**
- Create: `src/routes/action.ts`
- Create: `tests/routes/action.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/routes/action.test.ts
import request from 'supertest';
import { app } from '../../src/server';

describe('POST /action', () => {
  it('returns XML content-type', async () => {
    const res = await request(app).post('/action').send({});
    expect(res.type).toMatch(/xml/);
  });

  it('contains <Teams> with configured number', async () => {
    const res = await request(app).post('/action').send({});
    expect(res.text).toContain('<Teams>+61400000001</Teams>');
  });

  it('dials with 30 second timeout', async () => {
    const res = await request(app).post('/action').send({});
    expect(res.text).toContain('timeout="30"');
  });

  it('sets /dial-action as the fallback action URL', async () => {
    const res = await request(app).post('/action').send({});
    expect(res.text).toContain('action="/dial-action"');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test tests/routes/action.test.ts
```

Expected: FAIL — 404 on POST /action

- [ ] **Step 3: Implement src/routes/action.ts**

```typescript
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
```

- [ ] **Step 4: Add route to src/server.ts**

```typescript
import actionRouter from './routes/action';
// ...
app.use('/action', actionRouter);
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
pnpm test tests/routes/action.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add src/routes/action.ts src/server.ts tests/routes/action.test.ts
git commit -m "feat: action route — Teams dial TwiML"
```

---

## Task 6: Dial-Action Route

**Files:**
- Create: `src/routes/dial-action.ts`
- Create: `tests/routes/dial-action.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/routes/dial-action.test.ts
import request from 'supertest';
import { app } from '../../src/server';

describe('POST /dial-action', () => {
  it('returns Flex Application TwiML when Teams timed out', async () => {
    const res = await request(app)
      .post('/dial-action')
      .send({ DialCallStatus: 'no-answer' });
    expect(res.type).toMatch(/xml/);
    expect(res.text).toContain('<Application applicationSid="APflex0000000000000000000000000000"');
  });

  it('returns Flex Application TwiML when Teams call failed', async () => {
    const res = await request(app)
      .post('/dial-action')
      .send({ DialCallStatus: 'failed' });
    expect(res.text).toContain('<Application');
  });

  it('returns empty response when Teams call completed normally', async () => {
    const res = await request(app)
      .post('/dial-action')
      .send({ DialCallStatus: 'completed' });
    expect(res.text).not.toContain('<Application');
    expect(res.text).not.toContain('<Say');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test tests/routes/dial-action.test.ts
```

Expected: FAIL — 404 on POST /dial-action

- [ ] **Step 3: Implement src/routes/dial-action.ts**

```typescript
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
```

- [ ] **Step 4: Add route to src/server.ts**

```typescript
import dialActionRouter from './routes/dial-action';
// ...
app.use('/dial-action', dialActionRouter);
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
pnpm test tests/routes/dial-action.test.ts
```

Expected: PASS — 3 tests

- [ ] **Step 6: Commit**

```bash
git add src/routes/dial-action.ts src/server.ts tests/routes/dial-action.test.ts
git commit -m "feat: dial-action route — Flex A2A fallback TwiML"
```

---

## Task 7: Token Route

**Files:**
- Create: `src/routes/token.ts`
- Create: `tests/routes/token.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/routes/token.test.ts
import request from 'supertest';

const mockToJwt    = jest.fn().mockReturnValue('mock.jwt.token');
const mockAddGrant = jest.fn();
const MockAT       = jest.fn().mockImplementation(() => ({ addGrant: mockAddGrant, toJwt: mockToJwt }));
(MockAT as any).VoiceGrant = jest.fn().mockImplementation(() => ({}));
jest.mock('twilio', () => ({ jwt: { AccessToken: MockAT } }));

import { app } from '../../src/server';

describe('GET /token', () => {
  it('returns 401 without auth cookie', async () => {
    const res = await request(app).get('/token');
    expect(res.status).toBe(401);
  });

  it('returns a token string when authenticated', async () => {
    const res = await request(app)
      .get('/token')
      .set('Cookie', 'demo_auth=testpassword123');
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test tests/routes/token.test.ts
```

Expected: FAIL — 404 on GET /token

- [ ] **Step 3: Implement src/routes/token.ts**

```typescript
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

  res.json({ token: token.toJwt() });
});

export default router;
```

- [ ] **Step 4: Add route to src/server.ts**

```typescript
import tokenRouter from './routes/token';
// ...
app.use('/token', tokenRouter);
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
pnpm test tests/routes/token.test.ts
```

Expected: PASS — 2 tests

- [ ] **Step 6: Commit**

```bash
git add src/routes/token.ts src/server.ts tests/routes/token.test.ts
git commit -m "feat: token route — auth-protected Twilio Access Token"
```

---

## Task 8: ConversationRelay WebSocket Handler

**Files:**
- Create: `src/ws/conversation-relay.ts`
- Create: `tests/ws/conversation-relay.test.ts`

The handler buffers the full OpenAI response, strips `[TRANSFER]` if present, sends the response word-by-word as TTS tokens, then sends `{type:"end"}` if `[TRANSFER]` was detected.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ws/conversation-relay.test.ts
import WebSocket from 'ws';

jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('You are a banking assistant.'),
}));

const mockStreamChunks = [
  { choices: [{ delta: { content: 'I can help with that. ' } }] },
  { choices: [{ delta: { content: 'Transferring you now. [TRANSFER]' } }] },
];

jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          [Symbol.asyncIterator]: async function* () {
            for (const chunk of mockStreamChunks) yield chunk;
          },
        }),
      },
    },
  })),
}));

import { handleConversationRelay } from '../../src/ws/conversation-relay';

describe('handleConversationRelay', () => {
  function makeMockWs() {
    const sent: string[] = [];
    const handlers: Record<string, Function> = {};
    const ws = {
      on:   jest.fn((ev: string, fn: Function) => { handlers[ev] = fn; }),
      send: jest.fn((data: string) => sent.push(data)),
    } as unknown as WebSocket;
    return { ws, sent, handlers };
  }

  it('sends text tokens and an end message when agent includes [TRANSFER]', async () => {
    const { ws, sent, handlers } = makeMockWs();
    handleConversationRelay(ws);

    await handlers['message'](
      Buffer.from(JSON.stringify({ type: 'prompt', voicePrompt: 'I need help' }))
    );

    const parsed = sent.map(s => JSON.parse(s));
    expect(parsed.some(m => m.type === 'text')).toBe(true);
    expect(parsed.some(m => m.last === true)).toBe(true);
    expect(parsed.filter(m => m.type === 'end')).toHaveLength(1);
    expect(parsed.filter(m => m.type === 'text').every(m => !String(m.token).includes('[TRANSFER]'))).toBe(true);
  });

  it('sends end message when OpenAI throws', async () => {
    const { OpenAI } = require('openai');
    (OpenAI as jest.Mock).mockImplementationOnce(() => ({
      chat: { completions: { create: jest.fn().mockRejectedValue(new Error('API error')) } },
    }));

    const { ws, sent, handlers } = makeMockWs();
    handleConversationRelay(ws);

    await handlers['message'](
      Buffer.from(JSON.stringify({ type: 'prompt', voicePrompt: 'test' }))
    );

    const parsed = sent.map(s => JSON.parse(s));
    expect(parsed.some(m => m.type === 'end')).toBe(true);
  });

  it('ignores non-prompt message types without sending anything', async () => {
    const { ws, sent, handlers } = makeMockWs();
    handleConversationRelay(ws);

    await handlers['message'](
      Buffer.from(JSON.stringify({ type: 'setup', callSid: 'CA123' }))
    );

    expect(sent).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test tests/ws/conversation-relay.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement src/ws/conversation-relay.ts**

```typescript
import WebSocket from 'ws';
import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

function loadSystemPrompt(): string {
  return fs.readFileSync(
    path.join(process.cwd(), 'prompts', 'system-prompt.md'),
    'utf-8'
  );
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function handleConversationRelay(ws: WebSocket): void {
  const history: ChatMessage[] = [];

  ws.on('message', async (data: Buffer) => {
    let msg: { type: string; voicePrompt?: string };
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (msg.type !== 'prompt' || !msg.voicePrompt) return;

    history.push({ role: 'user', content: msg.voicePrompt });

    try {
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: loadSystemPrompt() },
          ...history,
        ],
        stream: true,
      });

      let fullResponse = '';
      for await (const chunk of stream) {
        fullResponse += chunk.choices[0]?.delta?.content ?? '';
      }

      const shouldTransfer = fullResponse.includes('[TRANSFER]');
      const clean = fullResponse.replace('[TRANSFER]', '').trim();
      history.push({ role: 'assistant', content: clean });

      const words = clean.split(/(\s+)/);
      for (let i = 0; i < words.length; i++) {
        ws.send(JSON.stringify({ type: 'text', token: words[i], last: i === words.length - 1 }));
      }

      if (shouldTransfer) {
        ws.send(JSON.stringify({ type: 'end', handoffData: '{}' }));
      }
    } catch (err) {
      console.error('ConversationRelay OpenAI error:', err);
      ws.send(JSON.stringify({ type: 'end', handoffData: '{}' }));
    }
  });
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
pnpm test tests/ws/conversation-relay.test.ts
```

Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/ws/conversation-relay.ts tests/ws/conversation-relay.test.ts
git commit -m "feat: ConversationRelay WebSocket handler with OpenAI streaming"
```

---

## Task 9: Final Server Wiring

**Files:**
- Modify: `src/server.ts` (replace stub with full version including WebSocket upgrade + health check)

- [ ] **Step 1: Replace src/server.ts**

```typescript
import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './config';
import { handleConversationRelay } from './ws/conversation-relay';
import loginRouter     from './routes/login';
import inboundRouter   from './routes/inbound';
import actionRouter    from './routes/action';
import dialActionRouter from './routes/dial-action';
import tokenRouter     from './routes/token';

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/login',       loginRouter);
app.use('/inbound',     inboundRouter);
app.use('/action',      actionRouter);
app.use('/dial-action', dialActionRouter);
app.use('/token',       tokenRouter);

const server = http.createServer(app);

const wss = new WebSocket.Server({ noServer: true });
wss.on('connection', (ws) => handleConversationRelay(ws));

server.on('upgrade', (req, socket, head) => {
  if (req.url === '/cr') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

export { app, server };

if (require.main === module) {
  server.listen(config.port, () => console.log(`Server running on port ${config.port}`));
}
```

- [ ] **Step 2: Run the full test suite**

```bash
pnpm test
```

Expected: All tests PASS. If the CR tests fail due to the OpenAI mock being created at module load time (before the mock is set up), move the `jest.mock('openai', ...)` call to before the import in the CR test file. ts-jest hoists `jest.mock` calls automatically, so this should be fine.

- [ ] **Step 3: Commit**

```bash
git add src/server.ts
git commit -m "feat: final server wiring — WebSocket upgrade + health check"
```

---

## Task 10: System Prompt

**Files:**
- Create: `prompts/system-prompt.md`

- [ ] **Step 1: Create prompts/system-prompt.md**

```markdown
# Business Banking Assistant

You are a professional business banking specialist. You help business clients with enquiries about their business bank accounts.

## Conversation flow

1. Greet the caller warmly and ask for their name if they haven't given it.
2. Ask what their enquiry is about today.
3. Acknowledge their query briefly.
4. Tell them you will check calendar availability for a specialist.
5. Generate a plausible availability — pick a specific time within the next 2 business days relative to now (e.g. "tomorrow at 2:00pm" or "Thursday at 10:30am"). Say it confidently as if you just checked.
6. Confirm availability and tell the caller you are transferring them to the specialist now.
7. End your final message with the exact string: [TRANSFER]

## Rules

- Keep all responses short and natural — this is a voice call.
- Do not use markdown, bullet points, or special characters.
- Do not mention that you are an AI.

## Example final message

"Great — I have a specialist available tomorrow at 2:00pm. I'll connect you through now. [TRANSFER]"
```

- [ ] **Step 2: Commit**

```bash
git add prompts/system-prompt.md
git commit -m "feat: system prompt — business banking agent"
```

---

## Task 11: Voice SDK Client UI

**Files:**
- Create: `public/index.html`

- [ ] **Step 1: Create public/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Teams Demo</title>
  <script src="https://sdk.twilio.com/js/client/releases/2.6.0/twilio.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f0f4f8;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      padding: 40px 32px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
      width: 320px;
      text-align: center;
    }
    h1 { font-size: 22px; font-weight: 700; color: #1a202c; margin-bottom: 4px; }
    .subtitle { font-size: 13px; color: #718096; margin-bottom: 28px; }
    input[type=password] {
      width: 100%; padding: 10px 14px;
      border: 1.5px solid #e2e8f0; border-radius: 8px;
      font-size: 14px; margin-bottom: 12px; outline: none;
    }
    input[type=password]:focus { border-color: #4299e1; }
    .btn {
      width: 100%; padding: 11px; border: none; border-radius: 8px;
      font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity .15s;
    }
    .btn:hover { opacity: 0.88; }
    .btn-primary { background: #3182ce; color: #fff; }
    .error { color: #e53e3e; font-size: 12px; margin-top: 8px; min-height: 18px; }
    .sdk-row { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; margin-bottom: 24px; }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: #a0aec0; }
    .dot.ready { background: #38a169; }
    .dot.error  { background: #e53e3e; }
    .status-badge {
      display: inline-block; padding: 5px 14px; border-radius: 20px;
      font-size: 12px; font-weight: 600; margin-bottom: 24px;
      background: #f7fafc; color: #4a5568;
    }
    .status-badge.active    { background: #fefcbf; color: #b7791f; }
    .status-badge.connected { background: #c6f6d5; color: #276749; }
    .dial-btn {
      width: 80px; height: 80px; border-radius: 50%; border: none;
      font-size: 32px; cursor: pointer;
      margin: 0 auto 12px; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 14px rgba(0,0,0,0.15); transition: transform .1s;
    }
    .dial-btn:active { transform: scale(0.95); }
    .dial-btn.idle   { background: #38a169; }
    .dial-btn.active { background: #e53e3e; }
    .dial-hint { font-size: 12px; color: #718096; }
    [hidden] { display: none !important; }
  </style>
</head>
<body>

<div id="login-card" class="card" hidden>
  <h1>Teams Demo</h1>
  <p class="subtitle">Customer Experience Demo</p>
  <input type="password" id="pw" placeholder="Password" />
  <button class="btn btn-primary" onclick="doLogin()">Enter Demo</button>
  <div class="error" id="login-error"></div>
</div>

<div id="dial-card" class="card" hidden>
  <h1>Teams Demo</h1>
  <p class="subtitle">Voice SDK Client</p>
  <div class="sdk-row">
    <div class="dot" id="sdk-dot"></div>
    <span id="sdk-label">Initialising…</span>
  </div>
  <br>
  <span class="status-badge" id="status">Idle</span>
  <br>
  <button class="dial-btn idle" id="dial-btn" onclick="toggleCall()">📞</button>
  <div class="dial-hint" id="hint">Tap to call</div>
</div>

<script>
  let device = null, call = null;

  async function init() {
    try {
      const r = await fetch('/token');
      if (r.status === 401) { show('login-card'); return; }
      setupDevice((await r.json()).token);
      show('dial-card');
    } catch { show('login-card'); }
  }

  async function doLogin() {
    const r = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: document.getElementById('pw').value }),
    });
    if (r.ok) {
      document.getElementById('login-card').hidden = true;
      setupDevice((await (await fetch('/token')).json()).token);
      show('dial-card');
    } else {
      document.getElementById('login-error').textContent = 'Incorrect password';
    }
  }

  function setupDevice(token) {
    device = new Twilio.Device(token, { logLevel: 1 });
    device.on('ready',      () => setSdk('ready', 'SDK Ready'));
    device.on('registered', () => setSdk('ready', 'SDK Ready'));
    device.on('error',      (e) => { setSdk('error', 'SDK Error'); setStatus('Error: ' + e.message, ''); });
    device.on('connect',    (c) => { call = c; setStatus('In call with Teams', 'connected'); setBtn('active', '📵', 'Tap to hang up'); });
    device.on('disconnect', ()  => { call = null; setStatus('Call ended', ''); setBtn('idle', '📞', 'Tap to call'); setTimeout(() => setStatus('Idle', ''), 3000); });
    device.register();
  }

  function toggleCall() {
    if (call) { call.disconnect(); return; }
    setStatus('Connecting…', 'active');
    setBtn('active', '⏳', 'Connecting…');
    device.connect();
  }

  function show(id) { document.getElementById(id).hidden = false; }
  function setSdk(state, label) {
    document.getElementById('sdk-dot').className = 'dot ' + state;
    document.getElementById('sdk-label').textContent = label;
  }
  function setStatus(text, type) {
    const b = document.getElementById('status');
    b.textContent = text; b.className = 'status-badge ' + type;
  }
  function setBtn(state, icon, hint) {
    const b = document.getElementById('dial-btn');
    b.className = 'dial-btn ' + state; b.textContent = icon;
    document.getElementById('hint').textContent = hint;
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('pw').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    init();
  });
</script>
</body>
</html>
```

- [ ] **Step 2: Manually test the UI**

Copy `.env.example` to `.env`, fill in real Twilio credentials, then:

```bash
pnpm dev
```

Open http://localhost:3000. Confirm:
- Login form is shown (not the dialler)
- Entering the correct password shows the dialler card
- "SDK Ready" green dot appears within a few seconds
- Clicking the dial button changes it to red and updates the status badge

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: Voice SDK client UI — light theme, login overlay, dial/hangup"
```

---

## Task 12: Deployment Config

**Files:**
- Create: `Dockerfile`
- Create: `fly.toml`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app
RUN npm install -g pnpm

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist    ./dist
COPY --from=build /app/public  ./public
COPY --from=build /app/prompts ./prompts
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

- [ ] **Step 2: Create fly.toml**

```toml
app = 'teams-demo'
primary_region = 'syd'

[build]
  dockerfile = 'Dockerfile'

[env]
  PORT     = '3000'
  NODE_ENV = 'production'

[http_service]
  internal_port      = 3000
  force_https        = true
  auto_stop_machines = 'stop'
  auto_start_machines = true

[[http_service.checks]]
  interval     = '30s'
  timeout      = '5s'
  grace_period = '10s'
  method       = 'GET'
  path         = '/health'
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
pnpm build
```

Expected: `dist/` created with zero TypeScript errors.

- [ ] **Step 4: Run full test suite**

```bash
pnpm test
```

Expected: All tests PASS.

- [ ] **Step 5: Deploy to Fly.io**

```bash
fly launch --no-deploy
fly secrets set \
  TWILIO_ACCOUNT_SID="ACxxx" \
  TWILIO_AUTH_TOKEN="xxx" \
  TWILIO_API_KEY="SKxxx" \
  TWILIO_API_SECRET="xxx" \
  TWILIO_PHONE_NUMBER="+1xxx" \
  TWILIO_TWIML_APP_SID="APxxx" \
  TEAMS_NUMBER="+61xxx" \
  FLEX_ACCOUNT_SID="ACxxx" \
  FLEX_APPLICATION_SID="APxxx" \
  OPENAI_API_KEY="sk-xxx" \
  GREETING_MESSAGE="Welcome to Teams Demo" \
  DEMO_PASSWORD="your_secure_password" \
  HOST="teams-demo.fly.dev"
fly deploy
```

Expected: `curl https://teams-demo.fly.dev/health` returns `{"status":"ok"}`.

- [ ] **Step 6: Configure Twilio phone number**

In the Twilio Console, set the phone number's **A CALL COMES IN** webhook to:
`https://teams-demo.fly.dev/inbound` (HTTP POST)

Set the TwiML App's **Voice Request URL** to:
`https://teams-demo.fly.dev/inbound` (HTTP POST)

- [ ] **Step 7: Commit**

```bash
git add Dockerfile fly.toml
git commit -m "chore: Fly.io deployment config"
```

---

## Task 13: WhatsApp/Flex Setup Guide

**Files:**
- Create: `docs/whatsapp-flex-setup.md`

- [ ] **Step 1: Create docs/whatsapp-flex-setup.md**

```markdown
# WhatsApp / Flex Account A2A Setup

To route a WhatsApp Voice call from your Flex/WhatsApp account into the Teams Demo:

## What you need from the demo account

- `TWILIO_PHONE_NUMBER` — the demo E.164 number (from your demo `.env`)

## Steps in the Flex/WhatsApp account

1. Log in to the [Twilio Console](https://console.twilio.com) for the **Flex/WhatsApp account**.

2. Create a TwiML Bin (or configure a TwiML App) with the following content:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Number>+1XXXXXXXXXX</Number>
  </Dial>
</Response>
```

Replace `+1XXXXXXXXXX` with the demo account's `TWILIO_PHONE_NUMBER`.

3. Assign this TwiML Bin/App to the WhatsApp sender or phone number in the Flex account you will call from.

## How it works

The WhatsApp Voice call is forwarded to the demo phone number via PSTN. The demo server handles everything from that point — greeting, AI agent, Teams transfer, and Flex fallback all run identically to the Voice SDK client path.

The demo server has no WhatsApp-specific code.
```

- [ ] **Step 2: Commit**

```bash
git add docs/whatsapp-flex-setup.md
git commit -m "docs: WhatsApp/Flex A2A setup guide"
```

---

## Final Smoke Test

After deploying:

1. `curl https://teams-demo.fly.dev/health` → `{"status":"ok"}`
2. Open `https://teams-demo.fly.dev` → login form appears
3. Enter demo password → dialler appears with "SDK Ready" green dot
4. Click dial → status badge: `Connecting… → Greeting → Talking to AI agent… → Transferring to Teams…`
5. Teams rings → if answered, badge shows `In call with Teams`
6. If Teams doesn't answer in 30s → call falls to Flex agent
7. (Optional) WhatsApp path: call from the Flex/WA account sender → same flow from step 4

---

## Implementation Notes (from self-review)

### CR handler: move OpenAI client inside `handleConversationRelay`

The plan's Task 8 shows `const openai = new OpenAI(...)` at module scope. This prevents the "OpenAI throws" test from working because `mockImplementationOnce` on the constructor won't affect an already-created instance. Use this implementation instead:

```typescript
// src/ws/conversation-relay.ts — correct version
export function handleConversationRelay(ws: WebSocket): void {
  const openai = new OpenAI({ apiKey: config.openai.apiKey }); // ← inside the function
  const history: ChatMessage[] = [];
  // ... rest of implementation unchanged
}
```

### Token test: self-contain the `jest.mock` factory

`jest.mock` is hoisted above variable declarations, so outer variables referenced inside the factory are `undefined`. The corrected test mock:

```typescript
// tests/routes/token.test.ts — replace the top-of-file mock block with:
jest.mock('twilio', () => {
  const MockAT = jest.fn().mockImplementation(() => ({
    addGrant: jest.fn(),
    toJwt: jest.fn().mockReturnValue('mock.jwt.token'),
  }));
  (MockAT as any).VoiceGrant = jest.fn().mockImplementation(() => ({}));
  return { jwt: { AccessToken: MockAT } };
});

import { app } from '../../src/server';
```

### CR test: self-contain `mockStreamChunks`

Same hoisting issue. Move the chunks array inside the factory:

```typescript
// tests/ws/conversation-relay.test.ts — replace the openai mock with:
jest.mock('openai', () => {
  const chunks = [
    { choices: [{ delta: { content: 'I can help with that. ' } }] },
    { choices: [{ delta: { content: 'Transferring you now. [TRANSFER]' } }] },
  ];
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            [Symbol.asyncIterator]: async function* () {
              for (const chunk of chunks) yield chunk;
            },
          }),
        },
      },
    })),
  };
});
```

For the "throws" test case, re-implement after import:

```typescript
it('sends end message when OpenAI throws', async () => {
  const { OpenAI } = require('openai');
  (OpenAI as jest.Mock).mockImplementationOnce(() => ({
    chat: { completions: { create: jest.fn().mockRejectedValue(new Error('API error')) } },
  }));
  // ... rest of test unchanged (but now handleConversationRelay creates a fresh OpenAI per call)
});
```
