import { describe, it, expect } from 'vitest';
import { sanitizeNote } from '../../services/notes.sanitizer.js';

describe('Notes Sanitizer', () => {
  it('D1 - Normal text passes through unchanged', () => {
    expect(sanitizeNote('Extra sugar please', 'item')).toBe('Extra sugar please');
  });

  it('D2 - URLs are stripped', () => {
    expect(sanitizeNote('Check this out https://spam.com/link', 'item')).toBe('Check this out');
    expect(sanitizeNote('http://bad.org is bad', 'item')).toBe('is bad');
  });

  it('D3 - Profanity words are stripped, valid words preserved', () => {
    // Assuming 'shit' is in the profanity list based on the sanitizer implementation
    expect(sanitizeNote('This is good shit man', 'item')).toBe('This is good man');
  });

  it('D4 - Control characters are stripped', () => {
    expect(sanitizeNote('Hello\x00World\x1f', 'item')).toBe('HelloWorld');
  });

  it('D5 - Item note > 80 chars → truncated to 80', () => {
    const longNote = 'A'.repeat(100);
    const sanitized = sanitizeNote(longNote, 'item');
    expect(sanitized?.length).toBe(80);
    expect(sanitized).toBe('A'.repeat(80));
  });

  it('D6 - Order note > 140 chars → truncated to 140', () => {
    const longNote = 'A'.repeat(150);
    const sanitized = sanitizeNote(longNote, 'order');
    expect(sanitized?.length).toBe(140);
    expect(sanitized).toBe('A'.repeat(140));
  });

  it('D7 - null / undefined / empty string → returns undefined', () => {
    expect(sanitizeNote(null, 'item')).toBeUndefined();
    expect(sanitizeNote(undefined, 'item')).toBeUndefined();
    expect(sanitizeNote('', 'item')).toBeUndefined();
    expect(sanitizeNote('   ', 'item')).toBeUndefined();
  });

  it('D8 - All-profanity note → returns undefined', () => {
    expect(sanitizeNote('shit fuck', 'item')).toBeUndefined();
  });
});
