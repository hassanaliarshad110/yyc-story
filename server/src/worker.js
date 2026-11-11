// YYC City Stories multiplayer: one Durable Object per room keeps the players connected over WebSockets.
// It relays positions (about 6 times a second), text chat and the WebRTC handshakes for proximity voice chat.
// Voice itself goes player-to-player (WebRTC); this server never sees or stores audio.
const MAX = 40;                                   // players per room
const ORIGINS = ['https://calgaryinsight.ca', 'https://www.calgaryinsight.ca', 'https://hassanaliarshad110.github.io', 'http://localhost:8765'];

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/health') return new Response('ok', { headers: { 'access-control-allow-origin': '*' } });
    const m = url.pathname.match(/^\/room\/([a-z0-9-]{1,32})$/);
    if (!m) return new Response('YYC City Stories multiplayer', { status: 404 });
    const origin = req.headers.get('origin') || '';
    if (origin && !ORIGINS.includes(origin)) return new Response('forbidden', { status: 403 });
    if (req.headers.get('upgrade') !== 'websocket') return new Response('expected a websocket', { status: 426 });
    const id = env.ROOM.idFromName(m[1]);
    return env.ROOM.get(id).fetch(req);
  },
};

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').slice(0, n);

export class Room {
  constructor(state, env) { this.state = state; }
  sockets() { return this.state.getWebSockets(); }
  async fetch(req) {
    if (this.sockets().length >= MAX) return new Response('room full', { status: 503 });
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    const id = crypto.randomUUID().slice(0, 8);
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ id, name: 'Player', look: 'ali', p: null });
    server.send(JSON.stringify({ t: 'welcome', id, players: this.sockets().filter(w => w !== server).map(w => w.deserializeAttachment()).filter(a => a.p) }));
    return new Response(null, { status: 101, webSocket: client });
  }
  broadcast(from, msg) { const s = JSON.stringify(msg); for (const w of this.sockets()) if (w !== from) { try { w.send(s); } catch (e) { } } }
  async webSocketMessage(ws, data) {
    if (typeof data !== 'string' || data.length > 8000) return;
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    const a = ws.deserializeAttachment();
    if (m.t === 'hello') { a.name = clean(m.name, 20) || 'Player'; a.look = clean(m.look, 12); ws.serializeAttachment(a); this.broadcast(ws, { t: 'join', id: a.id, name: a.name, look: a.look }); }
    else if (m.t === 'pos') {
      const n = v => (typeof v === 'number' && isFinite(v) ? Math.round(v * 100) / 100 : 0);
      a.p = [n(m.x), n(m.y), n(m.z), n(m.h), clean(m.mode, 6), clean(m.anim, 10), Math.max(0, Math.min(99999, Math.round(+m.sc || 0))), Math.max(0, Math.min(100, Math.round(+m.hp || 0))), m.tm === 'r' || m.tm === 'b' ? m.tm : '', clean(m.ride, 12)]; ws.serializeAttachment(a);
      this.broadcast(ws, { t: 'pos', id: a.id, name: a.name, look: a.look, p: a.p });
    }
    else if (m.t === 'chat') { const text = clean(m.text, 200); if (text) this.broadcast(ws, { t: 'chat', id: a.id, name: a.name, text }); }
    else if (m.t === 'g' && m.d && typeof m.d === 'object') {      // games: shots, splashes, races (relayed as they are, small)
      const d = JSON.stringify(m.d); if (d.length > 2000) return;
      if (m.to) { for (const w of this.sockets()) if (w.deserializeAttachment().id === m.to) { try { w.send(JSON.stringify({ t: 'g', id: a.id, name: a.name, d: m.d })); } catch (e) { } break; } }
      else this.broadcast(ws, { t: 'g', id: a.id, name: a.name, d: m.d });
    }
    else if (m.t === 'rtc' && m.to) {              // a WebRTC offer, answer or ICE candidate for one player
      for (const w of this.sockets()) if (w.deserializeAttachment().id === m.to) { try { w.send(JSON.stringify({ t: 'rtc', from: a.id, d: m.d })); } catch (e) { } break; }
    }
  }
  async webSocketClose(ws) { const a = ws.deserializeAttachment(); this.broadcast(ws, { t: 'leave', id: a.id }); }
  async webSocketError(ws) { const a = ws.deserializeAttachment(); this.broadcast(ws, { t: 'leave', id: a.id }); }
}
