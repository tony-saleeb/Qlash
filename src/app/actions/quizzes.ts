'use server';

import { revalidatePath } from 'next/cache';
import { DEFAULT_QUIZ_THEME } from '@/lib/game/theme';
import { getHostAuth } from '@/lib/supabase/hostAuth';
import { createAdminClient } from '@/lib/supabase/admin';
import { quizLibraryCap } from '@/lib/game/constants';
import { getContentPack } from '@/lib/content/packs';
import { packToQuestionRows } from '@/lib/content/packRows';
import { generateShareCode, normalizeShareCode } from '@/lib/content/shareCode';
import type { SupabaseClient } from '@supabase/supabase-js';

interface AnswerOptionInput {
  id: string;
  text: string;
  is_correct: boolean;
  color: string;
  shape: string;
  image_url?: string;
}

interface QuestionInput {
  id?: string;
  type: string;
  prompt: string;
  media_url: string | null;
  media_type: string | null;
  time_limit_seconds: number;
  points_base: number;
  scoring_type: string;
  answers: AnswerOptionInput[];
}

interface QuizSettingsInput {
  title: string;
  description: string;
  theme: Record<string, unknown>;
  randomize_questions: boolean;
  randomize_answers: boolean;
  team_mode: boolean;
  double_points_rounds: string[];
}


async function assertQuizQuota(supabase: SupabaseClient, hostId: string) {
  const { data: host } = await supabase.from('hosts').select('plan').eq('id', hostId).maybeSingle();
  const cap = quizLibraryCap(host?.plan);
  if (!Number.isFinite(cap)) return;

  const { count, error } = await supabase
    .from('quizzes')
    .select('id', { count: 'exact', head: true })
    .eq('host_id', hostId);
  if (error) throw error;
  if ((count || 0) >= cap) {
    throw new Error(`Free plan allows ${cap} saved quizzes. Delete one, or ask for Pro.`);
  }
}

export async function createQuiz(title: string, description: string = '') {
  try {
    const { supabase, user } = await getHostAuth();
    await assertQuizQuota(supabase, user.id);
    const { data, error } = await supabase
      .from('quizzes')
      .insert({
        host_id: user.id,
        title,
        description,
        theme: DEFAULT_QUIZ_THEME,
      })
      .select()
      .single();

    if (error) throw error;
    revalidatePath('/dashboard');
    return data;
  } catch (err: unknown) {
    console.error('createQuiz error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to create quiz.');
  }
}

export async function deleteQuiz(quizId: string) {
  try {
    const { supabase, user } = await getHostAuth();
    const { error } = await supabase
      .from('quizzes')
      .delete()
      .eq('id', quizId)
      .eq('host_id', user.id);

    if (error) throw error;
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: unknown) {
    console.error('deleteQuiz error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to delete quiz.');
  }
}

