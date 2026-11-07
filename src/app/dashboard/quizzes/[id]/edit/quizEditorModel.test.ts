import { describe, expect, it } from 'vitest';
import { ANSWER_MARKS } from '@/lib/game/marks';
import {
  clampPointsBase,
  clampTimeLimit,
  createDefaultQuestion,
  hasDuplicateAnswerIds,
  importQuestionsFromText,
  nextAnswerOption,
  parseCsvQuestions,
  allowEditorLeave,
  patchQuestionById,
  questionAfterTypeChange,
  questionsFailedToLoad,
  questionsWithInsert,
  questionsWithoutIndex,
  withSavedQuestionIds,
} from '@/app/dashboard/quizzes/[id]/edit/quizEditorModel';

describe('createDefaultQuestion', () => {
  it('builds a 4-choice MCQ on linear scoring', () => {
    const question = createDefaultQuestion('mcq');
    expect(question.answers).toHaveLength(4);
    expect(question.scoring_type).toBe('linear');
    expect(question.time_limit_seconds).toBe(20);
    expect(question.points_base).toBe(1000);
    expect(question.answers.map((a) => a.shape)).toEqual(ANSWER_MARKS.slice(0, 4).map((m) => m.id));
  });

  it('builds true/false with slash and q-ring marks', () => {
    const question = createDefaultQuestion('true_false');
    expect(question.answers.map((a) => a.text)).toEqual(['True', 'False']);
    expect(question.answers.every((a) => a.is_correct === false)).toBe(true);
  });

  it('defaults true/false labels to صح and خطأ for an Arabic host', () => {
    const question = createDefaultQuestion('true_false', 'ar');
    expect(question.answers.map((answer) => answer.text)).toEqual(['صح', 'خطأ']);
    const switched = questionAfterTypeChange(createDefaultQuestion('mcq'), 'true_false', 'ar');
    expect(switched.answers.map((answer) => answer.text)).toEqual(['صح', 'خطأ']);
  });

  it('builds type_answer as a single correct placeholder', () => {
    const question = createDefaultQuestion('type_answer');
    expect(question.answers).toHaveLength(1);
    expect(question.answers[0].is_correct).toBe(true);
  });

  it('stamps a fresh id so a second save updates the row', () => {
    const first = createDefaultQuestion('mcq');
    const second = createDefaultQuestion('mcq');
    expect(first.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(second.id).not.toBe(first.id);
  });

  it('copies saved ids back onto the editor list in order', () => {
    const local = [createDefaultQuestion('mcq'), createDefaultQuestion('mcq')];
    const saved = withSavedQuestionIds(local, ['db-1', 'db-2']);
    expect(saved.map((question) => question.id)).toEqual(['db-1', 'db-2']);
    expect(saved[0].prompt).toBe(local[0].prompt);
  });

  it('refuses to open the editor when the questions query failed', () => {
    expect(questionsFailedToLoad({ message: 'timeout' }, null)).toBe(true);
    expect(questionsFailedToLoad(null, null)).toBe(true);
    expect(questionsFailedToLoad(null, [])).toBe(false);
  });

  it('uses none scoring for polls', () => {
    const question = createDefaultQuestion('poll');
    expect(question.scoring_type).toBe('none');
    expect(question.answers.every((a) => a.is_correct === false)).toBe(true);
  });
});

describe('nextAnswerOption', () => {
  it('does not reuse an id after an option was removed', () => {
    const question = createDefaultQuestion('mcq');
    const withoutSecond = question.answers.filter((answer) => answer.id !== '2');
    const added = nextAnswerOption(withoutSecond);
    expect(added?.id).toBe('5');
    expect(hasDuplicateAnswerIds([...(added ? [added] : []), ...withoutSecond])).toBe(false);
  });

  it('stops at six options', () => {
    const six = createDefaultQuestion('mcq').answers.concat([
      nextAnswerOption(createDefaultQuestion('mcq').answers)!,
      { id: '6', text: '', is_correct: false, color: '#000', shape: 'bars' },
    ]);
    expect(six).toHaveLength(6);
    expect(nextAnswerOption(six)).toBeNull();
  });
});

describe('imported question limits', () => {
  it('never lets an import produce an ungradeable clock', () => {
    expect(clampTimeLimit(-5)).toBe(20);
    expect(clampTimeLimit(0)).toBe(20);
    expect(clampTimeLimit(NaN)).toBe(20);
    expect(clampTimeLimit(1)).toBe(5);
    expect(clampTimeLimit(15)).toBe(15);
    expect(clampTimeLimit(9000)).toBe(120);
  });

  it('keeps base points inside the editor slider range', () => {
    expect(clampPointsBase(-100)).toBe(1000);
    expect(clampPointsBase(NaN)).toBe(1000);
    expect(clampPointsBase(0)).toBe(0);
    expect(clampPointsBase(800)).toBe(800);
    expect(clampPointsBase(99999)).toBe(2000);
  });

  it('clamps a hostile CSV row instead of killing the round', () => {
    const csv = 'Capital?,mcq,-30,999999,2,Paris,Lyon,Nice,Lille';
    const [question] = parseCsvQuestions(csv);
    expect(question.time_limit_seconds).toBe(20);
    expect(question.points_base).toBe(2000);
  });
});

describe('parseCsvQuestions', () => {
  it('parses MCQ with 1-based correct index', () => {
    const csv = 'Prompt,Type,Time,Points,Correct,A,B,C,D\nCapital?,mcq,15,800,2,Paris,Lyon,Nice,Lille';
    const [question] = parseCsvQuestions(csv);
    expect(question.prompt).toBe('Capital?');
    expect(question.type).toBe('mcq');
    expect(question.time_limit_seconds).toBe(15);
    expect(question.points_base).toBe(800);
    expect(question.answers.map((a) => a.text)).toEqual(['Paris', 'Lyon', 'Nice', 'Lille']);
    expect(question.answers.map((a) => a.is_correct)).toEqual([false, true, false, false]);
  });

  it('parses multi_select with semicolon correct indices', () => {
    const csv = 'Pick two,multi_select,20,1000,1;3,Red,Blue,Green';
    const [question] = parseCsvQuestions(csv);
    expect(question.type).toBe('multi_select');
    expect(question.answers.map((a) => a.is_correct)).toEqual([true, false, true]);
  });

  it('parses true_false from true/1/t', () => {
    const csv = [
      'Is water wet?,true_false,10,500,true',
      'Sky blue?,true_false,10,500,1',
      'Earth flat?,true_false,10,500,false',
    ].join('\n');
    const questions = parseCsvQuestions(csv);
    expect(questions[0].answers[0].is_correct).toBe(true);
    expect(questions[1].answers[0].is_correct).toBe(true);
    expect(questions[2].answers[0].is_correct).toBe(false);
    expect(questions[2].answers[1].is_correct).toBe(true);
  });

  it('parses type_answer grading text and quoted commas', () => {
    const csv = '"What city, in France?",type_answer,20,1000,"Paris; Lyon"';
    const [question] = parseCsvQuestions(csv);
    expect(question.prompt).toBe('What city, in France?');
    expect(question.answers[0]).toMatchObject({ text: 'Paris; Lyon', is_correct: true });
  });

  it('parses poll choices as never-correct', () => {
    const csv = 'Favorite?,poll,20,0,x,A,B,C';
    const [question] = parseCsvQuestions(csv);
    expect(question.scoring_type).toBe('none');
    expect(question.answers.every((a) => !a.is_correct)).toBe(true);
    expect(question.answers.map((a) => a.text)).toEqual(['A', 'B', 'C']);
  });

  it('skips blank lines and throws on short rows', () => {
    expect(parseCsvQuestions('\n\n')).toEqual([]);
    expect(() => parseCsvQuestions('only,three,cells')).toThrow(/enough columns/);
  });

  it('reads a semicolon file, a quoted line break, and صح/خطأ', () => {
    const csv = [
      'Prompt;Type;Time;Points;Correct;A;B',
      'Capital?;mcq;15;800;2;Paris;Lyon',
      '"Line\nbreak?";true_false;10;500;صح',
      'Flat?;true_false;10;500;خطأ',
    ].join('\n');
    const questions = parseCsvQuestions(csv);
    expect(questions[0].answers.map((answer) => answer.text)).toEqual(['Paris', 'Lyon']);
    expect(questions[0].answers[1].is_correct).toBe(true);
    expect(questions[1].prompt).toContain('Line');
    expect(questions[1].prompt).toContain('break?');
    expect(questions[1].answers[0].is_correct).toBe(true);
    expect(questions[2].answers[1].is_correct).toBe(true);
  });

  it('names the row when the type or the answer key is unknown', () => {
    expect(() => parseCsvQuestions('Prompt,Type,Time,Points,Correct\nWhat?,essay,20,1000,1')).toThrow(/Row 2: unknown question type "essay"/);
    expect(() => parseCsvQuestions('What?,true_false,20,1000,maybe')).toThrow(/Row 1: unknown true\/false key "maybe"/);
  });
});

describe('importQuestionsFromText', () => {
  it('keeps the CSV path when the paste looks like the template', () => {
    const [question] = importQuestionsFromText('Prompt,Type,Time,Points,Correct,A,B\nCapital?,mcq,15,800,2,Paris,Lyon');
    expect(question.type).toBe('mcq');
    expect(question.answers.map((answer) => answer.is_correct)).toEqual([false, true]);
  });

  it('maps a starred chat paste onto editor marks', () => {
    const [question] = importQuestionsFromText('1. عاصمة مصر إيه؟\nالقاهرة *\nالإسكندرية\nأسوان');
    expect(question.prompt).toContain('عاصمة مصر');
    expect(question.answers.find((answer) => answer.is_correct)?.text).toBe('القاهرة');
    expect(question.answers[0]?.shape).toBeTruthy();
  });

  it('throws when the paste has no questions', () => {
    expect(() => importQuestionsFromText('hello from the group chat')).toThrow(/No questions found/);
  });
});

describe('editor work that used to disappear', () => {
  it('keeps option text when MCQ becomes multi-select', () => {
    const question = createDefaultQuestion('mcq');
    question.answers = question.answers.map((answer, index) => ({
      ...answer,
      text: ['Cairo', 'Giza', 'Aswan', 'Luxor'][index] ?? '',
      is_correct: index === 0,
    }));
    const next = questionAfterTypeChange(question, 'multi_select');
    expect(next.type).toBe('multi_select');
    expect(next.answers.map((answer) => answer.text)).toEqual(['Cairo', 'Giza', 'Aswan', 'Luxor']);
    expect(next.answers[0].is_correct).toBe(true);
    expect(next.id).toBe(question.id);
  });

  it('writes an upload onto the question that started it', () => {
    const first = createDefaultQuestion('mcq');
    const second = { ...createDefaultQuestion('mcq'), prompt: 'typed while the image uploaded' };
    const next = patchQuestionById([first, second], first.id!, {
      media_url: 'https://cdn.example/q.png',
      media_type: 'image',
    });
    expect(next[0].media_url).toBe('https://cdn.example/q.png');
    expect(next[1].prompt).toBe('typed while the image uploaded');
  });

  it('puts a deleted question back on undo', () => {
    const questions = [createDefaultQuestion('mcq'), createDefaultQuestion('poll')];
    questions[1].prompt = 'Keep me';
    const removed = questions[1];
    const without = questionsWithoutIndex(questions, 1);
    expect(without.map((question) => question.prompt)).toEqual([questions[0].prompt]);
    const restored = questionsWithInsert(without, 1, removed);
    expect(restored[1].prompt).toBe('Keep me');
  });

  it('asks before leaving a dirty editor and leaves a clean one', () => {
    const ask = () => false;
    expect(allowEditorLeave(false, ask)).toBe(true);
    expect(allowEditorLeave(true, ask)).toBe(false);
    expect(allowEditorLeave(true, () => true)).toBe(true);
  });
});
