import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('gitignore env rules', () => {
  const text = readFileSync(new URL('../../.gitignore', import.meta.url), 'utf8');

  it('ignores every env file and keeps the example after that rule', () => {
    const ignoreAt = text.search(/^\.env\*$/m);
    const keepAt = text.search(/^!\.env\.local\.example$/m);
    expect(ignoreAt).toBeGreaterThanOrEqual(0);
    expect(keepAt).toBeGreaterThan(ignoreAt);
  });
});
