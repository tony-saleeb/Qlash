'use client';

import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Question } from '@/lib/game/types';
import { HOST_QUESTION_SELECT } from '@/lib/host/hostRoomFields';

export function useHostQuestionBank(
  quizId: string,
  initialQuestions: Question[],
  supabase: SupabaseClient
) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [questionsLoading, setQuestionsLoading] = useState(initialQuestions.length === 0);
  const supabaseRef = useRef(supabase);
  supabaseRef.current = supabase;

  useEffect(() => {
    if (initialQuestions.length > 0) {
      setQuestions(initialQuestions);
      setQuestionsLoading(false);
      return;
    }

    let cancelled = false;
    setQuestionsLoading(true);
    void supabaseRef.current
      .from('questions')
      .select(HOST_QUESTION_SELECT)
      .eq('quiz_id', quizId)
      .order('order_index', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && Array.isArray(data)) {
          setQuestions(data as Question[]);
        }
        setQuestionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [quizId, initialQuestions]);

  return { questions, questionsLoading };
}
