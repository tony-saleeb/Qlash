'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  addBankQuestion,
  createQuestionBank,
  deleteBankQuestion,
  deleteQuestionBank,
  drawQuizFromBank,
  listBankQuestions,
  listQuestionBanks,
  type BankQuestionSummary,
  type DrawnQuiz,
  type QuestionBankSummary,
} from '@/lib/host/hostApi';
import { fill } from '@/lib/i18n/messages';
import { useLocale } from '@/lib/i18n/useLocale';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const ANSWER_SLOTS = 4;

export function QuestionBankDialog({
  open,
  onOpenChange,
  atQuizCap,
  onQuizCap,
  onQuizCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  atQuizCap: boolean;
  onQuizCap: () => void;
  onQuizCreated: (quiz: DrawnQuiz) => void;
}) {
  const { t } = useLocale();
  const [banks, setBanks] = useState<QuestionBankSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<BankQuestionSummary[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [answers, setAnswers] = useState<string[]>(() => Array.from({ length: ANSWER_SLOTS }, () => ''));
  const [correctIndex, setCorrectIndex] = useState(0);
  const [drawCount, setDrawCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const banksRef = useRef(banks);
  const questionLoad = useRef(0);
  banksRef.current = banks;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    listQuestionBanks()
      .then((rows) => {
        if (cancelled) return;
        setBanks(rows);
        setSelectedId((current) =>
          current && rows.some((row) => row.id === current) ? current : (rows[0]?.id ?? null)
        );
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : t('failedBank'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, t]);

  useEffect(() => {
    if (!open || !selectedId) {
      setQuestions([]);
      return;
    }
    const generation = ++questionLoad.current;
    let active = true;
    listBankQuestions(selectedId)
      .then((rows) => {
        if (active && questionLoad.current === generation) setQuestions(rows);
      })
      .catch((err: unknown) => {
        if (active && questionLoad.current === generation) {
          toast.error(err instanceof Error ? err.message : t('failedBank'));
        }
      });
    return () => {
      active = false;
    };
  }, [open, selectedId, t]);

  useEffect(() => {
    const bank = banksRef.current.find((row) => row.id === selectedId);
    const max = Math.min(bank?.count ?? 0, 100);
    setDrawCount(max === 0 ? 1 : Math.min(10, max));
  }, [selectedId]);

  const selected = banks.find((bank) => bank.id === selectedId) ?? null;
  const maxDraw = Math.min(selected?.count ?? 0, 100);

  const run = async (work: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      await work();
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  const handleAddCategory = () =>
    run(async () => {
      try {
        const bank = await createQuestionBank(categoryName);
        setBanks((current) => [...current, bank].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedId(bank.id);
        setCategoryName('');
        setQuestions([]);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : t('failedBank'));
      }
    });

  const handleDeleteCategory = () => {
    if (!selected) return;
    if (!window.confirm(t('deleteCategoryConfirm'))) return;
    const bankId = selected.id;
    void run(async () => {
      try {
        await deleteQuestionBank(bankId);
        const next = banks.filter((bank) => bank.id !== bankId);
        setBanks(next);
        setSelectedId(next[0]?.id ?? null);
        setQuestions([]);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : t('failedBank'));
      }
    });
  };

  const handleAddQuestion = () => {
    if (!selected) return;
    const bankId = selected.id;
    void run(async () => {
      try {
        const saved = await addBankQuestion(
          bankId,
          prompt,
          answers.map((text, index) => ({ text, correct: index === correctIndex }))
        );
        questionLoad.current += 1;
        setQuestions((current) => [...current, saved]);
        setBanks((current) =>
          current.map((bank) => (bank.id === bankId ? { ...bank, count: bank.count + 1 } : bank))
        );
        setPrompt('');
        setAnswers(Array.from({ length: ANSWER_SLOTS }, () => ''));
        setCorrectIndex(0);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : t('failedBank'));
      }
    });
  };

  const handleRemoveQuestion = (questionId: string) => {
    if (!selected) return;
    const bankId = selected.id;
    void run(async () => {
      try {
        await deleteBankQuestion(questionId);
        questionLoad.current += 1;
        setQuestions((current) => current.filter((question) => question.id !== questionId));
        setBanks((current) =>
          current.map((bank) =>
            bank.id === bankId ? { ...bank, count: Math.max(0, bank.count - 1) } : bank
          )
        );
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : t('failedBank'));
      }
    });
  };

  const handleDraw = () => {
    if (!selected) return;
    if (atQuizCap) {
      onQuizCap();
      return;
    }
    const bankId = selected.id;
    const count = Math.min(maxDraw, Math.max(1, Math.floor(drawCount)));
    void run(async () => {
      const loadingToast = toast.loading(t('makingQuiz'));
      try {
        const quiz = await drawQuizFromBank(bankId, count);
        toast.success(t('quizFromBank'), { id: loadingToast });
        onQuizCreated(quiz);
        onOpenChange(false);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : t('failedBank'), { id: loadingToast });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,44rem)] max-w-xl overflow-y-auto rounded-none border-2 border-arena-ink bg-white text-arena-ink">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">{t('questionBank')}</DialogTitle>
          <DialogDescription className="text-arena-ink/55">{t('questionBankHint')}</DialogDescription>
        </DialogHeader>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void handleAddCategory();
          }}
        >
          <div className="min-w-0 flex-1">
            <Label htmlFor="bank-category" className="sr-only">
              {t('categoryName')}
            </Label>
            <Input
              id="bank-category"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder={t('categoryPlaceholder')}
              maxLength={40}
              className="h-10 rounded-none border-2 border-arena-ink/20"
            />
          </div>
          <Button
            type="submit"
            disabled={pending || categoryName.trim().length === 0}
            className="h-10 rounded-none border-2 border-arena-ink bg-transparent font-bold text-arena-ink hover:bg-arena-ink hover:text-white"
          >
            {t('addCategory')}
          </Button>
        </form>

        {loading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-arena-ink/55">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('creating')}
          </p>
        ) : banks.length === 0 ? (
          <p className="mt-4 text-sm text-arena-ink/55">{t('noCategories')}</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {banks.map((bank) => (
                <button
                  key={bank.id}
                  type="button"
                  onClick={() => setSelectedId(bank.id)}
                  className={`border-2 px-3 py-1.5 text-start text-sm font-bold ${
                    bank.id === selectedId
                      ? 'border-arena-ink bg-arena-ink text-white'
                      : 'border-arena-ink/20 bg-white text-arena-ink'
                  }`}
                >
                  <span dir="auto">{bank.name}</span>
                  <span className="ms-2 font-medium opacity-70">{bank.count}</span>
                </button>
              ))}
            </div>

            {selected ? (
              <>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <Label htmlFor="bank-draw-count" className="text-xs font-bold uppercase tracking-wider">
                      {t('howManyQuestions')}
                    </Label>
                    <Input
                      id="bank-draw-count"
                      type="number"
                      min={1}
                      max={Math.max(1, maxDraw)}
                      value={drawCount}
                      disabled={maxDraw < 1}
                      onChange={(event) => setDrawCount(Number(event.target.value))}
                      className="mt-1 h-10 w-24 rounded-none border-2 border-arena-ink/20"
                    />
                  </div>
                  <Button
                    type="button"
                    disabled={pending || maxDraw < 1}
                    onClick={handleDraw}
                    className="h-10 rounded-none bg-arena-signal font-display font-extrabold text-white hover:bg-arena-signal/90"
                  >
                    {t('makeQuiz')}
                  </Button>
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={handleDeleteCategory}
                    variant="outline"
                    className="h-10 rounded-none border-2 border-arena-ink/20 font-bold"
                  >
                    {t('deleteCategory')}
                  </Button>
                </div>
                {atQuizCap ? <p className="text-sm text-arena-ink/55">{t('deleteOneToAdd')}</p> : null}

                {questions.length === 0 ? (
                  <p className="text-sm text-arena-ink/55">{t('bankEmpty')}</p>
                ) : (
                  <ul className="max-h-40 space-y-1 overflow-y-auto">
                    {questions.map((question) => (
                      <li
                        key={question.id}
                        className="flex items-start gap-2 border border-arena-ink/10 px-2 py-1.5"
                      >
                        <span dir="auto" className="min-w-0 flex-1 text-sm">
                          {question.prompt}
                        </span>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleRemoveQuestion(question.id)}
                          className="shrink-0 text-arena-ink/50 hover:text-arena-signal"
                          aria-label={t('removeFromBank')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <form
                  className="space-y-2 border-t border-arena-ink/10 pt-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleAddQuestion();
                  }}
                >
                  <Label htmlFor="bank-prompt">{t('questionPrompt')}</Label>
                  <Textarea
                    id="bank-prompt"
                    value={prompt}
                    maxLength={150}
                    onChange={(event) => setPrompt(event.target.value)}
                    className="min-h-16 rounded-none border-2 border-arena-ink/20"
                  />
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-bold">{t('correct')}</legend>
                    {answers.map((answer, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="bank-correct"
                          checked={correctIndex === index}
                          onChange={() => setCorrectIndex(index)}
                          aria-label={fill(t('answerSlot'), { n: index + 1 })}
                        />
                        <Input
                          value={answer}
                          maxLength={80}
                          placeholder={fill(t('answerSlot'), { n: index + 1 })}
                          onChange={(event) =>
                            setAnswers((current) =>
                              current.map((text, slot) => (slot === index ? event.target.value : text))
                            )
                          }
                          className="h-9 rounded-none border-2 border-arena-ink/20"
                        />
                      </div>
                    ))}
                  </fieldset>
                  <Button
                    type="submit"
                    disabled={pending || prompt.trim().length === 0}
                    className="h-10 rounded-none border-2 border-arena-ink bg-transparent font-bold text-arena-ink hover:bg-arena-ink hover:text-white"
                  >
                    {t('addQuestion')}
                  </Button>
                </form>
              </>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
