import { describe, it, expect } from 'vitest';
import { cleanText, DEFAULT_USER_AGENT } from '../../lib/browser.js';

describe('cleanText', () => {
  it('trims whitespace', () => {
    expect(cleanText('  hello  ')).toBe('hello');
  });

  it('collapses multiple spaces', () => {
    expect(cleanText('hello   world')).toBe('hello world');
  });

  it('collapses newlines and tabs', () => {
    expect(cleanText('hello\n\t  world')).toBe('hello world');
  });

  it('returns empty string for falsy input', () => {
    expect(cleanText(null)).toBe('');
    expect(cleanText(undefined)).toBe('');
    expect(cleanText('')).toBe('');
  });

  it('handles normal text unchanged', () => {
    expect(cleanText('hello world')).toBe('hello world');
  });
});

describe('DEFAULT_USER_AGENT', () => {
  it('looks like a Chrome user agent', () => {
    expect(DEFAULT_USER_AGENT).toContain('Chrome');
    expect(DEFAULT_USER_AGENT).toContain('Mozilla');
  });
});
