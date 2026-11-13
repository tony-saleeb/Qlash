'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { DEFAULT_QUIZ_THEME } from '@/lib/game/theme';
import { getHostAuth } from '@/lib/supabase/hostAuth';
import { createAdminClient } from '@/lib/supabase/admin';
import { quizLibraryCap } from '@/lib/game/constants';
import { getContentPack } from '@/lib/content/packs';
import { packToQuestionRows } from '@/lib/content/packRows';
import { generateShareCode, isShareCode, normalizeShareCode } from '@/lib/content/shareCode';
import { hasDuplicateAnswerIds } from '@/app/dashboard/quizzes/[id]/edit/quizEditorModel';
import { remapDoublePointsRounds, doublePointsQuestionIds } from '@/lib/game/doublePoints';
import { assertPlayableQuestions } from '@/lib/game/questionRules';
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
  /** Quiz updated_at the editor loaded. A mismatch means another tab saved first. */
  expected_updated_at?: string;
}


async function assertQuizQuota(supabase: SupabaseClient, hostId: string) {
  const { data: host } = await supabase.from('hosts').select('plan').eq('id', hostId).maybeSingle();
  const cap = quizLibraryCap(host?.plan);
  if (!Number.isFinite(cap)) return;

    const { count, error } = await supabase
    .from('quizzes')
    .select('id', { count: 'exact', head: true })
    .eq('host_id', hostId)
    .is('deleted_at', null);
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
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', quizId)
      .eq('host_id', user.id)
      .is('deleted_at', null);

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
      .is('deleted_at', null)
      .single();

    if (quizError || !originalQuiz) throw new Error('Quiz not found.');

    // Fetch original questions
    const { data: originalQuestions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId)
      .is('archived_at', null)
      .order('order_index', { ascending: true });

    if (questionsError) throw questionsError;

    const sourceQuestions = originalQuestions ?? [];
    const nextIdBySourceId = new Map<string, string>();
    const clonedQuestionsData = sourceQuestions.map((q) => {
      const id = crypto.randomUUID();
      if (q.id) nextIdBySourceId.set(q.id, id);
      return {
        id,
        quiz_id: '',
        order_index: q.order_index,
        type: q.type,
        prompt: q.prompt,
        media_url: q.media_url,
        media_type: q.media_type,
        time_limit_seconds: q.time_limit_seconds,
        points_base: q.points_base,
        scoring_type: q.scoring_type,
        answers: q.answers,
      };
    });

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
        double_points_rounds: remapDoublePointsRounds(
          originalQuiz.double_points_rounds,
          sourceQuestions,
          nextIdBySourceId
        ),
      })
      .select()
      .single();

    if (cloneQuizError || !newQuiz) throw cloneQuizError;

    if (clonedQuestionsData.length > 0) {
      const { error: insertQuestionsError } = await supabase.from('questions').insert(
        clonedQuestionsData.map((question) => ({ ...question, quiz_id: newQuiz.id }))
      );

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
    assertPlayableQuestions(questions);
    if (questions.some((question) => hasDuplicateAnswerIds(question.answers))) {
      throw new Error('Two answer options share an id.');
    }

    const { supabase, user } = await getHostAuth();
    const updatedAt = new Date().toISOString();

    // 1. Verify ownership. When the editor sends the stamp it loaded, the
    // update matches zero rows if another tab saved in between, and we stop
    // before any question is deleted.
    let quizUpdate = supabase
      .from('quizzes')
      .update({
        title: settings.title,
        description: settings.description,
        theme: settings.theme,
        randomize_questions: settings.randomize_questions,
        randomize_answers: settings.randomize_answers,
        team_mode: settings.team_mode,
        double_points_rounds: doublePointsQuestionIds(settings.double_points_rounds, questions),
        updated_at: updatedAt,
      })
      .eq('id', quizId)
      .eq('host_id', user.id);
    if (settings.expected_updated_at) {
      quizUpdate = quizUpdate.eq('updated_at', settings.expected_updated_at);
    }
    const { data: savedQuiz, error: updateQuizError } = await quizUpdate
      .select('updated_at')
      .maybeSingle();

    if (updateQuizError) throw updateQuizError;
    if (!savedQuiz) {
      throw new Error('This quiz was saved somewhere else. Reload the page before saving again.');
    }

    // 2. Fetch existing question IDs to identify deletions
    const { data: existingQs, error: fetchQsError } = await supabase
      .from('questions')
      .select('id')
      .eq('quiz_id', quizId)
      .is('archived_at', null);

    if (fetchQsError) throw fetchQsError;

    const existingIds = existingQs?.map((q) => q.id) || [];
    const incomingIds = questions.map((q) => q.id).filter((id): id is string => !!id);
    const deleteIds = existingIds.filter((id) => !incomingIds.includes(id));

    // 3. Perform Deletions
    if (deleteIds.length > 0) {
      const { error: archiveError } = await supabase
        .from('questions')
        .update({ archived_at: new Date().toISOString() })
        .in('id', deleteIds);
      if (archiveError) throw archiveError;
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
        // Keep the editor's id so the next save updates this row instead of
        // deleting it and inserting a copy (which cascades away past answers).
        toInsert.push(q.id ? { ...row, id: q.id } : row);
      }
    }

    let insertedRows: { id: string; order_index: number }[] = [];
    if (toInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('questions')
        .insert(toInsert)
        .select('id, order_index');
      if (insertError) throw insertError;
      insertedRows = (inserted ?? []) as { id: string; order_index: number }[];
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

    const insertedByOrder = new Map(insertedRows.map((row) => [row.order_index, row.id]));
    const questionIds = questions.map((q, index) => {
      if (q.id && existingIds.includes(q.id)) return q.id;
      return insertedByOrder.get(index) ?? q.id ?? '';
    });

    return {
      success: true as const,
      updatedAt: (savedQuiz.updated_at as string | undefined) ?? updatedAt,
      questionIds,
    };
  } catch (err: unknown) {
    console.error('saveQuizData error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to save quiz.');
  }
}

