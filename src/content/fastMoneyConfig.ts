// Hand-pick 5 questions from QUESTIONS as the Fast Money pool.
// FM uses different prompts than the main bracket so the same questions
// don't appear twice in one tournament.
import { QUESTIONS } from './questions';

export const FAST_MONEY_QUESTION_IDS: string[] = [
  'q12', // "Name a song that gets everyone singing" (Sweet Caroline #1)
  'q23', // "Name something people drink during the workday" (Coffee/Water)
  'q20', // "Name something people Google at work that isn't work-related" (Weather)
  'q15', // "Name something that takes longer than it should at work" (Meetings)
  'q9',  // "Name something people forget to bring when traveling for work" (Chargers)
];

// Verify the selected ids exist
for (const id of FAST_MONEY_QUESTION_IDS) {
  if (!QUESTIONS.find(q => q.id === id)) {
    throw new Error(`FAST_MONEY config references missing question: ${id}`);
  }
}
