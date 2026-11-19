import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readRepo(path: string) {
  return readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
}

describe('question answer check grants', () => {
  it('keeps EXECUTE for authenticated in the canonical schema', () => {
    const schema = readRepo('schema.sql');
    const revoke = schema.match(
      /revoke all on function public\.question_answers_valid\(text, jsonb\) from ([^;]+);/
    );
    expect(revoke?.[1]).toBe('public, anon');
    expect(schema).toContain(
      'authenticated must keep EXECUTE because questions_answers_check depends on it'
    );
    expect(schema).toMatch(
      /grant execute on function public\.question_answers_valid\(text, jsonb\)\s+to authenticated, service_role;/
    );
  });

  it('restores the grant P19 removed without exposing the function to anon', () => {
    const grant = readRepo('schema-p28-answers-check-grant.sql');
    expect(grant).toMatch(
      /grant execute on function public\.question_answers_valid\(text, jsonb\)\s+to authenticated, service_role;/
    );
    expect(grant).not.toMatch(/to (public|anon)\b/);
    const applyOrder = readRepo('scripts/ci-apply-schema.sh');
    const p19 = applyOrder.indexOf('schema-p19-question-rules.sql');
    const p28 = applyOrder.indexOf('schema-p28-answers-check-grant.sql');
    expect(p19).toBeGreaterThan(0);
    expect(p28).toBeGreaterThan(p19);
  });

  it('checks live privileges for every public function a public CHECK calls', () => {
    const verify = readRepo('scripts/verify-check-function-grants.sql');
    expect(verify).toContain("has_function_privilege('authenticated', p.oid, 'execute')");
    expect(verify).toContain(
      "has_function_privilege('authenticated', 'public.question_answers_valid(text, jsonb)', 'execute')"
    );
    expect(verify).toContain(
      "has_function_privilege('anon', 'public.question_answers_valid(text, jsonb)', 'execute')"
    );
  });
});
