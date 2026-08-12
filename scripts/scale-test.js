const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envPath = './.env.local';
if (!fs.existsSync(envPath)) {
  console.error('Error: .env.local file not found.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach((line) => {
  const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const NUM_PLAYERS = 80;
const SERVER_URL = process.env.SCALE_TEST_URL || 'http://localhost:3000/api/submit-answer';

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

function summarize(label, latencies, success, fail) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / (sorted.length || 1);
  console.log(`\n--- ${label} ---`);
  console.log(`Success: ${success}  Fail: ${fail}`);
  if (sorted.length) {
    console.log(`p50: ${percentile(sorted, 50)}ms  p95: ${percentile(sorted, 95)}ms  avg: ${avg.toFixed(0)}ms`);
    console.log(`min: ${sorted[0]}ms  max: ${sorted[sorted.length - 1]}ms`);
  }
}

async function submitViaApi(sessionId, player, token, questionId) {
  const start = Date.now();
  const response = await fetch(SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      playerId: player.id,
      token,
      questionId,
      selectedAnswerIds: ['opt_2'],
    }),
  });
  const latency = Date.now() - start;
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok && body.success, latency, error: body.error };
}

async function submitViaRpc(sessionId, player, token, questionId) {
  const start = Date.now();
  const { data, error } = await supabase.rpc('submit_live_answer', {
    p_player_id: player.id,
    p_token: token,
    p_session_id: sessionId,
    p_question_id: questionId,
    p_selected: ['opt_2'],
  });
  const latency = Date.now() - start;
  return { ok: !error && data?.success, latency, error: error?.message };
}

