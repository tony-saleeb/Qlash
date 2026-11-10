'use client';

import { Button } from '@/components/ui/button';
import { Plus, Trash2, Copy, ArrowUp, ArrowDown } from 'lucide-react';
import { useLocale } from '@/lib/i18n/useLocale';
import { fill } from '@/lib/i18n/messages';
import type { Question } from './quizEditorModel';

interface QuestionListSidebarProps {
  questions: Question[];
  activeIndex: number;
  doublePointsRounds: string[];
  onSelect: (idx: number) => void;
  onMove: (idx: number, direction: 'up' | 'down') => void;
  onDuplicate: (idx: number) => void;
  onRemove: (idx: number) => void;
  onAdd: (type: 'mcq' | 'true_false' | 'multi_select' | 'type_answer' | 'poll') => void;
}

export default function QuestionListSidebar({
  questions,
  activeIndex,
  doublePointsRounds,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
  onAdd,
}: QuestionListSidebarProps) {
  const { t } = useLocale();
  return (
    <aside className="flex flex-col border-b border-arena-line bg-white/40 md:col-span-3 md:max-h-[calc(100dvh-4.5rem)] md:justify-between md:overflow-y-auto md:border-b-0 md:border-e">
      <div className="space-y-3 p-3 md:p-4">
        <span className="text-xs font-bold uppercase tracking-widest text-arena-ink/60">
          {t('questionsHeading')}
        </span>

        <div className="flex gap-2 overflow-x-auto pb-1 md:max-h-[60vh] md:flex-col md:space-y-2.5 md:overflow-x-visible md:overflow-y-auto md:pe-1">
          {questions.map((q, idx) => {
            const isSelected = idx === activeIndex;
            const isDouble = Boolean(q.id && doublePointsRounds.includes(q.id));

            return (
              <div
                key={idx}
                className={`group relative min-w-[11.5rem] shrink-0 rounded-xl border transition-all md:min-w-0 md:w-full ${
                  isSelected
                    ? 'border-arena-signal bg-arena-signal/10 text-arena-ink shadow-lg'
                    : 'border-arena-line bg-arena-mist/40 text-arena-ink/55 hover:border-arena-ink/20 hover:text-arena-ink'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(idx)}
                  aria-current={isSelected ? 'true' : undefined}
                  className="flex w-full cursor-pointer items-start gap-2.5 p-3 text-start"
                >
                  <span className="text-xs font-bold bg-white border border-arena-line rounded w-5 h-5 flex items-center justify-center text-arena-ink/55 shrink-0">
                    {idx + 1}
                  </span>
                  <span className="flex min-w-0 w-full flex-col gap-0.5">
                    <span className="text-xs text-arena-ink/60 font-semibold uppercase tracking-wider">
                      {q.type.replace('_', ' ')} {isDouble && '⭐ 2x'}
                    </span>
                    <span dir="auto" className="truncate text-xs font-medium">
                      {q.prompt || t('untitledPrompt')}
                    </span>
                  </span>
                </button>

                <div className="absolute end-2 top-2 z-10 flex items-center gap-1 rounded-lg border border-arena-line bg-arena-mist/90 p-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
                  <button
                    type="button"
                    aria-label={fill(t('moveQuestionUp'), { n: idx + 1 })}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(idx, 'up');
                    }}
                    disabled={idx === 0}
                    className="text-arena-ink/60 hover:text-arena-ink disabled:opacity-20"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    aria-label={fill(t('moveQuestionDown'), { n: idx + 1 })}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(idx, 'down');
                    }}
                    disabled={idx === questions.length - 1}
                    className="text-arena-ink/60 hover:text-arena-ink disabled:opacity-20"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate(idx);
                    }}
                    type="button"
                    className="text-arena-ink/60 hover:text-arena-court"
                    title={t('duplicateQuestion')}
                    aria-label={t('duplicateQuestion')}
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(idx);
                    }}
                    type="button"
                    className="text-arena-ink/60 hover:text-rose-400"
                    title={t('deleteQuestion')}
                    aria-label={t('deleteQuestion')}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Add Question Panel */}
      <div className="sticky bottom-0 mt-0 space-y-2 border-t border-arena-line bg-white/80 p-3 pt-3 md:mt-4 md:bg-white/80">
        <span className="text-[10px] text-arena-ink/60 font-bold uppercase tracking-wider block">
          {t('addQuestion')}
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="outline"
            className="h-8 text-[11px] rounded-lg border-arena-line hover:bg-arena-mist justify-start px-2.5"
            onClick={() => onAdd('mcq')}
          >
            <Plus className="me-1 h-3 w-3 text-arena-court" /> {t('typeMcq')}
          </Button>
          <Button
            variant="outline"
            className="h-8 text-[11px] rounded-lg border-arena-line hover:bg-arena-mist justify-start px-2.5"
            onClick={() => onAdd('true_false')}
          >
            <Plus className="me-1 h-3 w-3 text-sky-500" /> {t('typeTrueFalse')}
          </Button>
          <Button
            variant="outline"
            className="h-8 text-[11px] rounded-lg border-arena-line hover:bg-arena-mist justify-start px-2.5"
            onClick={() => onAdd('multi_select')}
          >
            <Plus className="me-1 h-3 w-3 text-emerald-500" /> {t('typeMulti')}
          </Button>
          <Button
            variant="outline"
            className="h-8 text-[11px] rounded-lg border-arena-line hover:bg-arena-mist justify-start px-2.5"
            onClick={() => onAdd('type_answer')}
          >
            <Plus className="me-1 h-3 w-3 text-fuchsia-500" /> {t('typeAnswerLabel')}
          </Button>
        </div>
        <Button
          variant="outline"
          className="w-full h-8 text-[11px] rounded-lg border-arena-line hover:bg-arena-mist justify-center px-2.5 mt-1"
          onClick={() => onAdd('poll')}
        >
          <Plus className="me-1 h-3 w-3 text-yellow-500" /> {t('addPoll')}
        </Button>
      </div>
    </aside>
  );
}