export async function createPackQuiz(packId: string) {
  try {
    const pack = getContentPack(packId);
    if (!pack) throw new Error('Unknown content pack.');
    const rows = packToQuestionRows('pending', pack);
    assertPlayableQuestions(rows);
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
      .insert(rows.map((row) => ({ ...row, quiz_id: quiz.id })));

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

export async function rotateQuizShare(quizId: string) {
  try {
    const { supabase, user } = await getHostAuth();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const shareCode = generateShareCode();
      const { data, error } = await supabase
        .from('quizzes')
        .update({ share_code: shareCode })
        .eq('id', quizId)
        .eq('host_id', user.id)
        .select('share_code')
        .maybeSingle();
      if (!error && data?.share_code) {
        revalidatePath('/dashboard');
        return { shareCode: data.share_code as string };
      }
      if (error && !/duplicate|unique/i.test(error.message || '')) throw error;
      if (!error && !data) throw new Error('Quiz not found.');
    }
    throw new Error('Could not create a share link.');
  } catch (err: unknown) {
    console.error('rotateQuizShare error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to replace the share link.');
  }
}

export async function stopQuizShare(quizId: string) {
  try {
    const { supabase, user } = await getHostAuth();
    const { data, error } = await supabase
      .from('quizzes')
      .update({ share_code: null })
      .eq('id', quizId)
      .eq('host_id', user.id)
      .select('id')
      .maybeSingle();
    if (error || !data) throw new Error('Quiz not found.');
    revalidatePath('/dashboard');
    return { shareCode: null as string | null };
  } catch (err: unknown) {
    console.error('stopQuizShare error:', err);
    throw new Error(err instanceof Error ? err.message : 'Failed to stop sharing.');
  }
}

export async function importSharedQuiz(rawCode: string) {
  try {
    const { supabase, user } = await getHostAuth();
    const shareCode = normalizeShareCode(rawCode);
    if (!isShareCode(shareCode)) throw new Error('Invalid share code.');

    const { data: already } = await supabase
      .from('quizzes')
      .select('id')
      .eq('host_id', user.id)
      .eq('imported_share_code', shareCode)
      .is('deleted_at', null)
      .maybeSingle();
    if (already?.id) return already;

    await assertQuizQuota(supabase, user.id);

    const admin = createAdminClient();
    const { data: source, error: sourceError } = await admin
      .from('quizzes')
      .select('id, host_id, title, description, cover_image_url, theme, randomize_questions, randomize_answers, team_mode, double_points_rounds')
      .eq('share_code', shareCode)
      .is('deleted_at', null)
      .maybeSingle();

    if (sourceError || !source) throw new Error('That share link is invalid or expired.');
    if (source.host_id === user.id) throw new Error('This quiz is already in your library.');

    const { data: sourceQuestions, error: questionsError } = await admin
      .from('questions')
      .select('id, order_index, type, prompt, media_url, media_type, time_limit_seconds, points_base, scoring_type, answers')
      .eq('quiz_id', source.id)
      .is('archived_at', null)
      .order('order_index', { ascending: true });
    if (questionsError) throw questionsError;

    const importedQuestions = sourceQuestions ?? [];
    assertPlayableQuestions(
      importedQuestions.map((question) => ({
        type: question.type,
        media_url: question.media_url,
        time_limit_seconds: question.time_limit_seconds,
        points_base: question.points_base,
        answers: Array.isArray(question.answers) ? question.answers : [],
      }))
    );
    const nextIdBySourceId = new Map<string, string>();
    const importedRows = importedQuestions.map((question) => {
      const id = crypto.randomUUID();
      if (question.id) nextIdBySourceId.set(question.id, id);
      return {
        id,
        order_index: question.order_index,
        type: question.type,
        prompt: question.prompt,
        media_url: question.media_url,
        media_type: question.media_type,
        time_limit_seconds: question.time_limit_seconds,
        points_base: question.points_base,
        scoring_type: question.scoring_type,
        answers: question.answers,
      };
    });

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
        imported_share_code: shareCode,
        double_points_rounds: remapDoublePointsRounds(
          source.double_points_rounds,
          importedQuestions,
          nextIdBySourceId
        ),
      })
      .select()
      .single();
    if (insertError || !newQuiz) throw insertError;

    if (importedRows.length > 0) {
      const { error: copyError } = await supabase.from('questions').insert(
        importedRows.map((question) => ({
          quiz_id: newQuiz.id,
          ...question,
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

export async function importSharedQuizFromForm(formData: FormData) {
  const quiz = await importSharedQuiz(String(formData.get('code') ?? ''));
  redirect(`/dashboard/quizzes/${quiz.id}/edit`);
}
