import { describe, expect, it } from 'vitest';
import { doublePointsQuestionIds, remapDoublePointsRounds } from '@/lib/game/doublePoints';

const questions = [
  { id: 'q-a', order_index: 0 },
  { id: 'q-b', order_index: 1 },
  { id: 'q-c', order_index: 2 },
];

describe('doublePointsQuestionIds', () => {
  it('keeps a stored question id on that question after the list is reordered', () => {
    const shuffled = [questions[2], questions[0], questions[1]];
    expect(doublePointsQuestionIds(['q-b'], shuffled)).toEqual(['q-b']);
  });

  it('reads an old editor position as the library question, not the play slot', () => {
    expect(doublePointsQuestionIds(['1'], questions)).toEqual(['q-b']);
    expect(doublePointsQuestionIds(['1'], [questions[2], questions[0], questions[1]])).toEqual(['q-b']);
  });

  it('drops a position that no longer has a question', () => {
    expect(doublePointsQuestionIds(['9', 'q-a'], questions)).toEqual(['q-a']);
    expect(doublePointsQuestionIds('nope', questions)).toEqual([]);
  });
});

describe('remapDoublePointsRounds', () => {
  it('points a clone at the new question ids', () => {
    const next = new Map([
      ['q-a', 'copy-a'],
      ['q-b', 'copy-b'],
      ['q-c', 'copy-c'],
    ]);
    expect(remapDoublePointsRounds(['1', 'q-c'], questions, next)).toEqual(['copy-b', 'copy-c']);
  });
});
