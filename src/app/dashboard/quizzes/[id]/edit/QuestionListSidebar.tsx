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
    <aside className="md:col-span-3 border-r border-slate-900 bg-slate-950/40 p-4 flex flex-col justify-between overflow-y-auto max-h-[calc(100vh-73px)]">
      <div className="space-y-3">
        <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">
          Questions
        </span>

        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {questions.map((q, idx) => {
            const isSelected = idx === activeIndex;
            const isDouble = doublePointsRounds.includes(idx.toString());

            return (
              <div
                key={idx}
                onClick={() => onSelect(idx)}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3 group relative ${
                  isSelected
                    ? 'bg-violet-600/10 border-violet-500 text-white shadow-lg'
                    : 'bg-slate-900/40 border-slate-900 hover:border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className="flex items-start gap-2.5 w-full">
                  <span className="text-xs font-bold bg-slate-950 border border-slate-800 rounded w-5 h-5 flex items-center justify-center text-slate-400 shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex flex-col min-w-0 w-full gap-0.5">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                      {q.type.replace('_', ' ')} {isDouble && '⭐ 2x'}
                    </span>
                    <p className="text-xs font-medium truncate">
                      {q.prompt || 'Untitled question prompt...'}
                    </p>
                  </div>
                </div>

                {/* Move and delete controls inside thumbnail hover */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0 absolute right-2 top-2 bg-slate-900/90 border border-slate-800 p-0.5 rounded-lg">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(idx, 'up');
                    }}
                    disabled={idx === 0}
                    className="text-slate-500 hover:text-white disabled:opacity-20"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(idx, 'down');
                    }}
                    disabled={idx === questions.length - 1}
                    className="text-slate-500 hover:text-white disabled:opacity-20"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate(idx);
                    }}
                    className="text-slate-500 hover:text-violet-400"
                    title="Duplicate Question"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(idx);
                    }}
                    className="text-slate-500 hover:text-rose-400"
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
      <div className="pt-4 border-t border-slate-900 space-y-2 mt-4 bg-slate-950/80 sticky bottom-0">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
          Add Question
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="outline"
            className="h-8 text-[11px] rounded-lg border-slate-900 hover:bg-slate-900 justify-start px-2.5"
            onClick={() => onAdd('mcq')}
          >
            <Plus className="w-3 h-3 mr-1 text-violet-500" /> MCQ
          </Button>
          <Button
            variant="outline"
            className="h-8 text-[11px] rounded-lg border-slate-900 hover:bg-slate-900 justify-start px-2.5"
            onClick={() => onAdd('true_false')}
          >
            <Plus className="w-3 h-3 mr-1 text-sky-500" /> True/False
          </Button>
          <Button
            variant="outline"
            className="h-8 text-[11px] rounded-lg border-slate-900 hover:bg-slate-900 justify-start px-2.5"
            onClick={() => onAdd('multi_select')}
          >
            <Plus className="w-3 h-3 mr-1 text-emerald-500" /> Multi-select
          </Button>
          <Button
            variant="outline"
            className="h-8 text-[11px] rounded-lg border-slate-900 hover:bg-slate-900 justify-start px-2.5"
            onClick={() => onAdd('type_answer')}
          >
            <Plus className="w-3 h-3 mr-1 text-fuchsia-500" /> Type Answer
          </Button>
        </div>
        <Button
          variant="outline"
          className="w-full h-8 text-[11px] rounded-lg border-slate-900 hover:bg-slate-900 justify-center px-2.5 mt-1"
          onClick={() => onAdd('poll')}
        >
          <Plus className="w-3 h-3 mr-1 text-yellow-500" /> Add Poll Question (No Score)
        </Button>
      </div>
    </aside>
  );
}
