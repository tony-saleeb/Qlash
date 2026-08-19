import { ANSWER_MARKS } from '@/lib/game/marks';
import type { ContentPack } from '@/lib/content/packs';

export function packToQuestionRows(quizId: string, pack: ContentPack) {
  const colors = ANSWER_MARKS.map((mark) => mark.color);
  const shapes = ANSWER_MARKS.map((mark) => mark.id);
  return pack.questions.map((question, index) => ({
    quiz_id: quizId,
    order_index: index,
    type: 'mcq',
    prompt: question.prompt,
    media_url: null,
    media_type: null,
    time_limit_seconds: 20,
    points_base: 1000,
    scoring_type: 'linear',
    answers: question.answers.map((answer, answerIndex) => ({
      id: String(answerIndex + 1),
      text: answer.text,
      is_correct: answer.correct,
      color: colors[answerIndex % colors.length],
      shape: shapes[answerIndex % shapes.length],
    })),
  }));
}
