import { NextResponse } from 'next/server';
import {
  addQuestionTime,
  createGameSession,
  endGameSession,
  goToLeaderboard,
  goToNextQuestion,
  goToPodium,
  kickPlayer,
  pauseGameSession,
  revealQuestionResults,
  resumeGameSession,
  setLateJoinThroughIndex,
  setSessionMultiplier,
  startGameSession,
} from '@/app/actions/game';
import {
  cloneQuiz,
  createPackQuiz,
  createQuiz,
  deleteQuiz,
  enableQuizShare,
  saveQuizData,
} from '@/app/actions/quizzes';
import { createRecapQuiz } from '@/app/actions/reports';
import { setHostLocale } from '@/app/actions/host';

export const dynamic = 'force-dynamic';

type Args = Record<string, unknown>;

async function runHostOp(op: string, args: Args) {
  switch (op) {
    case 'createGameSession':
      return createGameSession(String(args.quizId));
    case 'endGameSession':
      return endGameSession(String(args.sessionId));
    case 'kickPlayer':
      return kickPlayer(String(args.playerId), String(args.sessionId));
    case 'revealQuestionResults':
      return revealQuestionResults(String(args.sessionId), String(args.questionId));
    case 'goToLeaderboard':
      return goToLeaderboard(String(args.sessionId));
    case 'goToNextQuestion':
      return goToNextQuestion(String(args.sessionId), Number(args.nextIndex));
    case 'goToPodium':
      return goToPodium(String(args.sessionId));
    case 'setSessionMultiplier':
      return setSessionMultiplier(String(args.sessionId), args.multiplier === 2 ? 2 : 1);
    case 'startGameSession':
      return startGameSession(String(args.sessionId), args.questionOrder as string[]);
    case 'pauseGameSession':
      return pauseGameSession(String(args.sessionId));
    case 'resumeGameSession':
      return resumeGameSession(String(args.sessionId));
    case 'addQuestionTime':
      return addQuestionTime(String(args.sessionId), Number(args.extraSeconds ?? 10));
    case 'setLateJoinThroughIndex':
      return setLateJoinThroughIndex(String(args.sessionId), Number(args.throughIndex));
    case 'createQuiz':
      return createQuiz(String(args.title ?? ''), String(args.description ?? ''));
    case 'deleteQuiz':
      return deleteQuiz(String(args.quizId));
    case 'cloneQuiz':
      return cloneQuiz(String(args.quizId));
    case 'createPackQuiz':
      return createPackQuiz(String(args.packId));
    case 'enableQuizShare':
      return enableQuizShare(String(args.quizId));
    case 'saveQuizData':
      return saveQuizData(String(args.quizId), args.settings as never, args.questions as never);
    case 'createRecapQuiz':
      return createRecapQuiz(String(args.sessionId));
    case 'setHostLocale':
      return setHostLocale(args.locale === 'ar' ? 'ar' : 'en');
    default:
      throw new Error('Unknown host operation.');
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { op?: string; args?: Args };
    if (!body.op || typeof body.op !== 'string') {
      return NextResponse.json({ error: 'Missing operation.' }, { status: 400 });
    }
    const data = await runHostOp(body.op, body.args ?? {});
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed.';
    const status = /unauthorized/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
