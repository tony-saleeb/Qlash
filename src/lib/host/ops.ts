export const HOST_OPS = [
  'createGameSession',
  'endGameSession',
  'kickPlayer',
  'revealQuestionResults',
  'goToLeaderboard',
  'goToNextQuestion',
  'goToPodium',
  'setSessionMultiplier',
  'startGameSession',
  'pauseGameSession',
  'resumeGameSession',
  'addQuestionTime',
  'setLateJoinThroughIndex',
  'createQuiz',
  'deleteQuiz',
  'cloneQuiz',
  'createPackQuiz',
  'enableQuizShare',
  'saveQuizData',
  'createRecapQuiz',
  'setHostLocale',
] as const;

export type HostOpName = (typeof HOST_OPS)[number];

export function isHostOp(op: string): op is HostOpName {
  return (HOST_OPS as readonly string[]).includes(op);
}
