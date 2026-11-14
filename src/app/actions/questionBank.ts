'use server';

import { revalidatePath } from 'next/cache';
import { assertQuizQuota } from '@/app/actions/quizzes';
import {
  MAX_BANK_QUESTIONS,
  MAX_QUESTION_BANKS,
  bankToQuestionRows,
  normalizeBankQuestion,
  normalizeCategoryName,
  pickRandom,
} from '@/lib/content/bankDraw';
import type { PackQuestion } from '@/lib/content/draftQuestion';
import { DEFAULT_QUIZ_THEME } from '@/lib/game/theme';
import { assertPlayableQuestions } from '@/lib/game/questionRules';
import { getHostAuth } from '@/lib/supabase/hostAuth';

export type QuestionBankSummary = { id: string; name: string; count: number };
export type BankQuestionSummary = { id: string; prompt: string };
export type DrawnQuiz = {
  id: string;
  title: string;
  description: string;
  created_at: string;
  questionCount: number;
};

function embeddedCount(value: unknown): number {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object' || !('count' in row)) return 0;
  const count = Number((row as { count: unknown }).count);
  return Number.isFinite(count) ? count : 0;
}

function storedQuestion(row: { prompt?: unknown; answers?: unknown }): PackQuestion {
  if (typeof row.prompt !== 'string' || !Array.isArray(row.answers)) {
    throw new Error('A saved question is unreadable.');
  }
  const answers = row.answers.map((answer) => {
    if (!answer || typeof answer !== 'object' || typeof (answer as { text?: unknown }).text !== 'string') {
      throw new Error('A saved question is unreadable.');
    }
    return {
      text: (answer as { text: string }).text,
      correct: (answer as { correct?: unknown }).correct === true,
    };
  });
  return normalizeBankQuestion(row.prompt, answers);
}

function draftAnswers(answers: unknown): { text: string; correct: boolean }[] {
  if (!Array.isArray(answers)) throw new Error('Add at least two answers.');
  return answers.map((answer) => {
    if (!answer || typeof answer !== 'object') return { text: '', correct: false };
    const row = answer as { text?: unknown; correct?: unknown };
    return {
      text: typeof row.text === 'string' ? row.text : '',
      correct: row.correct === true,
    };
  });
}

export async function listQuestionBanks(): Promise<QuestionBankSummary[]> {
  const { supabase, user } = await getHostAuth();
  const { data, error } = await supabase
    .from('question_banks')
    .select('id, name, bank_questions(count)')
    .eq('host_id', user.id)
    .order('name', { ascending: true });
  if (error || !Array.isArray(data)) throw new Error('Could not load the question bank.');
  return data.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    count: embeddedCount(row.bank_questions),
  }));
}

export async function createQuestionBank(name: string): Promise<QuestionBankSummary> {
  const clean = normalizeCategoryName(name);
  const { supabase, user } = await getHostAuth();
  const { count, error: countError } = await supabase
    .from('question_banks')
    .select('id', { count: 'exact', head: true })
    .eq('host_id', user.id);
  if (countError) throw new Error('Could not add that category.');
  if ((count ?? 0) >= MAX_QUESTION_BANKS) throw new Error('You already have 50 categories.');
  const { data, error } = await supabase
    .from('question_banks')
    .insert({ host_id: user.id, name: clean })
    .select('id, name')
    .single();
  if (error?.code === '23505') throw new Error('You already have that category.');
  if (error || !data) throw new Error('Could not add that category.');
  revalidatePath('/dashboard');
  return { id: String(data.id), name: String(data.name), count: 0 };
}

export async function deleteQuestionBank(bankId: string): Promise<{ id: string }> {
  if (!bankId) throw new Error('Pick a category.');
  const { supabase, user } = await getHostAuth();
  const { data, error } = await supabase
    .from('question_banks')
    .delete()
    .eq('id', bankId)
    .eq('host_id', user.id)
    .select('id');
  if (error || !Array.isArray(data) || data.length === 0) throw new Error('Category not found.');
  revalidatePath('/dashboard');
  return { id: bankId };
}

