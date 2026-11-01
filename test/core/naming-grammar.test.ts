import { describe, it, expect } from 'vitest';

import {
  CHARSET_MAP,
  DEFAULT_NAMING_LANGUAGE,
  SUPPORTED_NAMING_LANGUAGES,
  buildChangeNamePattern,
  normalizeNamingLanguage,
} from '../../src/core/naming-grammar.js';

describe('naming-grammar', () => {
  it('maps zh-CN to the Han-script increment and en to pure kebab', () => {
    expect(CHARSET_MAP['zh-CN']?.extraCharClass).toBe('\\p{Script=Han}');
    expect(CHARSET_MAP['en']?.extraCharClass).toBe('');
    expect(SUPPORTED_NAMING_LANGUAGES).toContain('zh-CN');
    expect(SUPPORTED_NAMING_LANGUAGES).toContain('en');
    expect(DEFAULT_NAMING_LANGUAGE).toBe('zh-CN');
  });

  it('accepts Chinese names under zh-CN and rejects them under en', () => {
    expect(buildChangeNamePattern('zh-CN').test('修复会话过期')).toBe(true);
    expect(buildChangeNamePattern('zh-CN').test('Fix_Session')).toBe(false);
    expect(buildChangeNamePattern('en').test('add-user-auth')).toBe(true);
    expect(buildChangeNamePattern('en').test('修复会话过期')).toBe(false);
  });

  it('keeps numeric and archive-date prefixed forms legal in every language', () => {
    for (const language of SUPPORTED_NAMING_LANGUAGES) {
      expect(buildChangeNamePattern(language).test('100-add-feature'), language).toBe(true);
      expect(buildChangeNamePattern(language).test('00001-add-auth'), language).toBe(true);
      expect(buildChangeNamePattern(language).test('2026-01-02-fix-login'), language).toBe(true);
    }
    // The archive-date prefix with a Chinese name is the zh-CN form.
    expect(buildChangeNamePattern('zh-CN').test('2026-01-02-修复会话过期')).toBe(true);
    expect(buildChangeNamePattern('en').test('2026-01-02-修复会话过期')).toBe(false);
  });

  it('keeps the hyphen-segmented structure in every language', () => {
    for (const language of SUPPORTED_NAMING_LANGUAGES) {
      expect(buildChangeNamePattern(language).test('-add-auth'), language).toBe(false);
      expect(buildChangeNamePattern(language).test('add-auth-'), language).toBe(false);
      expect(buildChangeNamePattern(language).test('add--auth'), language).toBe(false);
      expect(buildChangeNamePattern(language).test('修复--会话'), language).toBe(false);
    }
  });

  it('normalizes language aliases case-insensitively to map keys', () => {
    expect(normalizeNamingLanguage('zh')).toBe('zh-CN');
    expect(normalizeNamingLanguage('ZH-cn')).toBe('zh-CN');
    expect(normalizeNamingLanguage(' en ')).toBe('en');
    expect(normalizeNamingLanguage('fr')).toBeNull();
  });

  it('throws for unknown keys and caches one pattern per language', () => {
    expect(() => buildChangeNamePattern('fr')).toThrow(/Unsupported naming language/);
    const first = buildChangeNamePattern('zh-CN');
    expect(buildChangeNamePattern('zh-CN')).toBe(first);
  });
});
