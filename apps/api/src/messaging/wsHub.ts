import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { requireSession } from '../auth/authService.js';
import type { MessageView } from './messageService.js';

/** conversationId -> Set of connected sockets (all participants authenticated at connect). */
const online = new Map<bigint, WebSocket>();
const conversationMembers = new Map<number, Set<bigint>>();

export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const token = url.searchParams.get('token');
    let ctx: any;
    try {
      ctx = await requireSession(token ?? undefined);
    } catch {
      ws.close(4001, 'Unauthorized');
      return;
    }
    const userId = ctx.userId as bigint;
    online.set(userId, ws);

    ws.on('message', (raw) => {
      // client protocol: {"type":"subscribe","conversationId":123}
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'subscribe' && Number.isFinite(Number(msg.conversationId))) {
          const convId = Number(msg.conversationId);
          // only conversation participants may subscribe
          import('./messageService.js').then(({ isParticipant }) => {
            isParticipant(BigInt(convId), userId)
              .then((ok) => {                if (!ok) return;
                const set = conversationMembers.get(convId) ?? new Set<bigint>();
                set.add(userId);
                conversationMembers.set(convId, set);
              })
              .catch(() => { /* deny on error */ });
          }).catch(() => { /* deny on error */ });
        }
      } catch { /* ignore malformed frames */ }
    });

    ws.on('close', () => {
      if (online.get(userId) === ws) online.delete(userId);
      for (const set of conversationMembers.values()) set.delete(userId);
    });
  });

  return wss;
}

/** Deliver a message to all online participants who subscribed to the conversation. */
export function deliverMessage(conversationId: number, message: MessageView): void {
  const members = conversationMembers.get(conversationId);
  if (!members) return;
  const frame = JSON.stringify({ type: 'message', message });
  for (const uid of members) {
    const ws = online.get(uid);
    if (ws && ws.readyState === WebSocket.OPEN) { ws.send(frame); } 
  }
}

export function isOnline(userId: bigint): boolean {
  return online.has(userId);
}
