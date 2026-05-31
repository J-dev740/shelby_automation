export const MAX_ITEM_NOTE = 80;
export const MAX_ORDER_NOTE = 140;

// A simple curated list for India context; expand as needed
const PROFANITY = new Set(['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'chutiya', 'madarchod', 'bhenchod']);
const URL_RE = /https?:\/\/\S+/gi;

export function sanitizeNote(input: string | undefined | null, kind: 'item' | 'order'): string | undefined {
  if (!input) return undefined;

  let s = input.trim();
  
  // 1. Strip control characters
  s = s.replace(/[\x00-\x1f\x7f]/g, '');
  
  // 2. Strip URLs
  s = s.replace(URL_RE, '');
  
  // 3. Truncate to max length
  const max = kind === 'item' ? MAX_ITEM_NOTE : MAX_ORDER_NOTE;
  if (s.length > max) s = s.slice(0, max);
  
  // 4. Tokenize and drop profanity tokens
  const tokens = s.split(/\s+/).filter(t => !PROFANITY.has(t.toLowerCase()));
  
  const finalNote = tokens.join(' ').trim();
  return finalNote.length > 0 ? finalNote : undefined;
}
