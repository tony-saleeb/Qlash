// node scripts/scale-realtime.mjs <sessionId> [players=80]
// env: SUPABASE_URL, SUPABASE_ANON_KEY
import { createClient } from '@supabase/supabase-js';

const sessionId = process.argv[2];
const players = Number(process.argv[3] ?? '80');
if (!sessionId || !Number.isInteger(players) || players < 1) {
  console.error('usage: node scripts/scale-realtime.mjs <sessionId> [players=80]');
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
  process.exit(1);
}

const EVENTS = ['session:state', 'question:start'];

function payloadOf(message) {
  if (
    message &&
    typeof message === 'object' &&
    'payload' in message &&
    message.payload &&
    typeof message.payload === 'object'
  ) {
    return message.payload;
  }
  return message && typeof message === 'object' ? message : {};
}

function eventKey(event, payload) {
  if (event === 'session:state') {
    const row = payload.new && typeof payload.new === 'object' ? payload.new : payload;
    return [row.status, row.current_question_index, row.question_started_at, row.active_multiplier].join('|');
  }
  return [payload.question_id, payload.question_index, payload.server_started_at].join('|');
}

/** @type {Map<string, { event: string, times: Map<number, number> }>} */
const waves = new Map();
/** @type {string[]} */
const order = [];

function record(event, message, clientIndex) {
  const id = `${event}\0${eventKey(event, payloadOf(message))}`;
  let wave = waves.get(id);
  if (!wave) {
    wave = { event, times: new Map() };
    waves.set(id, wave);
    order.push(id);
  }
  if (!wave.times.has(clientIndex)) wave.times.set(clientIndex, Date.now());
}

const clients = [];

for (let i = 0; i < players; i += 1) {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const channel = client.channel(`session:${sessionId}`, {
    config: { private: true },
  });
  const index = i;
  for (const event of EVENTS) {
    channel.on('broadcast', { event }, (message) => {
      record(event, message, index);
    });
  }
  clients.push({ client, channel, subscribed: false });
  channel.subscribe((status) => {
    clients[index].subscribed = status === 'SUBSCRIBED';
  });
}

function connectedCount() {
  return clients.reduce((sum, client) => sum + (client.subscribed ? 1 : 0), 0);
}

function eventCounts() {
  const totals = { 'session:state': 0, 'question:start': 0 };
  for (const wave of waves.values()) totals[wave.event] += 1;
  return totals;
}

function missedLatest() {
  const id = order[order.length - 1];
  if (!id) return 0;
  return players - (waves.get(id)?.times.size ?? 0);
}

function printStatus() {
  const totals = eventCounts();
  console.log(
    `connected=${connectedCount()}/${players} session:state=${totals['session:state']} question:start=${totals['question:start']} missed=${missedLatest()}`,
  );
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((sorted.length * p) / 100) - 1));
  return sorted[index];
}

function printSpreads() {
  for (const event of EVENTS) {
    const spreads = [];
    for (const wave of waves.values()) {
      if (wave.event !== event || wave.times.size === 0) continue;
      const stamps = [...wave.times.values()];
      spreads.push(Math.max(...stamps) - Math.min(...stamps));
    }
    spreads.sort((a, b) => a - b);
    console.log(`${event} n=${spreads.length} p50=${percentile(spreads, 50)}ms p95=${percentile(spreads, 95)}ms`);
  }
}

const timer = setInterval(printStatus, 5000);
printStatus();

let stopping = false;
process.on('SIGINT', () => {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  printSpreads();
  Promise.all(clients.map(({ client, channel }) => client.removeChannel(channel)))
    .catch(() => {})
    .finally(() => process.exit(0));
});
