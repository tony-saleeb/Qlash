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
  setJoinLocked,
  setLateJoinThroughIndex,
  setSessionMultiplier,
  startGameSession,
} from '@/app/actions/game';
import {
  cloneQuiz,
  createQuiz,
  deleteQuiz,
  enableQuizShare,
  rotateQuizShare,
  stopQuizShare,
  saveQuizData,
} from '@/app/actions/quizzes';
import {
  addBankQuestion,
  createQuestionBank,
  deleteBankQuestion,
  deleteQuestionBank,
  drawQuizFromBank,
  listBankQuestions,
  listQuestionBanks,
} from '@/app/actions/questionBank';
import { createRecapQuiz } from '@/app/actions/reports';
import { setHostLocale } from '@/app/actions/host';
import { tooManyRequests } from '@/lib/api/playerLimit';
import { RATE_LIMITS } from '@/lib/game/constants';
import { hostOpClientError, hostOpRequestAllowed } from '@/lib/host/hostOpGuard';
import { isHostOp, type HostOpName } from '@/lib/host/ops';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { readHostAuth } from '@/lib/supabase/hostAuth';

export const dynamic = 'force-dynamic';

type Args = Record<string, unknown>;

async function runHostOp(op: HostOpName, args: Args) {
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
    case 'startGameSession': {
      const questionOrder = Array.isArray(args.questionOrder)
        ? args.questionOrder.filter((id): id is string => typeof id === 'string')
        : [];
      return startGameSession(String(args.sessionId), questionOrder);
    }
    case 'pauseGameSession':
      return pauseGameSession(String(args.sessionId));
    case 'resumeGameSession':
      return resumeGameSession(String(args.sessionId));
    case 'addQuestionTime':
      return addQuestionTime(String(args.sessionId), Number(args.extraSeconds ?? 10));
    case 'setLateJoinThroughIndex':
      return setLateJoinThroughIndex(String(args.sessionId), Number(args.throughIndex));
    case 'setJoinLocked':
      return setJoinLocked(String(args.sessionId), args.locked === true);
    case 'createQuiz':
      return createQuiz(String(args.title ?? ''), String(args.description ?? ''));
    case 'deleteQuiz':
      return deleteQuiz(String(args.quizId));
    case 'cloneQuiz':
      return cloneQuiz(String(args.quizId));
    case 'listQuestionBanks':
      return listQuestionBanks();
    case 'createQuestionBank':
      return createQuestionBank(String(args.name ?? ''));
    case 'deleteQuestionBank':
      return deleteQuestionBank(String(args.bankId ?? ''));
    case 'listBankQuestions':
      return listBankQuestions(String(args.bankId ?? ''));
    case 'addBankQuestion':
      return addBankQuestion(String(args.bankId ?? ''), String(args.prompt ?? ''), args.answers);
    case 'deleteBankQuestion':
      return deleteBankQuestion(String(args.questionId ?? ''));
    case 'drawQuizFromBank':
      return drawQuizFromBank(String(args.bankId ?? ''), Number(args.count));
    case 'enableQuizShare':
      return enableQuizShare(String(args.quizId));
    case 'rotateQuizShare':
      return rotateQuizShare(String(args.quizId));
    case 'stopQuizShare':
      return stopQuizShare(String(args.quizId));
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
  if (!hostOpRequestAllowed(request)) {
    return NextResponse.json({ error: 'This request was refused.' }, { status: 403 });
  }

  const ipLimited = await rateLimit({
    key: `host-op:ip:${clientIpFromRequest(request)}`,
    limit: RATE_LIMITS.hostOpPerIp.limit,
    windowMs: RATE_LIMITS.hostOpPerIp.windowMs,
  });
  if (!ipLimited.ok) return tooManyRequests(ipLimited.retryAfterSec);

  let body: { op?: string; args?: Args };
  try {
    body = (await request.json()) as { op?: string; args?: Args };
  } catch {
    return NextResponse.json({ error: 'The request body must be JSON.' }, { status: 400 });
  }
  if (!body?.op || typeof body.op !== 'string' || !isHostOp(body.op)) {
    return NextResponse.json({ error: 'Missing operation.' }, { status: 400 });
  }

  try {
    const { user } = await readHostAuth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }
    const hostLimited = await rateLimit({
      key: `host-op:${user.id}`,
      limit: RATE_LIMITS.hostOpPerHost.limit,
      windowMs: RATE_LIMITS.hostOpPerHost.windowMs,
    });
    if (!hostLimited.ok) return tooManyRequests(hostLimited.retryAfterSec);

    const data = await runHostOp(body.op, body.args ?? {});
    return NextResponse.json({ data });
  } catch (err) {
    console.error('host op failed', err);
    const mapped = hostOpClientError(err);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
