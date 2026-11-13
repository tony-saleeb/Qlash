'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle, Clock, Award, Trash2 } from 'lucide-react';
import { AnswerSwatch } from '@/components/brand/AnswerMark';
import type { Question } from './quizEditorModel';
import QuestionMediaField from './QuestionMediaField';
import { useLocale } from '@/lib/i18n/useLocale';
import { fill } from '@/lib/i18n/messages';

interface QuestionEditorPaneProps {
  quizId: string;
  activeQuestion: Question;
  isDoublePointsRound: boolean;
  onTypeChange: (type: Question['type']) => void;
  onUpdate: (fields: Partial<Question>) => void;
  onMedia: (questionId: string, fields: Pick<Question, 'media_url' | 'media_type'>) => void;
  onToggleDoublePoints: () => void;
  onUpdateAnswer: (ansIdx: number, text: string) => void;
  onToggleCorrect: (ansIdx: number) => void;
  onAddAnswer: () => void;
  onRemoveAnswer: (idx: number) => void;
}

export default function QuestionEditorPane({
  quizId,
  activeQuestion,
  isDoublePointsRound,
  onTypeChange,
  onUpdate,
  onMedia,
  onToggleDoublePoints,
  onUpdateAnswer,
  onToggleCorrect,
  onAddAnswer,
  onRemoveAnswer,
}: QuestionEditorPaneProps) {
  const { t } = useLocale();
  return (
    <main className="space-y-6 p-4 md:col-span-9 md:max-h-[calc(100dvh-4.5rem)] md:overflow-y-auto md:p-6">
      {/* Question Meta Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-arena-mist/40 p-4 border border-arena-line rounded-2xl items-center">
        {/* Question Type */}
        <div className="space-y-1.5">
          <Label className="text-arena-ink/60 text-[10px] uppercase font-bold tracking-wider">
            {t('questionType')}
          </Label>
          <Select value={activeQuestion.type} onValueChange={(val) => { if (val) onTypeChange(val); }}>
            <SelectTrigger className="bg-white border-arena-line h-9 text-xs rounded-xl">
              <SelectValue placeholder={t('selectType')} />
            </SelectTrigger>
            <SelectContent className="bg-arena-mist border-arena-line text-arena-ink">
              <SelectItem value="mcq">{t('multipleChoice')}</SelectItem>
              <SelectItem value="true_false">{t('trueFalse')}</SelectItem>
              <SelectItem value="multi_select">{t('multiSelect')}</SelectItem>
              <SelectItem value="type_answer">{t('typeAnswerLabel')}</SelectItem>
              <SelectItem value="poll">{t('pollOpinion')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Time Limit */}
        <div className="space-y-1.5">
          <Label className="text-arena-ink/60 text-[10px] uppercase font-bold tracking-wider flex items-center justify-between pe-2">
            <span>{t('timeLimit')}</span>
            <span className="font-mono text-arena-court font-bold">
              {activeQuestion.time_limit_seconds}s
            </span>
          </Label>
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-arena-ink/60 shrink-0" />
            <Slider
              min={5}
              max={120}
              step={5}
              value={[activeQuestion.time_limit_seconds]}
              onValueChange={(vals) => {
                const val = Array.isArray(vals) ? vals[0] : (typeof vals === 'number' ? vals : (vals as number[])[0]);
                onUpdate({ time_limit_seconds: val });
              }}
              className="w-full cursor-pointer py-1"
            />
          </div>
        </div>

        {/* Points Value */}
        <div className="space-y-1.5">
          <Label className="text-arena-ink/60 text-[10px] uppercase font-bold tracking-wider flex items-center justify-between pe-2">
            <span>{t('basePoints')}</span>
            <span className="font-mono text-arena-court font-bold">
              {activeQuestion.points_base}
            </span>
          </Label>
          <div className="flex items-center gap-3">
            <Award className="w-4 h-4 text-arena-ink/60 shrink-0" />
            <Slider
              min={0}
              max={2000}
              step={100}
              disabled={activeQuestion.type === 'poll'}
              value={[activeQuestion.points_base]}
              onValueChange={(vals) => {
                const val = Array.isArray(vals) ? vals[0] : (typeof vals === 'number' ? vals : (vals as number[])[0]);
                onUpdate({ points_base: val });
              }}
              className="w-full cursor-pointer py-1"
            />
          </div>
        </div>

        {/* Scoring Decay Type */}
        <div className="space-y-1.5">
          <Label className="text-arena-ink/60 text-[10px] uppercase font-bold tracking-wider">
            {t('scoringCurve')}
          </Label>
          <Select
            disabled={activeQuestion.type === 'poll'}
            value={activeQuestion.scoring_type}
            onValueChange={(val) => { if (val) onUpdate({ scoring_type: val as Question['scoring_type'] }); }}
          >
            <SelectTrigger className="bg-white border-arena-line h-9 text-xs rounded-xl">
              <SelectValue placeholder={t('selectType')} />
            </SelectTrigger>
            <SelectContent className="bg-arena-mist border-arena-line text-arena-ink">
              <SelectItem value="linear">{t('linearDecay')}</SelectItem>
              <SelectItem value="flat">{t('flatPoints')}</SelectItem>
              <SelectItem value="none">{t('noPointsRound')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Prompt Entry Box */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-arena-ink/55 text-xs font-semibold">
            {t('questionPrompt')}
          </Label>
          <div className="flex items-center gap-4 text-xs font-semibold text-arena-court">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch
                checked={isDoublePointsRound}
                onCheckedChange={onToggleDoublePoints}
                className="scale-75"
              />
              {t('doublePointsRound')}
            </label>
          </div>
        </div>
        <Textarea
          placeholder={t('promptPlaceholder')}
          value={activeQuestion.prompt}
          onChange={(e) => onUpdate({ prompt: e.target.value })}
          className="bg-arena-mist/60 border-arena-line h-24 text-base focus-visible:ring-arena-court rounded-2xl p-4 font-semibold resize-none"
          maxLength={150}
        />
      </div>

      <QuestionMediaField
        quizId={quizId}
        questionId={activeQuestion.id ?? ''}
        mediaUrl={activeQuestion.media_url}
        mediaType={activeQuestion.media_type}
        onChange={onMedia}
      />

      {/* Answers Design Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-arena-ink/55 text-xs font-semibold">
            {t('answerOptions')}
          </Label>
          {(activeQuestion.type === 'mcq' ||
            activeQuestion.type === 'multi_select' ||
            activeQuestion.type === 'poll') && (
            <Button
              variant="ghost"
              onClick={onAddAnswer}
              disabled={activeQuestion.answers.length >= 6}
              className="text-xs hover:bg-arena-mist text-arena-court hover:text-arena-court font-bold border border-arena-line rounded-xl h-8 px-3"
            >
              + {t('addOption')}
            </Button>
          )}
        </div>

        {activeQuestion.type === 'type_answer' ? (
          // Type the Answer Workspace
          <div className="p-5 bg-arena-mist/40 border border-arena-line rounded-2xl space-y-3">
            <Label htmlFor="correctText" className="text-arena-ink/80 text-xs font-bold">
              {t('acceptedAnswers')}
            </Label>
            <p className="text-arena-ink/60 text-xs leading-normal">
              {t('acceptedAnswersHint')}
            </p>
            <Input
              id="correctText"
              placeholder={t('acceptedAnswersPlaceholder')}
              value={activeQuestion.answers[0]?.text || ''}
              onChange={(e) => onUpdateAnswer(0, e.target.value)}
              className="bg-white border-arena-line h-12 text-lg font-bold focus-visible:ring-arena-court rounded-xl"
            />
          </div>
        ) : (
          // Multiple Choice, Multi-select, True/False Grid
          <div className="grid sm:grid-cols-2 gap-4">
            {activeQuestion.answers.map((ans, ansIdx) => {
              return (
                <div
                  key={ans.id}
                  className="relative flex items-center gap-3 bg-arena-mist/30 border border-arena-line p-3.5 rounded-2xl hover:border-arena-line transition-colors"
                >
                  {/* Shape visual box matching color */}
                  <AnswerSwatch
                    shape={ans.shape}
                    color={ans.color}
                    className="h-10 w-10 shrink-0"
                    markClassName="h-5 w-5"
                  />

                  {/* Text Input */}
                  <Input
                    placeholder={fill(t('optionPlaceholder'), { n: ansIdx + 1 })}
                    value={ans.text}
                    onChange={(e) => onUpdateAnswer(ansIdx, e.target.value)}
                    className="bg-transparent border-0 focus-visible:ring-0 focus-visible:border-0 h-10 text-sm font-semibold flex-1 px-1"
                    maxLength={60}
                    dir="auto"
                  />

                  {/* Right Actions: Correct checkbox / Delete option */}
                  <div className="flex items-center gap-3 shrink-0">
                    {activeQuestion.type !== 'poll' && (
                      <button
                        type="button"
                        onClick={() => onToggleCorrect(ansIdx)}
                        className={`w-7 h-7 rounded-xl border flex items-center justify-center transition-all ${
                          ans.is_correct
                            ? 'bg-emerald-500 border-emerald-400 text-arena-ink shadow-md shadow-emerald-500/20'
                            : 'border-arena-line hover:border-arena-ink/25 bg-white text-transparent'
                        }`}
                        title={t('markCorrect')}
                        aria-label={t('markCorrect')}
                        aria-pressed={ans.is_correct}
                      >
                        <CheckCircle className="w-4 h-4 fill-current" />
                      </button>
                    )}

                    {(activeQuestion.type === 'mcq' ||
                      activeQuestion.type === 'multi_select' ||
                      activeQuestion.type === 'poll') &&
                      activeQuestion.answers.length > 2 && (
                        <button
                          type="button"
                          onClick={() => onRemoveAnswer(ansIdx)}
                          className="text-arena-ink/60 hover:text-rose-400 transition-colors"
                          title={t('removeOption')}
                          aria-label={t('removeOption')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
