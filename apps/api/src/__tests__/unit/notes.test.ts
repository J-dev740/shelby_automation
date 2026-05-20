import { describe, it, expect } from 'vitest';
import { sanitizeNote } from '../../services/notes.sanitizer.js';

describe('Notes Sanitizer Unit Tests', () => {
  it('D1: Normal text passes through unchanged', () => {
    expect(sanitizeNote('Please extra spicy', 'item')).toBe('Please extra spicy');
  });

  it('D2: URLs are stripped', () => {
    expect(sanitizeNote('Check out https://google.com', 'item')).toBe('Check out');
  });

  it('D3: Profanity words are stripped', () => {
    // Using 'fuck' which is in our set
    expect(sanitizeNote('This is a fuck note', 'item')).toBe('This is a note');
  });

  it('D4: Control characters are stripped', () => {
    expect(sanitizeNote('Line 1\x00Line 2', 'item')).toBe('Line 1Line 2');
  });

  it('D5: Truncation works (80 chars for item)', () => {
    const long = 'a'.repeat(100);
    expect(sanitizeNote(long, 'item')).toHaveLength(80);
  });

  it('D6: Truncation works (140 chars for order)', () => {
    const long = 'a'.repeat(200);
    expect(sanitizeNote(long, 'order')).toHaveLength(140);
  });

  it('D7: Empty/null/undefined returns undefined', () => {
    expect(sanitizeNote('', 'item')).toBeUndefined();
    expect(sanitizeNote(null as any, 'item')).toBeUndefined();
  });
});