async function runScaleTest() {
  console.log('=== QuizArena Scale Test (80 players) ===');
  console.log(`API: ${SERVER_URL}`);
  console.log('Tip: measure against `pnpm start` (production), not only `pnpm dev`.\n');

  const { data: hosts, error: hostErr } = await supabase.from('hosts').select('id').limit(1);
  if (hostErr || !hosts?.length) {
    console.error('No host found. Sign up once in the app first.', hostErr);
    process.exit(1);
  }
  const hostId = hosts[0].id;

  const { data: quiz, error: quizErr } = await supabase
    .from('quizzes')
    .insert({ host_id: hostId, title: 'Scale Test Quiz (Auto)', description: 'scale-test' })
    .select()
    .single();
  if (quizErr || !quiz) {
    console.error('Quiz create failed', quizErr);
    process.exit(1);
  }

  const { data: question, error: questionErr } = await supabase
    .from('questions')
    .insert({
      quiz_id: quiz.id,
      order_index: 0,
      type: 'mcq',
      prompt: 'What is 10 + 10?',
      answers: [
        { id: 'opt_1', text: '10', is_correct: false, color: '#ef4444', shape: 'triangle' },
        { id: 'opt_2', text: '20', is_correct: true, color: '#3b82f6', shape: 'diamond' },
      ],
    })
    .select()
    .single();
  if (questionErr || !question) {
    await supabase.from('quizzes').delete().eq('id', quiz.id);
    console.error('Question create failed', questionErr);
    process.exit(1);
  }

  const pin = Math.floor(100000 + Math.random() * 900000).toString();
  const { data: session, error: sessionErr } = await supabase
    .from('game_sessions')
    .insert({
      quiz_id: quiz.id,
      host_id: hostId,
      pin,
      status: 'question_active',
      current_question_index: 0,
      question_started_at: new Date().toISOString(),
      question_order: [question.id],
      active_multiplier: 1,
    })
    .select()
    .single();
  if (sessionErr || !session) {
    await supabase.from('questions').delete().eq('id', question.id);
    await supabase.from('quizzes').delete().eq('id', quiz.id);
    console.error('Session create failed', sessionErr);
    process.exit(1);
  }

  const tokenByNickname = {};
  const playersToInsert = [];
  for (let i = 1; i <= NUM_PLAYERS; i++) {
    const nickname = `Player_${i}`;
    tokenByNickname[nickname] = `token_player_${i}_${Math.random().toString(36).slice(2, 8)}`;
    playersToInsert.push({
      session_id: session.id,
      nickname,
      connected: true,
      score: 0,
      streak: 0,
    });
  }

  const { data: players, error: playersErr } = await supabase
    .from('players')
    .insert(playersToInsert)
    .select();
  if (playersErr || !players || players.length !== NUM_PLAYERS) {
    console.error('Players insert failed', playersErr);
    await supabase.from('game_sessions').delete().eq('id', session.id);
    await supabase.from('questions').delete().eq('id', question.id);
    await supabase.from('quizzes').delete().eq('id', quiz.id);
    process.exit(1);
  }

  const { error: tokensErr } = await supabase.from('player_tokens').insert(
    players.map((p) => ({ player_id: p.id, client_token: tokenByNickname[p.nickname] }))
  );
  if (tokensErr) {
    console.error('Tokens insert failed', tokensErr);
    await supabase.from('game_sessions').delete().eq('id', session.id);
    await supabase.from('questions').delete().eq('id', question.id);
    await supabase.from('quizzes').delete().eq('id', quiz.id);
    process.exit(1);
  }

  console.log(`Prepared session ${pin} with ${players.length} players.`);

  // 1) Warmup (ignore timing — JIT / connection setup)
  console.log('\nWarming up API...');
  await submitViaApi(session.id, players[0], tokenByNickname[players[0].nickname], question.id);
  // clear that answer so player 0 can submit again in burst? unique constraint — use remaining players for burst
  // Delete player 0's submission from warmup
  await supabase
    .from('answers_submitted')
    .delete()
    .eq('session_id', session.id)
    .eq('player_id', players[0].id);

  // 2) Single-player baseline (what one user feels)
  const baseline = await submitViaApi(
    session.id,
    players[0],
    tokenByNickname[players[0].nickname],
    question.id
  );
  summarize('Single player (best-case feel)', [baseline.latency], baseline.ok ? 1 : 0, baseline.ok ? 0 : 1);

  // 3) Direct RPC baseline (bypasses Next.js — true DB speed)
  const rpcBase = await submitViaRpc(
    session.id,
    players[1],
    tokenByNickname[players[1].nickname],
    question.id
  );
  if (!rpcBase.ok && rpcBase.error) {
    console.log(`\nDirect RPC note: ${rpcBase.error}`);
    console.log('If function missing, run schema-fast-submit.sql in Supabase.');
  } else {
    summarize('Direct Supabase RPC (no Next.js)', [rpcBase.latency], rpcBase.ok ? 1 : 0, rpcBase.ok ? 0 : 1);
  }

  // 4) Full burst through Next API — no artificial stagger (worst-case stampede)
  console.log('\nFiring 80 concurrent API submits (no stagger)...');
  await supabase.from('answers_submitted').delete().eq('session_id', session.id);

  let success = 0;
  let fail = 0;
  const latencies = [];
  const wallStart = Date.now();
  await Promise.all(
    players.map(async (player, index) => {
      try {
        const result = await submitViaApi(
          session.id,
          player,
          tokenByNickname[player.nickname],
          question.id
        );
        latencies.push(result.latency);
        if (result.ok) success++;
        else {
          fail++;
          if (fail <= 5) console.error(`Reject P${index + 1}:`, result.error);
        }
      } catch (err) {
        fail++;
        latencies.push(0);
        console.error(`Error P${index + 1}:`, err.message);
      }
    })
  );
  const wall = Date.now() - wallStart;
  summarize('80 concurrent via Next API', latencies.filter((l) => l > 0), success, fail);
  console.log(`Wall clock: ${wall}ms`);

  const { data: dbSubmissions } = await supabase
    .from('answers_submitted')
    .select('id')
    .eq('session_id', session.id);
  console.log(`\nDB rows: ${dbSubmissions?.length ?? 0} / ${NUM_PLAYERS}`);
  if ((dbSubmissions?.length ?? 0) === NUM_PLAYERS) {
    console.log('✅ All answers persisted.');
  } else {
    console.error('❌ Persistence mismatch.');
  }

  console.log('\nCleaning up...');
  await supabase.from('game_sessions').delete().eq('id', session.id);
  await supabase.from('questions').delete().eq('id', question.id);
  await supabase.from('quizzes').delete().eq('id', quiz.id);
  console.log('=== Done ===');
  console.log('\nHow to read this:');
  console.log('- Single player ≈ what one phone feels (goal: <500ms on prod).');
  console.log('- Direct RPC ≈ DB floor (if this is fast but API is slow, Next/dev is the cost).');
  console.log('- 80 concurrent avg rises under stampede; real games answer over several seconds.');
}

runScaleTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
