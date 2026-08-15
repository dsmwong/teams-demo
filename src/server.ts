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
import logStreamRouter from './routes/log-stream';

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
app.use('/log-stream',  logStreamRouter);

const server = http.createServer(app);

const wss = new WebSocket.Server({ noServer: true });
wss.on('connection', (ws) => handleConversationRelay(ws));

server.on('upgrade', (req, socket, head) => {
  console.log(`[upgrade] url=${req.url} origin=${req.headers.origin ?? 'none'}`);
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
