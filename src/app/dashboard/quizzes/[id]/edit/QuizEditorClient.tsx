'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { saveQuizData } from '@/lib/host/hostApi';
import { DEFAULT_QUIZ_THEME } from '@/lib/game/theme';
import {
  DEFAULT_ANSWERS,
  createDefaultQuestion,
  hasDuplicateAnswerIds,
  allowEditorLeave,
  importQuizText,
  newQuestionId,
  nextAnswerOption,
  patchQuestionById,
  questionAfterTypeChange,
  questionsWithInsert,
  questionsWithoutIndex,
  withSavedQuestionIds,
  type Question,
  type QuizEditorClientProps,
} from './quizEditorModel';
import { doublePointsQuestionIds } from '@/lib/game/doublePoints';
import { questionIssue } from '@/lib/game/questionRules';
import { decodeQuizFileText } from '@/lib/content/decodeQuizFile';
import { useLocale } from '@/lib/i18n/useLocale';
import { fill } from '@/lib/i18n/messages';
import QuizEditorHeader from './QuizEditorHeader';
import QuestionListSidebar from './QuestionListSidebar';
import QuestionEditorPane from './QuestionEditorPane';
import QuizSettingsDialog from './QuizSettingsDialog';
import CsvImportDialog from './CsvImportDialog';

