export interface TeachableAnswer {
  id: string;
  text: string;
  is_correct?: boolean;
}

export interface TeachableReveal {
  kind: 'poll' | 'scored' | 'empty';
  totalVotes: number;
  correctLabels: string[];
  mostPicked: { id: string; text: string; votes: number; percent: number } | null;
  tied: boolean;
  mostPickedIsCorrect: boolean;
  headline: string;
  subline: string | null;
}

function labelOf(answer: TeachableAnswer): string {
  const text = (answer.text || '').trim();
  return text || 'that option';
}

export function buildTeachableReveal(
  answers: readonly TeachableAnswer[],
  optionCounts: Record<string, number> | null | undefined,
  questionType?: string
): TeachableReveal {
  const counts = optionCounts || {};
  const totalVotes = Object.values(counts).reduce((sum, n) => sum + (Number(n) || 0), 0);
  const isPoll = questionType === 'poll';
  const correct = answers.filter((ans) => Boolean(ans.is_correct));
  const correctLabels = correct.map(labelOf);
  const correctIds = new Set(correct.map((ans) => ans.id));

  if (totalVotes <= 0) {
    return {
      kind: isPoll ? 'poll' : 'empty',
      totalVotes: 0,
      correctLabels,
      mostPicked: null,
      tied: false,
      mostPickedIsCorrect: false,
      headline: 'No answers this round.',
      subline: !isPoll && correctLabels.length ? `Correct: ${correctLabels.join(' · ')}` : null,
    };
  }

  let topVotes = 0;
  for (const ans of answers) {
    const votes = Number(counts[ans.id]) || 0;
    if (votes > topVotes) topVotes = votes;
  }

  const leaders = answers.filter((ans) => (Number(counts[ans.id]) || 0) === topVotes && topVotes > 0);
  const tied = leaders.length > 1;
  const winner = leaders[0] || null;
  const mostPicked = winner
    ? {
        id: winner.id,
        text: labelOf(winner),
        votes: topVotes,
        percent: Math.round((topVotes / totalVotes) * 100),
      }
    : null;
  const mostPickedIsCorrect = Boolean(winner && correctIds.has(winner.id));

  if (isPoll) {
    return {
      kind: 'poll',
      totalVotes,
      correctLabels: [],
      mostPicked,
      tied,
      mostPickedIsCorrect: false,
      headline: tied
        ? 'The room split.'
        : `The room picked ${mostPicked?.text || 'that option'}.`,
      subline: mostPicked ? `${mostPicked.percent}% of answers` : null,
    };
  }

  if (tied) {
    return {
      kind: 'scored',
      totalVotes,
      correctLabels,
      mostPicked,
      tied: true,
      mostPickedIsCorrect,
      headline: 'The room split.',
      subline: correctLabels.length ? `Correct: ${correctLabels.join(' · ')}` : null,
    };
  }

  if (mostPickedIsCorrect) {
    return {
      kind: 'scored',
      totalVotes,
      correctLabels,
      mostPicked,
      tied: false,
      mostPickedIsCorrect: true,
      headline: 'The room got this.',
      subline: correctLabels.length ? correctLabels.join(' · ') : null,
    };
  }

  return {
    kind: 'scored',
    totalVotes,
    correctLabels,
    mostPicked,
    tied: false,
    mostPickedIsCorrect: false,
    headline: `Most of you picked ${mostPicked?.text || 'the wrong option'}.`,
    subline: correctLabels.length ? `Correct: ${correctLabels.join(' · ')}` : null,
  };
}
