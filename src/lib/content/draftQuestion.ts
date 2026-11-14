export interface PackAnswer {
  text: string;
  correct: boolean;
}

/** Shared shape for a pasted question and a question stored in a bank. */
export interface PackQuestion {
  prompt: string;
  answers: PackAnswer[];
}
