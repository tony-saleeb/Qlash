import { describe, expect, it } from 'vitest';
import {
  extensionForMime,
  questionMediaPath,
  uploadErrorMessage,
  validateQuestionImage,
} from '@/lib/media/questionImage';

describe('validateQuestionImage', () => {
  it('accepts a small jpeg', () => {
    expect(validateQuestionImage({ type: 'image/jpeg', size: 120_000 })).toEqual({ ok: true });
  });

  it('rejects non-images and oversized files', () => {
    expect(validateQuestionImage({ type: 'application/pdf', size: 100 })).toMatchObject({ ok: false });
    expect(validateQuestionImage({ type: 'image/png', size: 6 * 1024 * 1024 })).toMatchObject({
      ok: false,
      error: 'Keep images under 5 MB.',
    });
  });
});

describe('questionMediaPath', () => {
  it('nests files under the host and quiz ids', () => {
    expect(questionMediaPath('host-1', 'quiz-2', 'file-3', 'png')).toBe('host-1/quiz-2/file-3.png');
  });

  it('strips path characters', () => {
    expect(questionMediaPath('../h', 'q/../x', 'a.b', 'PNG')).toBe('h/qx/ab.png');
  });
});

describe('extensionForMime / uploadErrorMessage', () => {
  it('maps mime types', () => {
    expect(extensionForMime('image/webp')).toBe('webp');
    expect(extensionForMime('video/mp4')).toBeNull();
  });

  it('explains a missing bucket', () => {
    expect(uploadErrorMessage({ message: 'Bucket not found' })).toMatch(/schema-media\.sql/);
  });
});
