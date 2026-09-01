'use client';

import { Button } from '@/components/ui/button';
import { Plus, Trash2, Copy, ArrowUp, ArrowDown } from 'lucide-react';
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
  return (
    <aside className="flex flex-col border-b border-arena-line bg-white/40 md:col-span-3 md:max-h-[calc(100dvh-4.5rem)] md:justify-between md:overflow-y-auto md:border-b-0 md:border-r">
      <div className="space-y-3 p-3 md:p-4">
        <span className="text-xs font-bold uppercase tracking-widest text-arena-ink/45">
          Questions
        </span>

        <div className="flex gap-2 overflow-x-auto pb-1 md:max-h-[60vh] md:flex-col md:space-y-2.5 md:overflow-x-visible md:overflow-y-auto md:pr-1">
          {questions.map((q, idx) => {
            const isSelected = idx === activeIndex;
            const isDouble = doublePointsRounds.includes(idx.toString());

            return (
              <div
                key={idx}
                onClick={() => onSelect(idx)}
                className={`relative flex min-w-[11.5rem] shrink-0 cursor-pointer items-start justify-between gap-3 rounded-xl border p-3 transition-all group md:min-w-0 md:w-full ${
                  isSelected
                    ? 'border-arena-signal bg-arena-signal/10 text-arena-ink shadow-lg'
                    : 'border-arena-line bg-arena-mist/40 text-arena-ink/55 hover:border-arena-ink/20 hover:text-arena-ink'
                }`}
              >
                <div className="flex items-start gap-2.5 w-full">
                  <span className="text-xs font-bold bg-white border border-arena-line rounded w-5 h-5 flex items-center justify-center text-arena-ink/55 shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex flex-col min-w-0 w-full gap-0.5">
                    <span className="text-xs text-arena-ink/45 font-semibold uppercase tracking-wider">
                      {q.type.replace('_', ' ')} {isDouble && '⭐ 2x'}
                    </span>
                    <p dir="auto" className="text-xs font-medium truncate">
                      {q.prompt || 'Untitled question prompt...'}
                    </p>
                  </div>
                </div>

                {/* Move and delete controls inside thumbnail hover */}
                <div className="absolute right-2 top-2 flex items-center gap-1 rounded-lg border border-arena-line bg-arena-mist/90 p-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(idx, 'up');
                    }}
                    disabled={idx === 0}
                    className="text-arena-ink/45 hover:text-arena-ink disabled:opacity-20"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(idx, 'down');
                    }}
                    disabled={idx === questions.length - 1}
                    className="text-arena-ink/45 hover:text-arena-ink disabled:opacity-20"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate(idx);
                    }}
                    className="text-arena-ink/45 hover:text-arena-court"
                    title="Duplicate Question"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(idx);
                    }}
                    className="text-arena-ink/45 hover:text-rose-400"
                    title="Delete Question"
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
        <span className="text-[10px] text-arena-ink/45 font-bold uppercase tracking-wider block">
          Add Question
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="outline"
            className="h-8 text-[11px] rounded-lg border-arena-line hover:bg-arena-mist justify-start px-2.5"
            onClick={() => onAdd('mcq')}
          >
            <Plus className="w-3 h-3 mr-1 text-arena-court" /> MCQ
          </Button>
          <Button
            variant="outline"
            className="h-8 text-[11px] rounded-lg border-arena-line hover:bg-arena-mist justify-start px-2.5"
            onClick={() => onAdd('true_false')}
          >
            <Plus className="w-3 h-3 mr-1 text-sky-500" /> True/False
          </Button>
          <Button
            variant="outline"
            className="h-8 text-[11px] rounded-lg border-arena-line hover:bg-arena-mist justify-start px-2.5"
            onClick={() => onAdd('multi_select')}
          >
            <Plus className="w-3 h-3 mr-1 text-emerald-500" /> Multi-select
          </Button>
          <Button
            variant="outline"
            className="h-8 text-[11px] rounded-lg border-arena-line hover:bg-arena-mist justify-start px-2.5"
            onClick={() => onAdd('type_answer')}
          >
            <Plus className="w-3 h-3 mr-1 text-fuchsia-500" /> Type Answer
          </Button>
        </div>
        <Button
          variant="outline"
          className="w-full h-8 text-[11px] rounded-lg border-arena-line hover:bg-arena-mist justify-center px-2.5 mt-1"
          onClick={() => onAdd('poll')}
        >
          <Plus className="w-3 h-3 mr-1 text-yellow-500" /> Add Poll Question (No Score)
        </Button>
      </div>
    </aside>
  );
}
