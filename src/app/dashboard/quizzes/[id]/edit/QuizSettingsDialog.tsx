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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-arena-mist border-arena-line text-arena-ink rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-arena-ink">Quiz Template Settings</DialogTitle>
          <DialogDescription className="text-arena-ink/55 text-xs">
            Title, teams, and shuffle. Live rooms always use the Qlash stage.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-4">
          <div className="space-y-2">
            <Label htmlFor="settingsTitle" className="text-arena-ink/80 text-xs font-semibold">
              QUIZ TITLE
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
              DESCRIPTION
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
            Live host and player screens use the Qlash stage — ink, acid, and signal. Answer tiles keep their slash / ring / bolt / chevron marks.
          </p>

          {/* Settings Toggles */}
          <div className="space-y-3.5 pt-2 border-t border-arena-line">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-arena-ink">Randomize Question Order</span>
                <span className="text-[10px] text-arena-ink/45">Shuffles questions each play session.</span>
              </div>
              <Switch
                checked={randomizeQs}
                onCheckedChange={onRandomizeQsChange}
                className="data-[state=checked]:bg-arena-signal"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-arena-ink">Randomize Answer Order</span>
                <span className="text-[10px] text-arena-ink/45">Shuffles choices for players.</span>
              </div>
              <Switch
                checked={randomizeAs}
                onCheckedChange={onRandomizeAsChange}
                className="data-[state=checked]:bg-arena-signal"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-arena-ink">Team Mode Activation</span>
                <span className="text-[10px] text-arena-ink/45">Players join and score as teams.</span>
              </div>
              <Switch
                checked={teamMode}
                onCheckedChange={onTeamModeChange}
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
            Done Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
