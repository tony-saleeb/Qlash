/** A free host stops at five quizzes. Probes reuse one instead of inserting. */
function pickProbeQuiz(quizzes) {
  const rows = Array.isArray(quizzes) ? quizzes : [];
  if (rows.length < 5) return { id: null, created: true };
  const active = rows.find((quiz) => quiz && !quiz.deleted_at);
  const quiz = active ?? rows[0];
  if (!quiz?.id) return { id: null, created: true };
  return { id: quiz.id, created: false };
}

module.exports = { pickProbeQuiz };
