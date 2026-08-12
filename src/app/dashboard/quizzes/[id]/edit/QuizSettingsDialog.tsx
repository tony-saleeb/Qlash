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
  theme: Record<string, unknown>;
  randomizeQs: boolean;
  randomizeAs: boolean;
  teamMode: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onThemeChange: (theme: Record<string, unknown>) => void;
  onRandomizeQsChange: (value: boolean) => void;
  onRandomizeAsChange: (value: boolean) => void;
  onTeamModeChange: (value: boolean) => void;
}

export default function QuizSettingsDialog({
  open,
  onOpenChange,
  title,
  description,
  theme,
  randomizeQs,
  randomizeAs,
  teamMode,
  onTitleChange,
  onDescriptionChange,
  onThemeChange,
  onRandomizeQsChange,
  onRandomizeAsChange,
  onTeamModeChange,
}: QuizSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">Quiz Template Settings</DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Configure parameters that control layout pacing and theme visuals.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-4">
          <div className="space-y-2">
            <Label htmlFor="settingsTitle" className="text-slate-300 text-xs font-semibold">
              QUIZ TITLE
            </Label>
            <Input
              id="settingsTitle"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="bg-slate-950 border-slate-800 h-10 focus-visible:ring-violet-500 rounded-xl"
              maxLength={50}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settingsDesc" className="text-slate-300 text-xs font-semibold">
              DESCRIPTION
            </Label>
            <Textarea
              id="settingsDesc"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className="bg-slate-950 border-slate-800 h-20 focus-visible:ring-violet-500 rounded-xl resize-none"
              maxLength={150}
            />
          </div>

          {/* Custom Theme Color Settings */}
          {(() => {
            const themeBg = (theme.bgColor as string) || '#0f172a';
            const themeAccent = (theme.accentColor as string) || '#ec4899';
            return (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                    Bg Color
                  </Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={themeBg}
                      onChange={(e) => onThemeChange({ ...theme, bgColor: e.target.value })}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 outline-none"
                    />
                    <span className="font-mono text-xs text-slate-400">{themeBg}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                    Accent Color
                  </Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={themeAccent}
                      onChange={(e) => onThemeChange({ ...theme, accentColor: e.target.value })}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 outline-none"
                    />
                    <span className="font-mono text-xs text-slate-400">{themeAccent}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Settings Toggles */}
          <div className="space-y-3.5 pt-2 border-t border-slate-850">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-slate-200">Randomize Question Order</span>
                <span className="text-[10px] text-slate-500">Shuffles questions each play session.</span>
              </div>
              <Switch
                checked={randomizeQs}
                onCheckedChange={onRandomizeQsChange}
                className="data-[state=checked]:bg-violet-600"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-slate-200">Randomize Answer Order</span>
                <span className="text-[10px] text-slate-500">Shuffles choices for players.</span>
              </div>
              <Switch
                checked={randomizeAs}
                onCheckedChange={onRandomizeAsChange}
                className="data-[state=checked]:bg-violet-600"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-slate-200">Team Mode Activation</span>
                <span className="text-[10px] text-slate-500">Players join and score as teams.</span>
              </div>
              <Switch
                checked={teamMode}
                onCheckedChange={onTeamModeChange}
                className="data-[state=checked]:bg-violet-600"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl w-full h-10"
          >
            Done Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
