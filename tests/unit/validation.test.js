import { describe, it, expect } from 'vitest';
import {
  parsePages,
  isDomainAllowed,
  getDomainGroup,
  MAX_PAGES,
} from '../../lib/validation.js';

describe('parsePages', () => {
  it('returns Infinity when no param given', () => {
    expect(parsePages(null)).toBe(Infinity);
    expect(parsePages(undefined)).toBe(Infinity);
    expect(parsePages('')).toBe(Infinity);
  });

  it('parses valid positive integers', () => {
    expect(parsePages('1')).toBe(1);
    expect(parsePages('5')).toBe(5);
    expect(parsePages('10')).toBe(10);
  });

  it('caps at MAX_PAGES', () => {
    expect(parsePages('100')).toBe(MAX_PAGES);
    expect(parsePages('999999')).toBe(MAX_PAGES);
    expect(parsePages(String(MAX_PAGES))).toBe(MAX_PAGES);
  });

  it('returns 1 for invalid input', () => {
    expect(parsePages('abc')).toBe(1);
    expect(parsePages('NaN')).toBe(1);
    expect(parsePages('0')).toBe(1);
    expect(parsePages('-5')).toBe(1);
  });

  it('truncates floats to integer part', () => {
    expect(parsePages('3.7')).toBe(3);
    expect(parsePages('1.1')).toBe(1);
  });
});

describe('isDomainAllowed', () => {
  it('accepts all bazos subdomains', () => {
    expect(isDomainAllowed('bazos.sk')).toBe(true);
    expect(isDomainAllowed('www.bazos.sk')).toBe(true);
    expect(isDomainAllowed('pc.bazos.sk')).toBe(true);
    expect(isDomainAllowed('auto.bazos.sk')).toBe(true);
    expect(isDomainAllowed('elektro.bazos.sk')).toBe(true);
  });

  it('accepts other supported domains', () => {
    expect(isDomainAllowed('alza.sk')).toBe(true);
    expect(isDomainAllowed('www.alza.sk')).toBe(true);
    expect(isDomainAllowed('nay.sk')).toBe(true);
    expect(isDomainAllowed('www.nay.sk')).toBe(true);
    expect(isDomainAllowed('mojadm.sk')).toBe(true);
    expect(isDomainAllowed('www.mojadm.sk')).toBe(true);
    expect(isDomainAllowed('decathlon.sk')).toBe(true);
    expect(isDomainAllowed('www.decathlon.sk')).toBe(true);
  });

  it('rejects unknown domains', () => {
    expect(isDomainAllowed('google.com')).toBe(false);
    expect(isDomainAllowed('evil.bazos.sk.attacker.com')).toBe(false);
    expect(isDomainAllowed('amazon.com')).toBe(false);
    expect(isDomainAllowed('')).toBe(false);
  });
});

describe('getDomainGroup', () => {
  it('returns correct group for each site', () => {
    expect(getDomainGroup('bazos.sk')).toBe('bazos');
    expect(getDomainGroup('pc.bazos.sk')).toBe('bazos');
    expect(getDomainGroup('www.alza.sk')).toBe('alza');
    expect(getDomainGroup('www.nay.sk')).toBe('nay');
    expect(getDomainGroup('mojadm.sk')).toBe('mojadm');
    expect(getDomainGroup('www.decathlon.sk')).toBe('decathlon');
  });

  it('returns null for unknown domains', () => {
    expect(getDomainGroup('google.com')).toBe(null);
    expect(getDomainGroup('')).toBe(null);
  });
});
