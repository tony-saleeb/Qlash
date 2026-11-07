// node scripts/security/check-grants.mjs
// env: SUPABASE_URL, SUPABASE_ANON_KEY, TEST_HOST_EMAIL, TEST_HOST_PASSWORD, FOREIGN_QUIZ_ID
import { createClient } from '@supabase/supabase-js';
const { SUPABASE_URL: url, SUPABASE_ANON_KEY: key, TEST_HOST_EMAIL, TEST_HOST_PASSWORD, FOREIGN_QUIZ_ID } = process.env;
const zero = '00000000-0000-4000-8000-000000000000';
const rows = [];
const check = (name, ok, detail) => rows.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`);
const anon = createClient(url, key, { auth: { persistSession: false } });
const r1 = await anon.rpc('submit_live_answer', { p_player_id: zero, p_token: 'x', p_session_id: zero, p_question_id: zero, p_selected: ['1'] });
check('anon cannot execute submit_live_answer', r1.error?.code === '42501', r1.error?.code ?? 'no error');
const host = createClient(url, key, { auth: { persistSession: false } });
const { data: auth, error: authErr } = await host.auth.signInWithPassword({ email: TEST_HOST_EMAIL, password: TEST_HOST_PASSWORD });
if (authErr) throw authErr;
const uid = auth.user.id;
const r2 = await host.from('hosts').update({ plan: 'org' }).eq('id', uid);
check('host cannot change own plan', r2.error?.code === '42501', r2.error?.code ?? 'no error');
const r3 = await host.from('game_sessions').insert({ quiz_id: FOREIGN_QUIZ_ID, host_id: uid, pin: '000001', status: 'finished' });
check('host cannot attach a session to a foreign quiz', /QUIZ_NOT_OWNED/.test(r3.error?.message ?? ''), r3.error?.message ?? 'no error');
const r4 = await host.storage.from('question-media').upload(`${uid}/probe/${Date.now()}.html`, new Blob(['<h1>x</h1>'], { type: 'text/html' }), { contentType: 'text/html' });
check('bucket rejects text/html', Boolean(r4.error), r4.error?.message ?? 'uploaded');
const r5 = await host.storage.from('question-media').upload(`${uid}/probe/${Date.now()}.png`, new Blob([new Uint8Array(6 * 1024 * 1024)], { type: 'image/png' }), { contentType: 'image/png' });
check('bucket rejects a 6 MB image', Boolean(r5.error), r5.error?.message ?? 'uploaded');
console.log(rows.join('\n'));
process.exit(rows.some((r) => r.startsWith('FAIL')) ? 1 : 0);
