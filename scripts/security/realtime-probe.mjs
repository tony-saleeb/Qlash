// node scripts/security/realtime-probe.mjs <sessionId>
// env: SUPABASE_URL, SUPABASE_ANON_KEY
import { createClient } from '@supabase/supabase-js';
const [sessionId] = process.argv.slice(2);
if (!sessionId) throw new Error('usage: realtime-probe.mjs <sessionId>');
const mk = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const join = (topic, isPrivate) => new Promise((resolve) => {
  const ch = mk().channel(topic, { config: { private: isPrivate, broadcast: { ack: true } } });
  const got = [];
  ch.on('broadcast', { event: '*' }, (m) => got.push(m.event));
  ch.subscribe((status, err) => {
    if (['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) resolve({ ch, status, err: err?.message ?? '', got });
  });
  setTimeout(() => resolve({ ch, status: 'NO_REPLY', err: '', got }), 8000);
});
const listener = await join(`session:${sessionId}`, true);
console.log('1 anon joins private session topic :', listener.status);
const hostTopic = await join(`session:${sessionId}:host`, true);
console.log('2 anon joins private host topic    :', hostTopic.status, hostTopic.err);
const attacker = await join(`session:${sessionId}`, true);
const sent = await attacker.ch.send({ type: 'broadcast', event: 'question:start',
  payload: { question_id: 'spoof', type: 'mcq', prompt: 'SPOOF', time_limit_seconds: 20, answers: [{ id: '1', text: 'x' }], question_index: 9999 } });
console.log('3 anon send on private topic       :', sent);
const legacy = await join(`session_channel_${sessionId}`, false);
console.log('4 anon joins legacy public topic   :', legacy.status);
await new Promise((r) => setTimeout(r, 3000));
console.log('5 spoofed question:start received  :', listener.got.filter((e) => e === 'question:start').length);
console.log('6 click Next on the host within 60 s ...');
await new Promise((r) => setTimeout(r, 60000));
console.log('7 events received by listener      :', listener.got.join(', ') || '(none)');
process.exit(0);
