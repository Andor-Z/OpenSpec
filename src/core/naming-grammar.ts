/**
 * Naming-grammar charset map and dynamic change-name pattern construction.
 *
 * Single source for the change-name character sets: a language key maps to a
 * character-class fragment that is unioned with `[a-z0-9]`, and the union plus
 * the hyphen-segmented structure (no leading/trailing/consecutive hyphens) and
 * the mandatory `u` flag are baked into the build functions below — the map
 * only contributes the character-class increment. Adding a language means
 * adding one map key (e.g. `ja` → `'\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Han}'`);
 * no consumer changes.
 *
 * The union structure keeps numeric prefixes (`100-add-feature`) and
 * archive-date prefixed forms (`2026-01-02-修复会话过期`) legal in every
 * language. Unknown keys are rejected by the config parse layer; the build
 * functions throw as a backstop against direct callers bypassing config.
 */

/** Character-set description for one supported naming language. */
export interface NamingCharset {
  /**
   * Character-class fragment unioned with `[a-z0-9]` inside the change-name
   * pattern; an empty string means pure kebab (equivalent to the upstream
   * `KEBAB_ID_REGEX` behavior).
   */
  readonly extraCharClass: string;
  /** Language description used in validation error copy. */
  readonly label: string;
  /** Example name rendered in validation error copy. */
  readonly example: string;
}

/**
 * The naming-language charset map. Keys are the canonical language identifiers
 * accepted by `naming.changeNameLanguage` configuration (after alias
 * normalization).
 */
export const CHARSET_MAP: Record<string, NamingCharset> = {
  'zh-CN': { extraCharClass: '\\p{Script=Han}', label: '中文汉字', example: '修复会话过期' },
  'en': { extraCharClass: '', label: '', example: 'add-auth' },
};

/** Supported `naming.changeNameLanguage` values, in map order. */
export const SUPPORTED_NAMING_LANGUAGES: readonly string[] = Object.keys(CHARSET_MAP);

/** Built-in naming language when neither project nor global config provides one. */
export const DEFAULT_NAMING_LANGUAGE = 'zh-CN';

/**
 * Lowercase alias → canonical map key. `zh`/`zh-CN` normalize to `zh-CN`
 * (case-insensitive), `en` to `en`; anything else has no alias.
 */
const LANGUAGE_ALIASES: Record<string, string> = {
  'zh': 'zh-CN',
  'zh-cn': 'zh-CN',
  'en': 'en',
};

/**
 * Normalizes a configured naming-language value to a charset-map key, or
 * returns null for values outside the value domain (the caller decides whether
 * to warn-and-drop or reject).
 */
export function normalizeNamingLanguage(value: string): string | null {
  return LANGUAGE_ALIASES[value.trim().toLowerCase()] ?? null;
}

/** The "Supported: zh-CN, en" fragment shared by warn and error copy. */
export function formatSupportedNamingLanguages(): string {
  return SUPPORTED_NAMING_LANGUAGES.join(', ');
}

/**
 * Looks up the charset for a language key. Throws for unknown keys — the
 * backstop for direct callers that bypass the config value-domain checks.
 */
export function getNamingCharset(language: string): NamingCharset {
  const charset = CHARSET_MAP[language];
  if (!charset) {
    throw new Error(
      `Unsupported naming language: ${language}. Supported: ${formatSupportedNamingLanguages()}`
    );
  }
  return charset;
}

const changeNamePatternCache = new Map<string, RegExp>();
const changeNameForbiddenPatternCache = new Map<string, RegExp>();

function charClass(language: string): string {
  return `[${getNamingCharset(language).extraCharClass}a-z0-9]`;
}

/**
 * Builds (and caches) the change-name pattern for a language key: the map's
 * character class unioned with lowercase letters and digits, hyphen-segmented,
 * anchored, with the `u` flag the `\p{...}` escapes require.
 */
export function buildChangeNamePattern(language: string): RegExp {
  const cached = changeNamePatternCache.get(language);
  if (cached) {
    return cached;
  }
  const cls = charClass(language);
  const pattern = new RegExp(`^${cls}+(?:-${cls}+)*$`, 'u');
  changeNamePatternCache.set(language, pattern);
  return pattern;
}

/**
 * Builds (and caches) the forbidden-character pattern for a language key: the
 * complement of the allowed character set (used for the catch-all validation
 * message).
 */
export function buildChangeNameForbiddenPattern(language: string): RegExp {
  const cached = changeNameForbiddenPatternCache.get(language);
  if (cached) {
    return cached;
  }
  const pattern = new RegExp(`[^${getNamingCharset(language).extraCharClass}a-z0-9-]`, 'u');
  changeNameForbiddenPatternCache.set(language, pattern);
  return pattern;
}
