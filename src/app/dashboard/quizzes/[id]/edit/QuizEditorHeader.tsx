'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft, Upload, Settings2, Save } from 'lucide-react';

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
    <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="border border-slate-800 rounded-xl text-slate-400 hover:text-white"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="font-extrabold text-white text-lg leading-tight line-clamp-1">
            Editing: {title}
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {questionCount} {questionCount === 1 ? 'Question' : 'Questions'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          onClick={onImport}
          className="border border-slate-800 hover:bg-slate-900 rounded-xl flex items-center gap-1.5 text-xs text-slate-300"
        >
          <Upload className="w-3.5 h-3.5" /> Import
        </Button>
        <Button
          variant="ghost"
          onClick={onSettings}
          className="border border-slate-800 hover:bg-slate-900 rounded-xl flex items-center gap-1.5 text-xs text-slate-300"
        >
          <Settings2 className="w-3.5 h-3.5" /> Quiz Settings
        </Button>
        <Button
          onClick={onSave}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-1.5 h-10 px-5"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Quiz'}
        </Button>
      </div>
    </header>
  );
}
