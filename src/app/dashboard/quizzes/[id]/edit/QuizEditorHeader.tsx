'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft, Upload, Settings2, Save } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';

interface QuizEditorHeaderProps {
  title: string;
  questionCount: number;
  saving: boolean;
  onBack: () => void;
  onImport: () => void;
  onSettings: () => void;
  onSave: () => void;
}

export default function QuizEditorHeader({
  title,
  questionCount,
  saving,
  onBack,
  onImport,
  onSettings,
  onSave,
}: QuizEditorHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-arena-line bg-white/90 px-3 py-3 backdrop-blur-md sm:px-6 sm:py-4">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-xl border border-arena-line text-arena-ink/60 hover:bg-arena-mist hover:text-arena-ink"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="hidden sm:block">
          <BrandMark size="sm" />
        </div>
        <div className="min-w-0 border-l border-arena-line pl-3">
          <h2 dir="auto" className="line-clamp-1 font-display text-base font-extrabold leading-tight text-arena-ink sm:text-lg">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-arena-ink/45">
            {questionCount} {questionCount === 1 ? 'question' : 'questions'}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Button
          variant="ghost"
          onClick={onImport}
          className="hidden rounded-xl border border-arena-line text-xs font-semibold text-arena-ink/70 hover:bg-arena-mist sm:flex"
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" /> Import
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onImport}
          className="rounded-xl border border-arena-line text-arena-ink/70 hover:bg-arena-mist sm:hidden"
          title="Import"
          aria-label="Import"
        >
          <Upload className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          onClick={onSettings}
          className="rounded-xl border border-arena-line text-xs font-semibold text-arena-ink/70 hover:bg-arena-mist"
        >
          <Settings2 className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Settings</span>
        </Button>
        <Button
          onClick={onSave}
          disabled={saving}
          className="h-10 rounded-xl bg-arena-court px-3 font-bold text-white hover:bg-arena-court/90 sm:px-5"
        >
          <Save className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">{saving ? 'Saving…' : 'Save'}</span>
        </Button>
      </div>
    </header>
  );
}