export default function QuizEditorClient({
  quiz,
  initialQuestions,
}: QuizEditorClientProps) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState(quiz.updated_at ?? '');

  const [title, setTitle] = useState(quiz.title);
  const [description, setDescription] = useState(quiz.description || '');
  const [randomizeQs, setRandomizeQs] = useState(quiz.randomize_questions);
  const [randomizeAs, setRandomizeAs] = useState(quiz.randomize_answers);
  const [teamMode, setTeamMode] = useState(quiz.team_mode);
  const [doublePointsRounds, setDoublePointsRounds] = useState<string[]>(() =>
    doublePointsQuestionIds(quiz.double_points_rounds || [], initialQuestions)
  );

  const [questions, setQuestions] = useState<Question[]>(
    initialQuestions.length > 0 ? initialQuestions : [createDefaultQuestion('mcq', locale)]
  );
  const [activeIndex, setActiveIndex] = useState(0);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [csvText, setCsvText] = useState('');

  const activeQuestion = questions[activeIndex];

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const touch = () => setDirty(true);

  const handleTypeChange = (type: Question['type']) => {
    const index = activeIndex;
    const original = questions[index];
    if (!original || original.type === type) return;
    touch();
    setQuestions((current) =>
      current.map((question, item) =>
        item === index ? questionAfterTypeChange(question, type, locale) : question
      )
    );
  };

  const addQuestion = (type: 'mcq' | 'true_false' | 'multi_select' | 'type_answer' | 'poll') => {
    touch();
    const newQ = createDefaultQuestion(type, locale);
    setQuestions([...questions, newQ]);
    setActiveIndex(questions.length);
    toast.success(t('questionAdded'));
  };

  const duplicateQuestion = (idx: number) => {
    const qToCopy = questions[idx];
    touch();
    const copy: Question = {
      ...qToCopy,
      id: newQuestionId(),
      answers: qToCopy.answers.map((ans) => ({ ...ans })),
    };
    const updated = [...questions];
    updated.splice(idx + 1, 0, copy);
    setQuestions(updated);
    setActiveIndex(idx + 1);
    toast.success(t('questionDuplicated'));
  };

  const removeQuestion = (idx: number) => {
    if (questions.length <= 1) {
      toast.error(t('needOneQuestion'));
      return;
    }
    const removed = questions[idx];
    setQuestions(questionsWithoutIndex(questions, idx));
    setActiveIndex(Math.max(0, idx - 1));
    touch();
    toast.success(t('questionRemoved'), {
      action: {
        label: t('undo'),
        onClick: () => {
          setQuestions((current) => questionsWithInsert(current, idx, removed));
          setActiveIndex(idx);
        },
      },
    });
  };

  const moveQuestion = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === questions.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    touch();
    const updated = [...questions];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;

    setQuestions(updated);
    setActiveIndex(targetIdx);
  };

  const updateActiveQ = (fields: Partial<Question>) => {
    const updated = [...questions];
    touch();
    updated[activeIndex] = { ...updated[activeIndex], ...fields };
    setQuestions(updated);
  };

  const updateAnswerOption = (ansIdx: number, text: string) => {
    const updated = [...questions];
    touch();
    const active = { ...updated[activeIndex] };
    active.answers = active.answers.map((ans, i) => (i === ansIdx ? { ...ans, text } : ans));
    updated[activeIndex] = active;
    setQuestions(updated);
  };

  const toggleCorrectAnswer = (ansIdx: number) => {
    const updated = [...questions];
    touch();
    const active = { ...updated[activeIndex] };

    if (active.type === 'mcq' || active.type === 'true_false') {
      active.answers = active.answers.map((ans, i) => ({
        ...ans,
        is_correct: i === ansIdx,
      }));
    } else if (active.type === 'multi_select') {
      active.answers = active.answers.map((ans, i) =>
        i === ansIdx ? { ...ans, is_correct: !ans.is_correct } : ans
      );
    }
    updated[activeIndex] = active;
    setQuestions(updated);
  };

  const addAnswerOption = () => {
    const option = nextAnswerOption(activeQuestion.answers);
    if (!option) {
      toast.error(t('maxOptions'));
      return;
    }
    updateActiveQ({
      answers: [...activeQuestion.answers, option],
    });
  };

  const removeAnswerOption = (idx: number) => {
    if (activeQuestion.answers.length <= 2) {
      toast.error(t('minOptions'));
      return;
    }
    const updatedAnswers = activeQuestion.answers
      .filter((_, i) => i !== idx)
      .map((ans, i) => ({
        ...ans,
        color: DEFAULT_ANSWERS[i].color,
        shape: DEFAULT_ANSWERS[i].shape,
      }));
    updateActiveQ({ answers: updatedAnswers });
  };

  const activeQuestionId = activeQuestion?.id;
  const isDoublePointsRound = Boolean(activeQuestionId && doublePointsRounds.includes(activeQuestionId));
  const toggleDoublePoints = () => {
    if (!activeQuestionId) return;
    touch();
    setDoublePointsRounds((prev) =>
      prev.includes(activeQuestionId)
        ? prev.filter((id) => id !== activeQuestionId)
        : [...prev, activeQuestionId]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    void file
      .arrayBuffer()
      .then((buffer) => {
        setCsvText(decodeQuizFileText(new Uint8Array(buffer)));
        toast.success(fill(t('fileLoaded'), { name: file.name }));
      })
      .catch(() => {
        toast.error(t('failedReadFile'));
      });
  };

  const handleCSVImport = () => {
    if (!csvText.trim()) {
      toast.error(t('pasteFirst'));
      return;
    }

    try {
      const imported = importQuizText(csvText);
      if (imported.questions.length > 0) {
        touch();
        setQuestions([...questions, ...imported.questions]);
        setImportOpen(false);
        setCsvText('');
        toast.success(fill(t('importedQuestions'), { count: imported.questions.length }));
        if (imported.warnings.length > 0) toast.warning(imported.warnings.join('\n'));
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : t('failedParseCsv');
      toast.error(message);
    }
  };

  const handleSaveQuiz = async () => {
    if (!title.trim()) {
      toast.error(t('quizTitleEmpty'));
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.prompt.trim()) {
        toast.error(fill(t('emptyPrompt'), { n: i + 1 }));
        setActiveIndex(i);
        return;
      }
      const issue = questionIssue(q, i);
      if (issue) {
        toast.error(issue);
        setActiveIndex(i);
        return;
      }
      if (
        (q.type === 'mcq' || q.type === 'multi_select' || q.type === 'poll') &&
        hasDuplicateAnswerIds(q.answers)
      ) {
        toast.error(fill(t('duplicateAnswerIds'), { n: i + 1 }));
        setActiveIndex(i);
        return;
      }
    }

    setSaving(true);
    const loadingToast = toast.loading(t('savingQuiz'));
    try {
      const saved = await saveQuizData(
        quiz.id,
        {
          title: title.trim(),
          description: description.trim(),
          theme: quiz.theme || DEFAULT_QUIZ_THEME,
          randomize_questions: randomizeQs,
          randomize_answers: randomizeAs,
          team_mode: teamMode,
          double_points_rounds: doublePointsQuestionIds(doublePointsRounds, questions),
          expected_updated_at: savedAt || undefined,
        },
        questions
      );
      setQuestions((current) => withSavedQuestionIds(current, saved.questionIds));
      setSavedAt(saved.updatedAt);
      setDirty(false);
      toast.success(t('quizSaved'), { id: loadingToast });
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('failedSaveQuiz');
      toast.error(message, { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-white font-sans text-arena-ink">
      <QuizEditorHeader
        title={title}
        questionCount={questions.length}
        saving={saving}
        onBack={() => {
          if (!allowEditorLeave(dirty, () => window.confirm(t('unsavedLeave')))) return;
          router.push('/dashboard');
        }}
        onImport={() => setImportOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onSave={handleSaveQuiz}
      />

      <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-12 md:overflow-hidden">
        <QuestionListSidebar
          questions={questions}
          activeIndex={activeIndex}
          doublePointsRounds={doublePointsRounds}
          onSelect={setActiveIndex}
          onMove={moveQuestion}
          onDuplicate={duplicateQuestion}
          onRemove={removeQuestion}
          onAdd={addQuestion}
        />

        <QuestionEditorPane
          quizId={quiz.id}
          activeQuestion={activeQuestion}
          isDoublePointsRound={isDoublePointsRound}
          onTypeChange={handleTypeChange}
          onUpdate={updateActiveQ}
          onToggleDoublePoints={toggleDoublePoints}
          onMedia={(questionId, fields) => {
            touch();
            setQuestions((current) => patchQuestionById(current, questionId, fields));
          }}
          onUpdateAnswer={updateAnswerOption}
          onToggleCorrect={toggleCorrectAnswer}
          onAddAnswer={addAnswerOption}
          onRemoveAnswer={removeAnswerOption}
        />
      </div>

      <QuizSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title={title}
        description={description}
        randomizeQs={randomizeQs}
        randomizeAs={randomizeAs}
        teamMode={teamMode}
        onTitleChange={(value) => {
          touch();
          setTitle(value);
        }}
        onDescriptionChange={(value) => {
          touch();
          setDescription(value);
        }}
        onRandomizeQsChange={(value) => {
          touch();
          setRandomizeQs(value);
        }}
        onRandomizeAsChange={(value) => {
          touch();
          setRandomizeAs(value);
        }}
        onTeamModeChange={(value) => {
          touch();
          setTeamMode(value);
        }}
      />

      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        csvText={csvText}
        onCsvTextChange={setCsvText}
        onFileChange={handleFileChange}
        onImport={handleCSVImport}
        onCancel={() => {
          setImportOpen(false);
          setCsvText('');
        }}
      />
    </div>
  );
}
