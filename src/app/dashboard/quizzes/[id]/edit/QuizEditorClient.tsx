'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { saveQuizData } from '@/app/actions/quizzes';
import { DEFAULT_QUIZ_THEME } from '@/lib/game/theme';
import {
  DEFAULT_ANSWERS,
  createDefaultQuestion,
  parseCsvQuestions,
  type Question,
  type QuizEditorClientProps,
} from './quizEditorModel';
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

  // Quiz Settings State
  const [title, setTitle] = useState(quiz.title);
  const [description, setDescription] = useState(quiz.description || '');
  const [randomizeQs, setRandomizeQs] = useState(quiz.randomize_questions);
  const [randomizeAs, setRandomizeAs] = useState(quiz.randomize_answers);
  const [teamMode, setTeamMode] = useState(quiz.team_mode);
  const [doublePointsRounds, setDoublePointsRounds] = useState<string[]>(
    quiz.double_points_rounds || []
  );

  // Questions State
  const [questions, setQuestions] = useState<Question[]>(
    initialQuestions.length > 0
      ? initialQuestions
      : [createDefaultQuestion('mcq')]
  );
  const [activeIndex, setActiveIndex] = useState(0);

  // UI Dialog States
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [csvText, setCsvText] = useState('');

  const activeQuestion = questions[activeIndex];

  // Update question type
  const handleTypeChange = (type: Question['type']) => {
    const updated = [...questions];
    const original = updated[activeIndex];
    
    // Create new blank default based on type
    const template = createDefaultQuestion(type);
    
    // Merge existing prompt & media settings to avoid losing progress
    template.prompt = original.prompt;
    template.media_url = original.media_url;
    template.media_type = original.media_type;
    template.time_limit_seconds = original.time_limit_seconds;
    template.points_base = original.points_base;

    // For polls, override scoring type to none
    if (type === 'poll') {
      template.scoring_type = 'none';
    } else if (original.type === 'poll') {
      template.scoring_type = 'linear';
    } else {
      template.scoring_type = original.scoring_type;
    }

    updated[activeIndex] = template;
    setQuestions(updated);
  };

  // Add question
  const addQuestion = (type: 'mcq' | 'true_false' | 'multi_select' | 'type_answer' | 'poll') => {
    const newQ = createDefaultQuestion(type);
    setQuestions([...questions, newQ]);
    setActiveIndex(questions.length);
    toast.success('Question added.');
  };

  // Duplicate question
  const duplicateQuestion = (idx: number) => {
    const qToCopy = questions[idx];
    const copy: Question = {
      ...qToCopy,
      id: undefined, // remove ID so it creates a new DB row on save
      answers: qToCopy.answers.map((ans) => ({ ...ans })),
    };
    const updated = [...questions];
    updated.splice(idx + 1, 0, copy);
    setQuestions(updated);
    setActiveIndex(idx + 1);
    toast.success('Question duplicated.');
  };

  // Delete question
  const removeQuestion = (idx: number) => {
    if (questions.length <= 1) {
      toast.error('Your quiz must contain at least one question.');
      return;
    }
    const updated = questions.filter((_, i) => i !== idx);
    setQuestions(updated);
    setActiveIndex(Math.max(0, idx - 1));
    toast.success('Question removed.');
  };

  // Shift question order
  const moveQuestion = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === questions.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const updated = [...questions];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;

    setQuestions(updated);
    setActiveIndex(targetIdx);
  };

  // Edit active question fields
  const updateActiveQ = (fields: Partial<Question>) => {
    const updated = [...questions];
    updated[activeIndex] = { ...updated[activeIndex], ...fields };
    setQuestions(updated);
  };

  // Edit choices within active question
  const updateAnswerOption = (ansIdx: number, text: string) => {
    const updated = [...questions];
    const active = { ...updated[activeIndex] };
    active.answers = active.answers.map((ans, i) =>
      i === ansIdx ? { ...ans, text } : ans
    );
    updated[activeIndex] = active;
    setQuestions(updated);
  };

  // Update correct flags
  const toggleCorrectAnswer = (ansIdx: number) => {
    const updated = [...questions];
    const active = { ...updated[activeIndex] };

    if (active.type === 'mcq' || active.type === 'true_false') {
      // Single correct answer only
      active.answers = active.answers.map((ans, i) => ({
        ...ans,
        is_correct: i === ansIdx,
      }));
    } else if (active.type === 'multi_select') {
      // Multiple correct answers allowed
      active.answers = active.answers.map((ans, i) =>
        i === ansIdx ? { ...ans, is_correct: !ans.is_correct } : ans
      );
    }
    updated[activeIndex] = active;
    setQuestions(updated);
  };

  // Add more MCQ options (up to 6)
  const addAnswerOption = () => {
    if (activeQuestion.answers.length >= 6) {
      toast.error('Maximum of 6 options allowed.');
      return;
    }
    const count = activeQuestion.answers.length;
    const optTemplate = DEFAULT_ANSWERS[count];
    updateActiveQ({
      answers: [...activeQuestion.answers, { ...optTemplate, text: '' }],
    });
  };

  // Remove MCQ option (down to 2 minimum)
  const removeAnswerOption = (idx: number) => {
    if (activeQuestion.answers.length <= 2) {
      toast.error('Minimum of 2 options required.');
      return;
    }
    const updatedAnswers = activeQuestion.answers.filter((_, i) => i !== idx)
      // re-map pre-defined colors & shapes to keep theme consistent
      .map((ans, i) => ({
        ...ans,
        color: DEFAULT_ANSWERS[i].color,
        shape: DEFAULT_ANSWERS[i].shape,
      }));
    updateActiveQ({ answers: updatedAnswers });
  };

  // Double Points Round Toggle
  const isDoublePointsRound = doublePointsRounds.includes(activeIndex.toString());
  const toggleDoublePoints = () => {
    const roundStr = activeIndex.toString();
    if (doublePointsRounds.includes(roundStr)) {
      setDoublePointsRounds(doublePointsRounds.filter((r) => r !== roundStr));
    } else {
      setDoublePointsRounds([...doublePointsRounds, roundStr]);
    }
  };

  // Handle CSV File upload selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      toast.success(`Successfully loaded ${file.name}! Click "Import Questions" below to confirm.`);
    };
    reader.onerror = () => {
      toast.error('Failed to read the selected file.');
    };
    reader.readAsText(file);
  };

  // Client-Side CSV Parsing for imports
  const handleCSVImport = () => {
    if (!csvText.trim()) {
      toast.error('Please paste or upload some CSV data first.');
      return;
    }

    try {
      const importedQs = parseCsvQuestions(csvText);

      if (importedQs.length > 0) {
        setQuestions([...questions, ...importedQs]);
        setImportOpen(false);
        setCsvText('');
        toast.success(`Successfully imported ${importedQs.length} questions!`);
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to parse CSV. Please check formatting guidelines.';
      toast.error(message);
    }
  };

  // Batch Save Trigger
  const handleSaveQuiz = async () => {
    // Basic verification checks
    if (!title.trim()) {
      toast.error('Quiz title cannot be empty.');
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.prompt.trim()) {
        toast.error(`Question ${i + 1} has an empty prompt.`);
        setActiveIndex(i);
        return;
      }
      if (q.type !== 'poll') {
        const correctCount = q.answers.filter((a) => a.is_correct).length;
        if (correctCount === 0) {
          toast.error(`Question ${i + 1} must have at least one correct answer selected.`);
          setActiveIndex(i);
          return;
        }
      }
      if (q.type === 'mcq' || q.type === 'multi_select' || q.type === 'poll') {
        const emptyAns = q.answers.some((a) => !a.text.trim());
        if (emptyAns) {
          toast.error(`Question ${i + 1} has empty answer option fields.`);
          setActiveIndex(i);
          return;
        }
      }
    }

    setSaving(true);
    const loadingToast = toast.loading('Saving quiz data to server...');
    try {
      await saveQuizData(
        quiz.id,
        {
          title: title.trim(),
          description: description.trim(),
          theme: quiz.theme || DEFAULT_QUIZ_THEME,
          randomize_questions: randomizeQs,
          randomize_answers: randomizeAs,
          team_mode: teamMode,
          double_points_rounds: doublePointsRounds,
        },
        questions
      );
      toast.success('All changes saved successfully!', { id: loadingToast });
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save quiz.';
      toast.error(message, { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-arena-ink flex flex-col font-sans">
      <QuizEditorHeader
        title={title}
        questionCount={questions.length}
        saving={saving}
        onBack={() => router.push('/dashboard')}
        onImport={() => setImportOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onSave={handleSaveQuiz}
      />

      {/* Editor Body Grid */}
      <div className="flex-1 grid md:grid-cols-12 overflow-hidden">
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
        onTitleChange={setTitle}
        onDescriptionChange={setDescription}
        onRandomizeQsChange={setRandomizeQs}
        onRandomizeAsChange={setRandomizeAs}
        onTeamModeChange={setTeamMode}
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
