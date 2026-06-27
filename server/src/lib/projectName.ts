import { RiTa } from "rita";

/**
 * Generates a short, poetic project name like "Crimson Echo" or "Quiet Tide".
 *
 * Uses RiTa's lexicon to pull a random adjective + noun, biased toward short
 * words so the name reads like a evocative two-word phrase. RiTa occasionally
 * returns nothing for a tight constraint, so each part falls back to a curated
 * word to keep name generation total (it must never throw or return empty).
 */
const FALLBACK_ADJECTIVES = ["Crimson", "Quiet", "Golden", "Velvet", "Hollow", "Amber"];
const FALLBACK_NOUNS = ["Echo", "Tide", "Ember", "Drift", "Bloom", "Vapor"];

function pick(words: string[]): string {
  return words[Math.floor(Math.random() * words.length)];
}

function randomWordOrFallback(pos: string, fallbacks: string[]): string {
  let word: string;
  try {
    // Bias toward short words (<= 8 chars), which read as more evocative.
    // RiTa throws if no lexicon word satisfies the constraints.
    word = RiTa.randomWord(undefined, { pos, maxLength: 8 });
  } catch {
    word = pick(fallbacks);
  }
  return RiTa.capitalize(word && word.length > 0 ? word : pick(fallbacks));
}

/** A short, poetic two-word project title (e.g. "Crimson Echo"). */
export function generateProjectName(): string {
  const adjective = randomWordOrFallback("jj", FALLBACK_ADJECTIVES);
  const noun = randomWordOrFallback("nn", FALLBACK_NOUNS);
  return `${adjective} ${noun}`;
}
