import type { SupabaseClient } from '@supabase/supabase-js';
import { getContentPack } from '@/lib/content/packs';
import { packToQuestionRows } from '@/lib/content/packRows';
import { DEFAULT_LATE_JOIN_THROUGH_INDEX } from '@/lib/game/lateJoin';
import { DEFAULT_QUIZ_THEME } from '@/lib/game/theme';

export const DEMO_PIN = '100000';
export const DEMO_SHARE_CODE = 'QLASHDEM';

export type DemoSession = { sessionId: string; pin: string };

function retiredPin(): string {
  return `9${Math.floor(10000 + Math.random() * 90000)}`;
}

export async function ensureDemoSession(admin: SupabaseClient): Promise<DemoSession | null> {
  const { data: live } = await admin
    .from('game_sessions')
    .select('id, status, pin')
    .eq('pin', DEMO_PIN)
    .maybeSingle();

  if (live && live.status !== 'finished') {
    return { sessionId: live.id as string, pin: DEMO_PIN };
  }

  if (live?.status === 'finished') {
    await admin.from('game_sessions').update({ pin: retiredPin() }).eq('id', live.id);
  }

  const { data: host } = await admin.from('hosts').select('id').limit(1).maybeSingle();
  if (!host?.id) return null;

  const pack = getContentPack('warmup');
  if (!pack) return null;

  let { data: quiz } = await admin.from('quizzes').select('id').eq('share_code', DEMO_SHARE_CODE).maybeSingle();
  if (!quiz?.id) {
    const inserted = await admin
      .from('quizzes')
      .insert({
        host_id: host.id,
        title: pack.title,
        description: pack.description,
        theme: DEFAULT_QUIZ_THEME,
        share_code: DEMO_SHARE_CODE,
      })
      .select('id')
      .single();
    quiz = inserted.data;
    if (!quiz?.id) return null;
    await admin.from('questions').insert(packToQuestionRows(quiz.id as string, pack));
  }

  const { data: session } = await admin
    .from('game_sessions')
    .insert({
      quiz_id: quiz.id,
      host_id: host.id,
      pin: DEMO_PIN,
      status: 'lobby',
      current_question_index: 0,
      active_multiplier: 1,
      late_join_through_index: DEFAULT_LATE_JOIN_THROUGH_INDEX,
    })
    .select('id')
    .single();

  if (session?.id) return { sessionId: session.id as string, pin: DEMO_PIN };

  const { data: raced } = await admin
    .from('game_sessions')
    .select('id, status')
    .eq('pin', DEMO_PIN)
    .maybeSingle();
  if (raced?.id && raced.status !== 'finished') {
    return { sessionId: raced.id as string, pin: DEMO_PIN };
  }
  return null;
}
