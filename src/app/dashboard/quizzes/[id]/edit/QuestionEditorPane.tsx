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

interface QuestionEditorPaneProps {
  activeQuestion: Question;
  isDoublePointsRound: boolean;
  onTypeChange: (type: Question['type']) => void;
  onUpdate: (fields: Partial<Question>) => void;
  onToggleDoublePoints: () => void;
  onUpdateAnswer: (ansIdx: number, text: string) => void;
  onToggleCorrect: (ansIdx: number) => void;
  onAddAnswer: () => void;
  onRemoveAnswer: (idx: number) => void;
}

export default function QuestionEditorPane({
  activeQuestion,
  isDoublePointsRound,
  onTypeChange,
  onUpdate,
  onToggleDoublePoints,
  onUpdateAnswer,
  onToggleCorrect,
  onAddAnswer,
  onRemoveAnswer,
}: QuestionEditorPaneProps) {
  return (
    <main className="md:col-span-9 p-6 overflow-y-auto max-h-[calc(100vh-73px)] space-y-6">
      {/* Question Meta Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-arena-mist/40 p-4 border border-arena-line rounded-2xl items-center">
        {/* Question Type */}
        <div className="space-y-1.5">
          <Label className="text-arena-ink/45 text-[10px] uppercase font-bold tracking-wider">
            Question Type
          </Label>
          <Select value={activeQuestion.type} onValueChange={(val) => { if (val) onTypeChange(val); }}>
            <SelectTrigger className="bg-white border-arena-line h-9 text-xs rounded-xl">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent className="bg-arena-mist border-arena-line text-arena-ink">
              <SelectItem value="mcq">Multiple Choice</SelectItem>
              <SelectItem value="true_false">True / False</SelectItem>
              <SelectItem value="multi_select">Multi-Select</SelectItem>
              <SelectItem value="type_answer">Type Answer</SelectItem>
              <SelectItem value="poll">Poll (Opinion)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Time Limit */}
        <div className="space-y-1.5">
          <Label className="text-arena-ink/45 text-[10px] uppercase font-bold tracking-wider flex items-center justify-between pr-2">
            <span>Time Limit</span>
            <span className="font-mono text-arena-court font-bold">
              {activeQuestion.time_limit_seconds}s
            </span>
          </Label>
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-arena-ink/45 shrink-0" />
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
          <Label className="text-arena-ink/45 text-[10px] uppercase font-bold tracking-wider flex items-center justify-between pr-2">
            <span>Base Points</span>
            <span className="font-mono text-arena-court font-bold">
              {activeQuestion.points_base}
            </span>
          </Label>
          <div className="flex items-center gap-3">
            <Award className="w-4 h-4 text-arena-ink/45 shrink-0" />
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
          <Label className="text-arena-ink/45 text-[10px] uppercase font-bold tracking-wider">
            Scoring Curve
          </Label>
          <Select
            disabled={activeQuestion.type === 'poll'}
            value={activeQuestion.scoring_type}
            onValueChange={(val) => { if (val) onUpdate({ scoring_type: val as Question['scoring_type'] }); }}
          >
            <SelectTrigger className="bg-white border-arena-line h-9 text-xs rounded-xl">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent className="bg-arena-mist border-arena-line text-arena-ink">
              <SelectItem value="linear">Linear Decay (Speed Bonus)</SelectItem>
              <SelectItem value="flat">Flat points (No Speed Bonus)</SelectItem>
              <SelectItem value="none">No points round</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Prompt Entry Box */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-arena-ink/55 text-xs font-semibold">
            Question Prompt
          </Label>
          <div className="flex items-center gap-4 text-xs font-semibold text-arena-court">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch
                checked={isDoublePointsRound}
                onCheckedChange={onToggleDoublePoints}
                className="data-[state=checked]:bg-arena-signal scale-75"
              />
              Double Points Round (2x)
            </label>
          </div>
        </div>
        <Textarea
          placeholder="Type your question prompt here..."
          value={activeQuestion.prompt}
          onChange={(e) => onUpdate({ prompt: e.target.value })}
          className="bg-arena-mist/60 border-arena-line h-24 text-base focus-visible:ring-arena-court rounded-2xl p-4 font-semibold resize-none"
          maxLength={150}
        />
      </div>

      {/* Media attachment input */}
      <div className="space-y-2">
        <Label className="text-arena-ink/55 text-xs font-semibold">
          Media Attachment (Optional Image/GIF/Video URL)
        </Label>
        <div className="flex gap-2">
          <Input
            placeholder="https://example.com/media.jpg"
            value={activeQuestion.media_url || ''}
            onChange={(e) => {
              const url = e.target.value;
              const type = url.match(/\.(mp4|webm|ogg)$/i) ? 'video' : url ? 'image' : null;
              onUpdate({ media_url: url || null, media_type: type });
            }}
            className="bg-arena-mist/60 border-arena-line h-10 focus-visible:ring-arena-court rounded-xl flex-1"
          />
          {activeQuestion.media_url && (
            <Select
              value={activeQuestion.media_type || 'image'}
              onValueChange={(val) => { if (val) onUpdate({ media_type: val as Question['media_type'] }); }}
            >
              <SelectTrigger className="bg-arena-mist border-arena-line w-28 h-10 text-xs rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-arena-mist border-arena-line text-arena-ink">
                <SelectItem value="image">Image / GIF</SelectItem>
                <SelectItem value="video">Short Video</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Answers Design Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-arena-ink/55 text-xs font-semibold">
            Answer Options & Correct Key Configuration
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
              + Add Option
            </Button>
          )}
        </div>

        {activeQuestion.type === 'type_answer' ? (
          // Type the Answer Workspace
          <div className="p-5 bg-arena-mist/40 border border-arena-line rounded-2xl space-y-3">
            <Label htmlFor="correctText" className="text-arena-ink/80 text-xs font-bold">
              Correct Text Options (Fuzzy-matched, case-insensitive)
            </Label>
            <p className="text-arena-ink/45 text-xs leading-normal">
              Type the exact expected word/words. Separate alternative acceptable answers with semicolons (e.g. <code>Washington; George Washington; George</code>).
            </p>
            <Input
              id="correctText"
              placeholder="e.g. Earth; the earth"
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
                    placeholder={`Option ${ansIdx + 1}`}
                    value={ans.text}
                    onChange={(e) => onUpdateAnswer(ansIdx, e.target.value)}
                    className="bg-transparent border-0 focus-visible:ring-0 focus-visible:border-0 h-10 text-sm font-semibold flex-1 px-1"
                    maxLength={60}
                    disabled={activeQuestion.type === 'true_false'}
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
                        title="Mark as Correct answer"
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
                          className="text-arena-ink/45 hover:text-rose-400 transition-colors"
                          title="Remove option"
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
