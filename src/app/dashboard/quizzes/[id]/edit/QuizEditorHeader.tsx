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
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-arena-line bg-white/90 px-6 py-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl border border-arena-line text-arena-ink/60 hover:bg-arena-mist hover:text-arena-ink"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="hidden sm:block">
          <BrandMark size="sm" />
        </div>
        <div className="border-l border-arena-line pl-3">
          <h2 dir="auto" className="line-clamp-1 font-display text-lg font-extrabold leading-tight text-arena-ink">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-arena-ink/45">
            {questionCount} {questionCount === 1 ? 'question' : 'questions'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          onClick={onImport}
          className="hidden rounded-xl border border-arena-line text-xs font-semibold text-arena-ink/70 hover:bg-arena-mist sm:flex"
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" /> Import
        </Button>
        <Button
          variant="ghost"
          onClick={onSettings}
          className="rounded-xl border border-arena-line text-xs font-semibold text-arena-ink/70 hover:bg-arena-mist"
        >
          <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Settings
        </Button>
        <Button
          onClick={onSave}
          disabled={saving}
          className="h-10 rounded-xl bg-arena-court px-5 font-bold text-white hover:bg-arena-court/90"
        >
          <Save className="mr-1.5 h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </header>
  );
}
