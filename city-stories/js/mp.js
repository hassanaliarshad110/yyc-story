// Play online: see other players walking and driving around Calgary, text chat, and proximity voice chat
// (you hear people near you, louder the closer they are, from the side they're on). Positions and chat go through
// the game's small server; voice goes straight between players (WebRTC) and is never recorded.
import * as THREE from 'three';
import { Character } from './rig.js';
import { LOOKS } from './player.js';
import { ground } from './terrain.js';
import { toast } from './hud.js';
import { ask } from './ask.js';
import { tr } from './i18n.js';

// set once the server is deployed (Cloudflare Workers)
export const MP_URL = 'wss://yyc-city-stories-mp.hasssanaliarshad.workers.dev/room/calgary';
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const VOICE_R = 45, VOICE_FULL = 5, MAX_PEERS = 6;

const tag = (name) => {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d');
  g.font = '700 30px system-ui, sans-serif'; const w = Math.min(240, g.measureText(name).width + 28);
  g.fillStyle = 'rgba(10,16,26,.72)'; g.beginPath(); g.roundRect((256 - w) / 2, 8, w, 46, 14); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 128, 32);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }));
  s.scale.set(1.6, 0.4, 1); s.position.y = 2.25; s.renderOrder = 20; return s;
};

export class Multiplayer {
  constructor(game, scene) {
    this.g = game; this.scene = scene; this.ws = null; this.id = null; this.on = false; this.others = new Map(); this.sendT = 0;
    this.voice = false; this.ptt = false; this.mic = null; this.ac = null; this.peers = new Map();
    this.ui();
  }
  // ---------------------------------------------------------------- UI: online button, chat box, push-to-talk
  ui() {
    const bar = document.createElement('div'); bar.id = 'mpbar'; bar.innerHTML = `
      <button id="mp-online" title="Play online">🌐</button>
      <button id="mp-chat" title="Chat (T)" hidden>💬</button>
      <button id="mp-talk" title="Hold to talk (V)" hidden>🎤</button>
      <div id="mp-feed"></div>
      <form id="mp-form" hidden><input id="mp-input" maxlength="200" autocomplete="off" placeholder="Say something…"><button>Send</button></form>`;
    document.body.appendChild(bar);
    const $ = s => bar.querySelector(s);
    $('#mp-online').onclick = () => this.on ? this.leave() : this.join();
    $('#mp-chat').onclick = () => this.openChat();
    $('#mp-form').onsubmit = e => { e.preventDefault(); const v = $('#mp-input').value.trim(); if (v) this.chat(v); $('#mp-input').value = ''; $('#mp-form').hidden = true; };
    const talk = $('#mp-talk');
    const down = e => { e.preventDefault(); this.setTalk(true); }, up = () => this.setTalk(false);
    talk.addEventListener('pointerdown', down); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) talk.addEventListener(ev, up);
    addEventListener('keydown', e => { if (!this.on || e.target.tagName === 'INPUT') return; if (e.code === 'KeyT') { e.preventDefault(); this.openChat(); } if (e.code === 'KeyV' && !e.repeat) this.setTalk(true); });
    addEventListener('keyup', e => { if (e.code === 'KeyV') this.setTalk(false); });
    this.$ = $;
  }
  openChat() { const f = this.$('#mp-form'); f.hidden = false; this.$('#mp-input').focus(); }
  feed(name, text) {
    const d = document.createElement('div'); d.textContent = (name ? name + ': ' : '') + text; this.$('#mp-feed').appendChild(d);
    while (this.$('#mp-feed').children.length > 6) this.$('#mp-feed').firstChild.remove();
    setTimeout(() => d.classList.add('old'), 12000);
  }
  // ---------------------------------------------------------------- connection
  async join(given) {
    let name = ''; try { name = localStorage.getItem('yyc-mp-name') || ''; } catch (e) { }
    name = (given || (await ask(tr('mpName'), { input: name || '' })) || '').trim().slice(0, 20);
    if (!name) return; try { localStorage.setItem('yyc-mp-name', name); } catch (e) { }
    this.name = name; this.on = true; this.$('#mp-online').classList.add('on');
    this.connect();
  }
  connect() {
    try { this.ws = new WebSocket(MP_URL); } catch (e) { this.fail(); return; }
    this.ws.onopen = () => { this.send({ t: 'hello', name: this.name, look: (this.g.player && this.g.player.look) || this.g.look || 'ali' }); this.$('#mp-chat').hidden = false; this.$('#mp-talk').hidden = false; toast('🌐 You are online. Hold 🎤 to talk to people near you.'); };
    this.ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (err) { return; } this.onMsg(m); };
    this.ws.onclose = () => { if (this.on) { this.clearAll(); setTimeout(() => this.on && this.connect(), 4000); } };
    this.ws.onerror = () => { };
  }
  fail() { toast('Online play is not available right now.'); this.leave(); }
  leave() {
    this.on = false; this.$('#mp-online').classList.remove('on'); this.$('#mp-chat').hidden = true; this.$('#mp-talk').hidden = true; this.$('#mp-form').hidden = true;
    try { this.ws && this.ws.close(); } catch (e) { } this.ws = null; this.clearAll();
    if (this.mic) { this.mic.getTracks().forEach(t => t.stop()); this.mic = null; }
  }
  clearAll() { for (const id of [...this.others.keys()]) this.drop(id); for (const id of [...this.peers.keys()]) this.hangup(id); }
  send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  game(d, to) { this.send(to ? { t: 'g', to, d } : { t: 'g', d }); }
  chat(text) { this.send({ t: 'chat', text }); this.feed(this.name, text); }
  onMsg(m) {
    if (m.t === 'welcome') { this.id = m.id; for (const p of m.players || []) this.upsert(p.id, p.name, p.look, p.p); }
    else if (m.t === 'pos') this.upsert(m.id, m.name, m.look, m.p);
    else if (m.t === 'join') this.feed('', `${m.name} joined`);
    else if (m.t === 'leave') { const o = this.others.get(m.id); if (o) this.feed('', `${o.name} left`); this.drop(m.id); this.hangup(m.id); }
    else if (m.t === 'chat') { this.feed(m.name, m.text); const o = this.others.get(m.id); if (o) this.bubble(o, m.text); }
    else if (m.t === 'rtc') this.onRtc(m.from, m.d);
    else if (m.t === 'g' && this.onGame) this.onGame(m.id, m.name, m.d);
  }
  // ---------------------------------------------------------------- other players
  upsert(id, name, look, p) {
    if (!p || id === this.id) return;
    let o = this.others.get(id);
    if (!o) {
      const L = LOOKS[look] || LOOKS.ali, ch = new Character(L); ch.g.add(tag(name)); this.scene.add(ch.g);
      o = { id, name, look, ch, x: p[0], y: p[1], z: p[2], h: p[3], tx: p[0], ty: p[1], tz: p[2], th: p[3], sp: 0 }; this.others.set(id, o);
    }
    o.tx = p[0]; o.ty = p[1]; o.tz = p[2]; o.th = p[3]; o.mode = p[4]; o.anim = p[5]; o.sc = p[6] || 0; o.hp = p[7] ?? 100; o.seen = performance.now();
  }
  drop(id) { const o = this.others.get(id); if (!o) return; this.scene.remove(o.ch.g); this.others.delete(id); }
  bubble(o, text) {
    if (o.bub) o.ch.g.remove(o.bub);
    const s = tag(text.length > 26 ? text.slice(0, 25) + '…' : text); s.position.y = 2.75; s.scale.set(2.6, 0.65, 1); o.ch.g.add(s); o.bub = s;
    setTimeout(() => { if (o.bub === s) { o.ch.g.remove(s); o.bub = null; } }, 6000);
  }
  // ---------------------------------------------------------------- voice (WebRTC between nearby players)
  async setTalk(on) {
    if (!this.on) return;
    if (on && !this.mic) {
      try { this.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
      catch (e) { toast('Allow the microphone to talk to people near you.'); return; }
      for (const pc of this.peers.values()) this.addMic(pc.pc);
    }
    this.ptt = on; if (this.mic) this.mic.getAudioTracks().forEach(t => t.enabled = on);
    this.$('#mp-talk').classList.toggle('on', on);
  }
  addMic(pc) { if (!this.mic) return; const tr = this.mic.getAudioTracks()[0]; tr.enabled = this.ptt; if (!pc.getSenders().some(s => s.track === tr)) pc.addTrack(tr, this.mic); }
  audio() { if (!this.ac) this.ac = new (window.AudioContext || window.webkitAudioContext)(); if (this.ac.state === 'suspended') this.ac.resume(); return this.ac; }
  call(id) {
    const pc = new RTCPeerConnection({ iceServers: ICE }), polite = this.id > id, P = { pc, polite, making: false, ignore: false };
    this.peers.set(id, P);
    pc.addTransceiver('audio', { direction: 'sendrecv' }); this.addMic(pc);
    pc.onicecandidate = e => e.candidate && this.send({ t: 'rtc', to: id, d: { c: e.candidate } });
    pc.onnegotiationneeded = async () => { try { P.making = true; await pc.setLocalDescription(); this.send({ t: 'rtc', to: id, d: { sdp: pc.localDescription } }); } catch (e) { } finally { P.making = false; } };
    pc.ontrack = e => {
      const ac = this.audio(), el = new Audio(); el.srcObject = e.streams[0] || new MediaStream([e.track]); el.muted = true; el.play().catch(() => { });   // Chrome needs the element to start the stream
      const src = ac.createMediaStreamSource(el.srcObject), gain = ac.createGain(), pan = ac.createStereoPanner(); gain.gain.value = 0;
      src.connect(gain).connect(pan).connect(ac.destination); P.gain = gain; P.pan = pan; P.el = el;
    };
    pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) this.hangup(id); };
    return P;
  }
  async onRtc(from, d) {
    if (!this.on) return;
    const P = this.peers.get(from) || this.call(from), pc = P.pc;
    try {
      if (d.sdp) {
        const collision = d.sdp.type === 'offer' && (P.making || pc.signalingState !== 'stable');
        P.ignore = !P.polite && collision; if (P.ignore) return;
        await pc.setRemoteDescription(d.sdp);
        if (d.sdp.type === 'offer') { await pc.setLocalDescription(); this.send({ t: 'rtc', to: from, d: { sdp: pc.localDescription } }); }
      } else if (d.c) { try { await pc.addIceCandidate(d.c); } catch (e) { if (!P.ignore) throw e; } }
    } catch (e) { }
  }
  hangup(id) { const P = this.peers.get(id); if (!P) return; try { P.pc.close(); } catch (e) { } if (P.gain) P.gain.disconnect(); this.peers.delete(id); }
  // ---------------------------------------------------------------- every frame
  update(dt, player, camH) {
    if (!this.on) return;
    if ((this.sendT -= dt) <= 0 && this.ws && this.ws.readyState === 1) {
      this.sendT = 0.16;
      const anim = player.mode === 'foot' ? (Math.abs(player.v) > 3.5 ? 'run' : Math.abs(player.v) > 0.3 ? 'walk' : 'idle') : player.mode;
      this.send({ t: 'pos', x: player.x, y: player.y, z: player.gy, h: player.h, mode: player.mode, anim, sc: this.g.score || 0, hp: this.g.hp ?? 100 });
    }
    const now = performance.now(), near = [];
    for (const o of this.others.values()) {
      if (now - o.seen > 15000) { this.drop(o.id); continue; }
      const k = Math.min(1, dt * 8), px = o.x, py = o.y;
      o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; o.z += (o.tz - o.z) * k;
      let dh = ((o.th - o.h + Math.PI * 3) % (Math.PI * 2)) - Math.PI; o.h += dh * k;
      o.sp = Math.hypot(o.x - px, o.y - py) / Math.max(dt, 1e-3);
      o.ch.g.position.set(o.x, o.mode === 'foot' ? o.z : ground(o.x, o.y), -o.y); o.ch.g.rotation.y = Math.PI - o.h;
      o.ch.g.visible = o.mode === 'foot' || o.mode === undefined;
      o.ch.animate(dt, { speed: o.sp, run: o.anim === 'run' });
      const d = Math.hypot(o.x - player.x, o.y - player.y); o.d = d; if (d < VOICE_R) near.push(o);
    }
    // voice: connect to the closest players in range, drop those who walked away
    near.sort((a, b) => a.d - b.d); const want = new Set(near.slice(0, MAX_PEERS).map(o => o.id));
    for (const id of want) if (!this.peers.has(id) && this.id < id) this.call(id);       // the lower id starts the call
    for (const id of [...this.peers.keys()]) if (!want.has(id) && !(this.others.get(id) && this.others.get(id).d < VOICE_R + 10)) this.hangup(id);
    for (const [id, P] of this.peers) {
      const o = this.others.get(id); if (!o || !P.gain) continue;
      const v = Math.max(0, Math.min(1, 1 - (o.d - VOICE_FULL) / (VOICE_R - VOICE_FULL)));
      P.gain.gain.setTargetAtTime(v * v, this.ac.currentTime, 0.1);
      const ang = Math.atan2(o.x - player.x, o.y - player.y) - camH; P.pan.pan.setTargetAtTime(Math.sin(ang) * 0.8, this.ac.currentTime, 0.1);
    }
  }
}