export async function listBankQuestions(bankId: string): Promise<BankQuestionSummary[]> {
  if (!bankId) return [];
  const { supabase, user } = await getHostAuth();
  const { data: bank, error: bankError } = await supabase
    .from('question_banks')
    .select('id')
    .eq('id', bankId)
    .eq('host_id', user.id)
    .maybeSingle();
  if (bankError || !bank) throw new Error('Category not found.');
  const { data, error } = await supabase
    .from('bank_questions')
    .select('id, prompt')
    .eq('bank_id', bankId)
    .order('created_at', { ascending: true });
  if (error || !Array.isArray(data)) throw new Error('Could not load the question bank.');
  return data.map((row) => ({ id: String(row.id), prompt: String(row.prompt) }));
}

export async function addBankQuestion(
  bankId: string,
  prompt: string,
  answers: unknown
): Promise<BankQuestionSummary> {
  if (!bankId) throw new Error('Pick a category.');
  const question = normalizeBankQuestion(prompt, draftAnswers(answers));
  const { supabase, user } = await getHostAuth();
  const { data: bank, error: bankError } = await supabase
    .from('question_banks')
    .select('id')
    .eq('id', bankId)
    .eq('host_id', user.id)
    .maybeSingle();
  if (bankError || !bank) throw new Error('Category not found.');
  const { count, error: countError } = await supabase
    .from('bank_questions')
    .select('id', { count: 'exact', head: true })
    .eq('bank_id', bankId);
  if (countError) throw new Error('Could not add that question.');
  if ((count ?? 0) >= MAX_BANK_QUESTIONS) throw new Error('This category is full.');
  const { data, error } = await supabase
    .from('bank_questions')
    .insert({ bank_id: bankId, prompt: question.prompt, answers: question.answers })
    .select('id, prompt')
    .single();
  if (error || !data) throw new Error('Could not add that question.');
  revalidatePath('/dashboard');
  return { id: String(data.id), prompt: String(data.prompt) };
}

export async function deleteBankQuestion(questionId: string): Promise<{ id: string }> {
  if (!questionId) throw new Error('Question not found.');
  const { supabase } = await getHostAuth();
  const { data, error } = await supabase.from('bank_questions').delete().eq('id', questionId).select('id');
  if (error || !Array.isArray(data) || data.length === 0) throw new Error('Question not found.');
  revalidatePath('/dashboard');
  return { id: questionId };
}

export async function drawQuizFromBank(
  bankId: string,
  count: number,
  random: () => number = Math.random
): Promise<DrawnQuiz> {
  if (!bankId) throw new Error('Pick a category.');
  const { supabase, user } = await getHostAuth();
  await assertQuizQuota(supabase, user.id);
  const { data: bank, error: bankError } = await supabase
    .from('question_banks')
    .select('id, name')
    .eq('id', bankId)
    .eq('host_id', user.id)
    .maybeSingle();
  if (bankError || !bank) throw new Error('Category not found.');
  const { data: stored, error: storedError } = await supabase
    .from('bank_questions')
    .select('prompt, answers')
    .eq('bank_id', bankId);
  if (storedError || !Array.isArray(stored)) throw new Error('Could not read that category.');
  const picked = pickRandom(stored.map((row) => storedQuestion(row)), count, random);
  const rows = bankToQuestionRows('pending', picked);
  assertPlayableQuestions(rows);

  const { data: quiz, error: quizError } = await supabase
    .from('quizzes')
    .insert({
      host_id: user.id,
      title: String(bank.name),
      description: '',
      theme: DEFAULT_QUIZ_THEME,
    })
    .select('id, title, description, created_at')
    .single();
  if (quizError || !quiz) throw new Error('Could not make that quiz.');

  const { error: insertError } = await supabase
    .from('questions')
    .insert(rows.map((row) => ({ ...row, quiz_id: quiz.id })));
  if (insertError) {
    await supabase.from('quizzes').delete().eq('id', quiz.id);
    throw new Error('Could not make that quiz.');
  }

  revalidatePath('/dashboard');
  return {
    id: String(quiz.id),
    title: String(quiz.title),
    description: typeof quiz.description === 'string' ? quiz.description : '',
    created_at: typeof quiz.created_at === 'string' ? quiz.created_at : new Date().toISOString(),
    questionCount: picked.length,
  };
}