export async function cloneQuiz(quizId: string) {
  try {
    const { supabase, user } = await getHostAuth();
    await assertQuizQuota(supabase, user.id);

    // Fetch original quiz details
    const { data: originalQuiz, error: quizError } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .eq('host_id', user.id)
      .single();

    if (quizError || !originalQuiz) throw new Error('Quiz not found.');

    // Fetch original questions
    const { data: originalQuestions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('order_index', { ascending: true });

    if (questionsError) throw questionsError;

    // Create cloned quiz
    const { data: newQuiz, error: cloneQuizError } = await supabase
      .from('quizzes')
      .insert({
        host_id: user.id,
        title: `${originalQuiz.title} (Copy)`,
        description: originalQuiz.description,
        cover_image_url: originalQuiz.cover_image_url,
        theme: originalQuiz.theme,
        randomize_questions: originalQuiz.randomize_questions,
        randomize_answers: originalQuiz.randomize_answers,
        team_mode: originalQuiz.team_mode,
        double_points_rounds: originalQuiz.double_points_rounds,
      })
      .select()
      .single();

    if (cloneQuizError || !newQuiz) throw cloneQuizError;

    // Insert cloned questions if any exist
    if (originalQuestions && originalQuestions.length > 0) {
      const clonedQuestionsData = originalQuestions.map((q) => ({
        quiz_id: newQuiz.id,
        order_index: q.order_index,
        type: q.type,
        prompt: q.prompt,
        media_url: q.media_url,
        media_type: q.media_type,
        time_limit_seconds: q.time_limit_seconds,
        points_base: q.points_base,
        scoring_type: q.scoring_type,
        answers: q.answers,
      }));

      const { error: insertQuestionsError } = await supabase
        .from('questions')
        .insert(clonedQuestionsData);

      if (insertQuestionsError) throw insertQuestionsError;
    }

    revalidatePath('/dashboard');
    return newQuiz;
  } catch (err: unknown) {
    console.error('cloneQuiz error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to clone quiz.');
  }
}

export async function saveQuizData(
  quizId: string,
  settings: QuizSettingsInput,
  questions: QuestionInput[]
) {
  try {
    const { supabase, user } = await getHostAuth();

    // 1. Verify quiz ownership and update settings
    const { error: updateQuizError } = await supabase
      .from('quizzes')
      .update({
        title: settings.title,
        description: settings.description,
        theme: settings.theme,
        randomize_questions: settings.randomize_questions,
        randomize_answers: settings.randomize_answers,
        team_mode: settings.team_mode,
        double_points_rounds: settings.double_points_rounds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quizId)
      .eq('host_id', user.id);

    if (updateQuizError) throw updateQuizError;

    // 2. Fetch existing question IDs to identify deletions
    const { data: existingQs, error: fetchQsError } = await supabase
      .from('questions')
      .select('id')
      .eq('quiz_id', quizId);

    if (fetchQsError) throw fetchQsError;

    const existingIds = existingQs?.map((q) => q.id) || [];
    const incomingIds = questions.map((q) => q.id).filter((id): id is string => !!id);
    const deleteIds = existingIds.filter((id) => !incomingIds.includes(id));

    // 3. Perform Deletions
    if (deleteIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('questions')
        .delete()
        .in('id', deleteIds);
      if (deleteError) throw deleteError;
    }

    const toUpdate: { id: string; row: Record<string, unknown> }[] = [];
    const toInsert: Record<string, unknown>[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const row = {
        quiz_id: quizId,
        order_index: i,
        type: q.type,
        prompt: q.prompt,
        media_url: q.media_url,
        media_type: q.media_type,
        time_limit_seconds: q.time_limit_seconds,
        points_base: q.points_base,
        scoring_type: q.scoring_type,
        answers: q.answers,
      };
      if (q.id && existingIds.includes(q.id)) {
        toUpdate.push({ id: q.id, row });
      } else {
        toInsert.push(row);
      }
    }

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase.from('questions').insert(toInsert);
      if (insertError) throw insertError;
    }

    const chunkSize = 8;
    for (let i = 0; i < toUpdate.length; i += chunkSize) {
      const slice = toUpdate.slice(i, i + chunkSize);
      const results = await Promise.all(
        slice.map(({ id, row }) => supabase.from('questions').update(row).eq('id', id))
      );
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
    }

    return { success: true };
  } catch (err: unknown) {
    console.error('saveQuizData error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to save quiz.');
  }
}

export async function createPackQuiz(packId: string) {
  try {
    const pack = getContentPack(packId);
    if (!pack) throw new Error('Unknown content pack.');
    const { supabase, user } = await getHostAuth();
    await assertQuizQuota(supabase, user.id);

    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .insert({
        host_id: user.id,
        title: pack.title,
        description: pack.description,
        theme: DEFAULT_QUIZ_THEME,
      })
      .select()
      .single();

    if (quizError || !quiz) throw quizError;

    const { error: insertError } = await supabase
      .from('questions')
      .insert(packToQuestionRows(quiz.id, pack));

    if (insertError) throw insertError;

    revalidatePath('/dashboard');
    return quiz;
  } catch (err: unknown) {
    console.error('createPackQuiz error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to add pack.');
  }
}

export async function createTemplateQuiz() {
  return createPackQuiz('sunday-school');
}

export async function enableQuizShare(quizId: string) {
  try {
    const { supabase, user } = await getHostAuth();
    const { data: existing, error: loadError } = await supabase
      .from('quizzes')
      .select('id, share_code')
      .eq('id', quizId)
      .eq('host_id', user.id)
      .single();
    if (loadError || !existing) throw new Error('Quiz not found.');
    if (existing.share_code) return { shareCode: existing.share_code as string };

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const shareCode = generateShareCode();
      const { data, error } = await supabase
        .from('quizzes')
        .update({ share_code: shareCode })
        .eq('id', quizId)
        .eq('host_id', user.id)
        .select('share_code')
        .single();
      if (!error && data?.share_code) return { shareCode: data.share_code as string };
      if (error && !/duplicate|unique/i.test(error.message || '')) throw error;
    }
    throw new Error('Could not create a share link.');
  } catch (err: unknown) {
    console.error('enableQuizShare error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to share quiz.');
  }
}

export async function importSharedQuiz(rawCode: string) {
  try {
    const { supabase, user } = await getHostAuth();
    await assertQuizQuota(supabase, user.id);
    const shareCode = normalizeShareCode(rawCode);
    if (shareCode.length < 6) throw new Error('Invalid share code.');

    const admin = createAdminClient();
    const { data: source, error: sourceError } = await admin
      .from('quizzes')
      .select('id, host_id, title, description, cover_image_url, theme, randomize_questions, randomize_answers, team_mode, double_points_rounds')
      .eq('share_code', shareCode)
      .maybeSingle();

    if (sourceError || !source) throw new Error('That share link is invalid or expired.');
    if (source.host_id === user.id) throw new Error('This quiz is already in your library.');

    const { data: sourceQuestions, error: questionsError } = await admin
      .from('questions')
      .select('order_index, type, prompt, media_url, media_type, time_limit_seconds, points_base, scoring_type, answers')
      .eq('quiz_id', source.id)
      .order('order_index', { ascending: true });
    if (questionsError) throw questionsError;

    const { data: newQuiz, error: insertError } = await supabase
      .from('quizzes')
      .insert({
        host_id: user.id,
        title: source.title,
        description: source.description,
        cover_image_url: source.cover_image_url,
        theme: source.theme,
        randomize_questions: source.randomize_questions,
        randomize_answers: source.randomize_answers,
        team_mode: source.team_mode,
        double_points_rounds: source.double_points_rounds,
      })
      .select()
      .single();
    if (insertError || !newQuiz) throw insertError;

    if (sourceQuestions && sourceQuestions.length > 0) {
      const { error: copyError } = await supabase.from('questions').insert(
        sourceQuestions.map((question) => ({
          quiz_id: newQuiz.id,
          order_index: question.order_index,
          type: question.type,
          prompt: question.prompt,
          media_url: question.media_url,
          media_type: question.media_type,
          time_limit_seconds: question.time_limit_seconds,
          points_base: question.points_base,
          scoring_type: question.scoring_type,
          answers: question.answers,
        }))
      );
      if (copyError) throw copyError;
    }

    revalidatePath('/dashboard');
    return newQuiz;
  } catch (err: unknown) {
    console.error('importSharedQuiz error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to import quiz.');
  }
}
