import { hostOp } from '@/lib/host/hostOp';
import type { Locale } from '@/lib/i18n/locale';

export const createGameSession = (quizId: string) => hostOp('createGameSession', { quizId });
export const endGameSession = (sessionId: string) => hostOp('endGameSession', { sessionId });
export const kickPlayer = (playerId: string, sessionId: string) =>
  hostOp('kickPlayer', { playerId, sessionId });
export const revealQuestionResults = (sessionId: string, questionId: string) =>
  hostOp('revealQuestionResults', { sessionId, questionId });
export const goToLeaderboard = (sessionId: string) => hostOp('goToLeaderboard', { sessionId });
export const goToNextQuestion = (sessionId: string, nextIndex: number) =>
  hostOp('goToNextQuestion', { sessionId, nextIndex });
export const goToPodium = (sessionId: string) => hostOp('goToPodium', { sessionId });
export const setSessionMultiplier = (sessionId: string, multiplier: 1 | 2) =>
  hostOp('setSessionMultiplier', { sessionId, multiplier });
export const startGameSession = (sessionId: string, questionOrder: string[]) =>
  hostOp('startGameSession', { sessionId, questionOrder });
export const pauseGameSession = (sessionId: string) => hostOp('pauseGameSession', { sessionId });
export const resumeGameSession = (sessionId: string) => hostOp('resumeGameSession', { sessionId });
export const addQuestionTime = (sessionId: string, extraSeconds?: number) =>
  hostOp('addQuestionTime', { sessionId, extraSeconds });
export const setLateJoinThroughIndex = (sessionId: string, throughIndex: number) =>
  hostOp('setLateJoinThroughIndex', { sessionId, throughIndex });

export const createQuiz = (title: string, description = '') =>
  hostOp('createQuiz', { title, description });
export const deleteQuiz = (quizId: string) => hostOp('deleteQuiz', { quizId });
export const cloneQuiz = (quizId: string) => hostOp('cloneQuiz', { quizId });
export const createPackQuiz = (packId: string) => hostOp('createPackQuiz', { packId });
export const enableQuizShare = (quizId: string) => hostOp('enableQuizShare', { quizId });
export const saveQuizData = (quizId: string, settings: unknown, questions: unknown) =>
  hostOp('saveQuizData', { quizId, settings, questions });

export const createRecapQuiz = (sessionId: string) => hostOp('createRecapQuiz', { sessionId });
export const setHostLocale = (locale: Locale) => hostOp('setHostLocale', { locale });
