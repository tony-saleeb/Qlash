import { hostOp } from '@/lib/host/hostOp';
import type { LeaderboardPlayer } from '@/lib/game/types';
import type { Locale } from '@/lib/i18n/locale';

export type HostQuiz = {
  id: string;
  title: string;
  description: string;
  created_at: string;
  share_code?: string | null;
  questions?: { count: number }[];
};

export type HostSession = { id: string; pin?: string };

export type HostClock = { success: true; serverStartedAt: string };

export type HostRevealResults = {
  optionCounts: Record<string, number>;
  leaderboard: LeaderboardPlayer[];
  alreadyApplied?: boolean;
};

export const createGameSession = (quizId: string) =>
  hostOp<HostSession>('createGameSession', { quizId });
export const endGameSession = (sessionId: string) => hostOp('endGameSession', { sessionId });
export const kickPlayer = (playerId: string, sessionId: string) =>
  hostOp('kickPlayer', { playerId, sessionId });
export const revealQuestionResults = (sessionId: string, questionId: string) =>
  hostOp<HostRevealResults>('revealQuestionResults', { sessionId, questionId });
export const goToLeaderboard = (sessionId: string) => hostOp('goToLeaderboard', { sessionId });
export const goToNextQuestion = (sessionId: string, nextIndex: number) =>
  hostOp<HostClock>('goToNextQuestion', { sessionId, nextIndex });
export const goToPodium = (sessionId: string) => hostOp('goToPodium', { sessionId });
export const setSessionMultiplier = (sessionId: string, multiplier: 1 | 2) =>
  hostOp('setSessionMultiplier', { sessionId, multiplier });
export const startGameSession = (sessionId: string, questionOrder: string[]) =>
  hostOp<HostClock>('startGameSession', { sessionId, questionOrder });
export const pauseGameSession = (sessionId: string) => hostOp('pauseGameSession', { sessionId });
export const resumeGameSession = (sessionId: string) =>
  hostOp<HostClock>('resumeGameSession', { sessionId });
export const addQuestionTime = (sessionId: string, extraSeconds?: number) =>
  hostOp<HostClock>('addQuestionTime', { sessionId, extraSeconds });
export const setJoinLocked = (sessionId: string, locked: boolean) =>
  hostOp<{ join_locked: boolean }>('setJoinLocked', { sessionId, locked });
export const setLateJoinThroughIndex = (sessionId: string, throughIndex: number) =>
  hostOp<{ late_join_through_index: number }>('setLateJoinThroughIndex', {
    sessionId,
    throughIndex,
  });

export const createQuiz = (title: string, description = '') =>
  hostOp<HostQuiz>('createQuiz', { title, description });
export const deleteQuiz = (quizId: string) => hostOp('deleteQuiz', { quizId });
export const cloneQuiz = (quizId: string) => hostOp<HostQuiz>('cloneQuiz', { quizId });

export type QuestionBankSummary = { id: string; name: string; count: number };
export type BankQuestionSummary = { id: string; prompt: string };
export type DrawnQuiz = HostQuiz & { questionCount: number };

export const listQuestionBanks = () => hostOp<QuestionBankSummary[]>('listQuestionBanks', {});
export const createQuestionBank = (name: string) =>
  hostOp<QuestionBankSummary>('createQuestionBank', { name });
export const deleteQuestionBank = (bankId: string) =>
  hostOp<{ id: string }>('deleteQuestionBank', { bankId });
export const listBankQuestions = (bankId: string) =>
  hostOp<BankQuestionSummary[]>('listBankQuestions', { bankId });
export const addBankQuestion = (
  bankId: string,
  prompt: string,
  answers: { text: string; correct: boolean }[]
) => hostOp<BankQuestionSummary>('addBankQuestion', { bankId, prompt, answers });
export const deleteBankQuestion = (questionId: string) =>
  hostOp<{ id: string }>('deleteBankQuestion', { questionId });
export const drawQuizFromBank = (bankId: string, count: number) =>
  hostOp<DrawnQuiz>('drawQuizFromBank', { bankId, count });
export const enableQuizShare = (quizId: string) =>
  hostOp<{ shareCode: string }>('enableQuizShare', { quizId });
export const rotateQuizShare = (quizId: string) =>
  hostOp<{ shareCode: string }>('rotateQuizShare', { quizId });
export const stopQuizShare = (quizId: string) =>
  hostOp<{ shareCode: null }>('stopQuizShare', { quizId });
export type SavedQuiz = {
  success: true;
  updatedAt: string;
  questionIds: string[];
};

export const saveQuizData = (quizId: string, settings: unknown, questions: unknown) =>
  hostOp<SavedQuiz>('saveQuizData', { quizId, settings, questions });

export const createRecapQuiz = (sessionId: string) =>
  hostOp<HostQuiz>('createRecapQuiz', { sessionId });
export const setHostLocale = (locale: Locale) => hostOp('setHostLocale', { locale });
