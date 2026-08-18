'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import {
  QUESTION_MEDIA_BUCKET,
  extensionForMime,
  questionMediaPath,
  uploadErrorMessage,
  validateQuestionImage,
} from '@/lib/media/questionImage';
import type { Question } from './quizEditorModel';

interface QuestionMediaFieldProps {
  quizId: string;
  mediaUrl: string | null;
  mediaType: Question['media_type'];
  onChange: (fields: Pick<Question, 'media_url' | 'media_type'>) => void;
}

export default function QuestionMediaField({
  quizId,
  mediaUrl,
  mediaType,
  onChange,
}: QuestionMediaFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const applyUrl = (url: string) => {
    const trimmed = url.trim();
    const type = trimmed.match(/\.(mp4|webm|ogg)$/i) ? 'video' : trimmed ? 'image' : null;
    onChange({ media_url: trimmed || null, media_type: type });
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const check = validateQuestionImage(file);
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    const ext = extensionForMime(file.type);
    if (!ext) return;

    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Sign in to upload images.');
        return;
      }
      const path = questionMediaPath(user.id, quizId, crypto.randomUUID(), ext);
      const { error } = await supabase.storage.from(QUESTION_MEDIA_BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) {
        toast.error(uploadErrorMessage(error));
        return;
      }
      const { data } = supabase.storage.from(QUESTION_MEDIA_BUCKET).getPublicUrl(path);
      onChange({ media_url: data.publicUrl, media_type: 'image' });
      toast.success('Image attached.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not upload image.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-arena-ink/55 text-xs font-semibold">Question image (optional)</Label>
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="ghost"
          className="h-10 rounded-xl border border-arena-line font-semibold"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="mr-1.5 h-4 w-4" />
          )}
          {uploading ? 'Uploading…' : 'Upload image'}
        </Button>
        <Input
          placeholder="or paste an image / video URL"
          value={mediaUrl || ''}
          onChange={(e) => applyUrl(e.target.value)}
          className="bg-arena-mist/60 border-arena-line h-10 focus-visible:ring-arena-court rounded-xl min-w-[12rem] flex-1"
        />
        {mediaUrl && (
          <Select
            value={mediaType || 'image'}
            onValueChange={(val) => {
              if (val) onChange({ media_url: mediaUrl, media_type: val as Question['media_type'] });
            }}
          >
            <SelectTrigger className="bg-arena-mist border-arena-line w-28 h-10 text-xs rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-arena-mist border-arena-line text-arena-ink">
              <SelectItem value="image">Image / GIF</SelectItem>
              <SelectItem value="video">Short Video</SelectItem>
            </SelectContent>
          </Select>
        )}
        {mediaUrl && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl border border-arena-line text-arena-signal"
            onClick={() => onChange({ media_url: null, media_type: null })}
            title="Remove media"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      {mediaUrl && mediaType !== 'video' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl}
          alt="Question media preview"
          className="mt-2 max-h-40 max-w-full rounded-xl border border-arena-line object-contain"
        />
      )}
    </div>
  );
}
