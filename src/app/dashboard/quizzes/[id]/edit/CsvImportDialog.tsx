'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileSpreadsheet, Upload, Plus } from 'lucide-react';
import { useLocale } from '@/lib/i18n/useLocale';

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  csvText: string;
  onCsvTextChange: (value: string) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImport: () => void;
  onCancel: () => void;
}

export default function CsvImportDialog({
  open,
  onOpenChange,
  csvText,
  onCsvTextChange,
  onFileChange,
  onImport,
  onCancel,
}: CsvImportDialogProps) {
  const { t } = useLocale();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-arena-mist border-arena-line text-arena-ink rounded-2xl max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-arena-ink flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-500" /> {t('pasteChatOrCsv')}
          </DialogTitle>
          <DialogDescription className="text-arena-ink/55 text-xs">
            {t('pasteChatHint')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-2">
          <div className="p-3 bg-white/60 border border-arena-line rounded-xl space-y-1 text-arena-ink/55 text-[11px] leading-relaxed">
            <span className="font-bold text-arena-ink/80 block mb-1">{t('chatPaste')}</span>
            <code className="block whitespace-pre-wrap text-[11px]">{`1. عاصمة مصر إيه؟
القاهرة *
الإسكندرية
أسوان`}</code>
            <span className="font-bold text-arena-ink/80 mt-2 block">{t('csvStillWorks')}</span>
            <code>Prompt, Type, TimeLimit, Points, CorrectKey, Choice1, Choice2, Choice3, Choice4</code>
            <ul className="list-disc list-inside space-y-0.5 mt-1 text-arena-ink/60">
              <li><b>Type:</b> <code>mcq</code> | <code>true_false</code> | <code>multi_select</code> | <code>type_answer</code> | <code>poll</code></li>
              <li>{t('csvCorrectHelp')}</li>
              <li>{t('csvChoicesHelp')}</li>
            </ul>
          </div>

          <div className="space-y-1.5">
            <Label className="text-arena-ink/55 text-xs font-semibold flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" /> {t('uploadCsv')}
            </Label>
            <Input
              type="file"
              accept=".csv"
              onChange={onFileChange}
              className="bg-white border-arena-line h-10 focus-visible:ring-arena-court rounded-xl text-xs cursor-pointer text-arena-ink/55 file:me-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-arena-mist file:text-slate-350 hover:file:bg-slate-800"
            />
          </div>

          <div className="text-center text-slate-700 text-[10px] font-bold uppercase my-1">
            {t('orDivider')}
          </div>

          <div className="space-y-1.5">
            <Label className="text-arena-ink/55 text-xs font-semibold">{t('pasteFromChat')}</Label>
            <Textarea
              placeholder={`1. Who was born in Bethlehem?\nNazareth\nBethlehem *\nJerusalem`}
              value={csvText}
              onChange={(e) => onCsvTextChange(e.target.value)}
              className="bg-white border-arena-line h-44 focus-visible:ring-arena-court rounded-xl font-mono text-xs resize-none"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={onCancel}
            className="border border-arena-line hover:bg-white text-arena-ink/55 rounded-xl"
          >
            {t('cancel')}
          </Button>
          <Button
            onClick={onImport}
            className="bg-emerald-600 hover:bg-emerald-500 text-arena-ink font-semibold rounded-xl flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> {t('importQuestions')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
