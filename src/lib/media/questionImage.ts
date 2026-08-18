export const QUESTION_MEDIA_BUCKET = 'question-media';
export const MAX_QUESTION_IMAGE_BYTES = 5 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export function extensionForMime(mime: string): string | null {
  return MIME_TO_EXT[mime] ?? null;
}

export function validateQuestionImage(file: { type: string; size: number }): { ok: true } | { ok: false; error: string } {
  if (!extensionForMime(file.type)) {
    return { ok: false, error: 'Images must be JPEG, PNG, GIF, or WebP.' };
  }
  if (file.size > MAX_QUESTION_IMAGE_BYTES) {
    return { ok: false, error: 'Keep images under 5 MB.' };
  }
  if (file.size <= 0) {
    return { ok: false, error: 'That file looks empty.' };
  }
  return { ok: true };
}

export function questionMediaPath(hostId: string, quizId: string, fileId: string, ext: string): string {
  const safe = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanExt = ext.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return `${safe(hostId)}/${safe(quizId)}/${safe(fileId)}.${cleanExt}`;
}

export function uploadErrorMessage(error: { message?: string } | null | undefined): string {
  const message = error?.message || 'Could not upload image.';
  if (/bucket not found/i.test(message)) {
    return 'Image storage is not set up. Run schema-media.sql in the Supabase SQL editor.';
  }
  if (/row-level security|violates policy/i.test(message)) {
    return 'You do not have permission to upload images.';
  }
  return message;
}
