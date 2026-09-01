import { describe, expect, it } from 'vitest';
import { ANSWER_MARKS } from '@/lib/game/marks';
import { createDefaultQuestion, importQuestionsFromText, parseCsvQuestions } from '@/app/dashboard/quizzes/[id]/edit/quizEditorModel';

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

  it('builds type_answer as a single correct placeholder', () => {
    const question = createDefaultQuestion('type_answer');
    expect(question.answers).toHaveLength(1);
    expect(question.answers[0].is_correct).toBe(true);
  });

  it('uses none scoring for polls', () => {
    const question = createDefaultQuestion('poll');
    expect(question.scoring_type).toBe('none');
    expect(question.answers.every((a) => a.is_correct === false)).toBe(true);
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
