'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLocale } from '@/lib/i18n/useLocale';

interface QuizSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  randomizeQs: boolean;
  randomizeAs: boolean;
  teamMode: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onRandomizeQsChange: (value: boolean) => void;
  onRandomizeAsChange: (value: boolean) => void;
  onTeamModeChange: (value: boolean) => void;
}

export default function QuizSettingsDialog({
  open,
  onOpenChange,
  title,
  description,
  randomizeQs,
  randomizeAs,
  teamMode,
  onTitleChange,
  onDescriptionChange,
  onRandomizeQsChange,
  onRandomizeAsChange,
  onTeamModeChange,
}: QuizSettingsDialogProps) {
  const { t } = useLocale();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-arena-mist border-arena-line text-arena-ink rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-arena-ink">{t('quizSettingsTitle')}</DialogTitle>
          <DialogDescription className="text-arena-ink/55 text-xs">
            {t('quizSettingsHint')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-4">
          <div className="space-y-2">
            <Label htmlFor="settingsTitle" className="text-arena-ink/80 text-xs font-semibold">
              {t('titleLabel')}
            </Label>
            <Input
              id="settingsTitle"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="bg-white border-arena-line h-10 focus-visible:ring-arena-court rounded-xl"
              maxLength={50}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settingsDesc" className="text-arena-ink/80 text-xs font-semibold">
              {t('descriptionLabel')}
            </Label>
            <Textarea
              id="settingsDesc"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className="bg-white border-arena-line h-20 focus-visible:ring-arena-court rounded-xl resize-none"
              maxLength={150}
            />
          </div>

          <p className="border-2 border-arena-ink/10 bg-white px-3 py-2.5 text-[11px] leading-relaxed text-arena-ink/60">
            {t('stageNote')}
          </p>

          {/* Settings Toggles */}
          <div className="space-y-3.5 pt-2 border-t border-arena-line">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span id="randomize-questions-label" className="text-xs font-semibold text-arena-ink">{t('randomizeQuestions')}</span>
                <span className="text-[10px] text-arena-ink/60">{t('randomizeQuestionsHint')}</span>
              </div>
              <Switch
                checked={randomizeQs}
                onCheckedChange={onRandomizeQsChange}
                aria-labelledby="randomize-questions-label"
                className="data-[state=checked]:bg-arena-signal"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span id="randomize-answers-label" className="text-xs font-semibold text-arena-ink">{t('randomizeAnswers')}</span>
                <span className="text-[10px] text-arena-ink/60">{t('randomizeAnswersHint')}</span>
              </div>
              <Switch
                checked={randomizeAs}
                onCheckedChange={onRandomizeAsChange}
                aria-labelledby="randomize-answers-label"
                className="data-[state=checked]:bg-arena-signal"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span id="team-mode-label" className="text-xs font-semibold text-arena-ink">{t('teamModeLabel')}</span>
                <span className="text-[10px] text-arena-ink/60">{t('teamModeHint')}</span>
              </div>
              <Switch
                checked={teamMode}
                onCheckedChange={onTeamModeChange}
                aria-labelledby="team-mode-label"
                className="data-[state=checked]:bg-arena-signal"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-arena-signal hover:bg-arena-signal/90 text-white font-semibold rounded-xl w-full h-10"
          >
            {t('doneSettings')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
