import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { validateChangeName, createChange } from '../../src/utils/change-utils.js';

describe('validateChangeName', () => {
  describe('valid names', () => {
    it('should accept simple kebab-case name', () => {
      const result = validateChangeName('add-auth');
      expect(result).toEqual({ valid: true });
    });

    it('should accept a long-but-bounded name and reject one past the cap', () => {
      // Past the cap the failure must be a validation message, not a raw
      // ENAMETOOLONG once mkdir hits the 255-byte component limit. The cap
      // counts UTF-8 bytes, so 220 ASCII characters (220 bytes) pass and
      // 221 fail.
      expect(validateChangeName('a'.repeat(220))).toEqual({ valid: true });
      const result = validateChangeName('a'.repeat(221));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
      expect(result.error).toContain('UTF-8 bytes');
    });

    it('should accept name with multiple segments', () => {
      const result = validateChangeName('add-user-auth');
      expect(result).toEqual({ valid: true });
    });

    it('should accept name with numeric suffix', () => {
      const result = validateChangeName('add-feature-2');
      expect(result).toEqual({ valid: true });
    });

    it('should accept single word name', () => {
      const result = validateChangeName('refactor');
      expect(result).toEqual({ valid: true });
    });

    it('should accept name with numbers in segments', () => {
      const result = validateChangeName('upgrade-to-v2');
      expect(result).toEqual({ valid: true });
    });

    it('should accept a numeric-prefixed name for ordering (#850, #1169)', () => {
      const result = validateChangeName('100-add-feature');
      expect(result).toEqual({ valid: true });
    });

    it('should accept a zero-padded numeric-prefixed name', () => {
      const result = validateChangeName('00001-add-auth');
      expect(result).toEqual({ valid: true });
    });

    it('should accept a tiered numeric prefix with alphanumeric segments (#850)', () => {
      const result = validateChangeName('101-01-fix-auth');
      expect(result).toEqual({ valid: true });
    });

    it('should accept an all-numeric name', () => {
      const result = validateChangeName('100');
      expect(result).toEqual({ valid: true });
    });
  });

  describe('valid names - Chinese allowed', () => {
    it('should accept a pure Chinese name', () => {
      const result = validateChangeName('修复会话过期');
      expect(result).toEqual({ valid: true });
    });

    it('should accept a numeric-prefixed Chinese name for ordering', () => {
      const result = validateChangeName('100-修复登录');
      expect(result).toEqual({ valid: true });
    });

    it('should accept a mixed Chinese-English segment name', () => {
      const result = validateChangeName('修复-session-timeout');
      expect(result).toEqual({ valid: true });
    });

    it('should accept the archive date-prefixed form with a Chinese name', () => {
      const result = validateChangeName('2026-01-02-修复会话过期');
      expect(result).toEqual({ valid: true });
    });

    it('should accept 68 Chinese characters (204 UTF-8 bytes)', () => {
      // 68 x 3 = 204 bytes, comfortably inside the 220-byte cap.
      expect(validateChangeName('修'.repeat(68))).toEqual({ valid: true });
    });

    it('should accept 73 Chinese characters (219 UTF-8 bytes, inside the cap)', () => {
      // 73 x 3 = 219 bytes <= 220: the last Chinese character count that fits.
      expect(validateChangeName('修'.repeat(73))).toEqual({ valid: true });
    });
  });

  describe('invalid names - Chinese-era rejections', () => {
    it('should reject a name with uppercase letters and underscores', () => {
      const result = validateChangeName('Fix_Session');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('underscores');
    });

    it('should reject fullwidth letters (Script=Common, not Han)', () => {
      const result = validateChangeName('ＡＢＣ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('中文汉字');
    });

    it('should reject a Chinese name with spaces', () => {
      const result = validateChangeName('修复 会话过期');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('spaces');
    });

    it('should reject a Chinese name with consecutive hyphens', () => {
      const result = validateChangeName('修复--会话');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('consecutive hyphens');
    });

    it('should reject 74 Chinese characters (222 UTF-8 bytes, past the cap)', () => {
      // 74 x 3 = 222 bytes > 220: the error must explain the byte semantics.
      const result = validateChangeName('修'.repeat(74));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('UTF-8 bytes');
      expect(result.error).toContain('3 bytes');
    });
  });

  describe('invalid names - uppercase rejected', () => {
    it('should reject name with uppercase letters', () => {
      const result = validateChangeName('Add-Auth');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lowercase');
    });

    it('should reject fully uppercase name', () => {
      const result = validateChangeName('ADD-AUTH');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lowercase');
    });
  });

  describe('invalid names - spaces rejected', () => {
    it('should reject name with spaces', () => {
      const result = validateChangeName('add auth');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('spaces');
    });
  });

  describe('invalid names - underscores rejected', () => {
    it('should reject name with underscores', () => {
      const result = validateChangeName('add_auth');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('underscores');
    });
  });

  describe('invalid names - special characters rejected', () => {
    it('should reject name with exclamation mark', () => {
      const result = validateChangeName('add-auth!');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject name with @ symbol', () => {
      const result = validateChangeName('add@auth');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('invalid names - leading/trailing hyphens rejected', () => {
    it('should reject name with leading hyphen', () => {
      const result = validateChangeName('-add-auth');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('start with a hyphen');
    });

    it('should reject name with trailing hyphen', () => {
      const result = validateChangeName('add-auth-');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('end with a hyphen');
    });
  });

  describe('invalid names - consecutive hyphens rejected', () => {
    it('should reject name with double hyphens', () => {
      const result = validateChangeName('add--auth');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('consecutive hyphens');
    });
  });

  describe('invalid names - empty name rejected', () => {
    it('should reject empty string', () => {
      const result = validateChangeName('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });
  });

  describe('language option (configurable naming language)', () => {
    it('defaults to zh-CN when no language is passed', () => {
      expect(validateChangeName('修复会话过期')).toEqual({ valid: true });
      expect(validateChangeName('add-user-auth')).toEqual({ valid: true });
    });

    it('accepts English kebab names and rejects Chinese names in en mode', () => {
      expect(validateChangeName('add-user-auth', { language: 'en' })).toEqual({ valid: true });
      const rejected = validateChangeName('修复会话过期', { language: 'en' });
      expect(rejected.valid).toBe(false);
      expect(rejected.error).toContain('lowercase letters, numbers, and hyphens');
      expect(rejected.error).not.toContain('中文汉字');
    });

    it('keeps the existing ASCII behavior green in en mode', () => {
      for (const name of ['add-auth', 'add-user-auth', 'add-feature-2', 'refactor', 'upgrade-to-v2', '100-add-feature', '00001-add-auth', '101-01-fix-auth', '100']) {
        expect(validateChangeName(name, { language: 'en' }), name).toEqual({ valid: true });
      }
      for (const name of ['Add-Auth', 'add auth', 'add_auth', 'add-auth!', 'add@auth', '-add-auth', 'add-auth-', 'add--auth']) {
        const result = validateChangeName(name, { language: 'en' });
        expect(result.valid, name).toBe(false);
        expect(result.error, name).toBeDefined();
      }
    });

    it('applies the mixed-segment rule per language', () => {
      expect(validateChangeName('修复-session-timeout')).toEqual({ valid: true });
      expect(validateChangeName('修复-session-timeout', { language: 'en' }).valid).toBe(false);
    });

    it('applies the 220-byte cap identically across languages', () => {
      // zh-CN boundary: 73 Chinese characters (219 bytes) fit, 74 (222) do not.
      expect(validateChangeName('修'.repeat(73), { language: 'zh-CN' })).toEqual({ valid: true });
      const over = validateChangeName('修'.repeat(74), { language: 'zh-CN' });
      expect(over.valid).toBe(false);
      expect(over.error).toContain('UTF-8 bytes');
      // en: same byte cap on ASCII characters, independent of the charset.
      expect(validateChangeName('a'.repeat(220), { language: 'en' })).toEqual({ valid: true });
      expect(validateChangeName('a'.repeat(221), { language: 'en' }).valid).toBe(false);
      // 74 Chinese characters exceed the byte cap before the charset matters.
      expect(validateChangeName('修'.repeat(74), { language: 'en' }).error).toContain('UTF-8 bytes');
    });

    it('describes the configured language charset in error copy', () => {
      const zh = validateChangeName('ＡＢＣ');
      expect(zh.error).toContain('中文汉字');
      const enSummary = validateChangeName('ＡＢＣ', { language: 'en' });
      expect(enSummary.error).toContain('lowercase letters, numbers');
      expect(enSummary.error).not.toContain('中文汉字');
    });
  });
});

describe('createChange', () => {
  let testDir: string;
  const originalTimeZone = process.env.TZ;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-test-'));
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (originalTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTimeZone;
    }
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('creates directory', () => {
    it('should create change directory', async () => {
      await createChange(testDir, 'add-auth');

      const changeDir = path.join(testDir, 'openspec', 'changes', 'add-auth');
      const stats = await fs.stat(changeDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create a numeric-prefixed change directory (#850, #1169)', async () => {
      await createChange(testDir, '100-add-feature');

      const changeDir = path.join(testDir, 'openspec', 'changes', '100-add-feature');
      const stats = await fs.stat(changeDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create .openspec.yaml metadata file with default schema', async () => {
      await createChange(testDir, 'add-auth');

      const metaPath = path.join(testDir, 'openspec', 'changes', 'add-auth', '.openspec.yaml');
      const content = await fs.readFile(metaPath, 'utf-8');
      expect(content).toContain('schema: spec-driven');
      expect(content).toMatch(/created: \d{4}-\d{2}-\d{2}/);
    });

    it('should use the process local date across a UTC date boundary', async () => {
      process.env.TZ = 'Asia/Shanghai';
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-14T16:30:00.000Z'));

      await createChange(testDir, 'local-date-change');

      const metaPath = path.join(testDir, 'openspec', 'changes', 'local-date-change', '.openspec.yaml');
      const content = await fs.readFile(metaPath, 'utf-8');
      expect(content).toContain('created: 2026-07-15');
    });

    it('should preserve the date when UTC and local calendar dates match', async () => {
      process.env.TZ = 'Asia/Shanghai';
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-05T04:30:00.000Z'));

      await createChange(testDir, 'same-date-change');

      const metaPath = path.join(testDir, 'openspec', 'changes', 'same-date-change', '.openspec.yaml');
      const content = await fs.readFile(metaPath, 'utf-8');
      expect(content).toContain('created: 2026-01-05');
    });

    it('should create .openspec.yaml with custom schema', async () => {
      await createChange(testDir, 'add-auth', { schema: 'spec-driven' });

      const metaPath = path.join(testDir, 'openspec', 'changes', 'add-auth', '.openspec.yaml');
      const content = await fs.readFile(metaPath, 'utf-8');
      expect(content).toContain('schema: spec-driven');
    });
  });

  describe('schema validation', () => {
    it('should throw error for unknown schema', async () => {
      await expect(createChange(testDir, 'add-auth', { schema: 'unknown-schema' })).rejects.toThrow(
        /Unknown schema/
      );
    });
  });

  describe('duplicate change throws error', () => {
    it('should throw error if change already exists', async () => {
      await createChange(testDir, 'add-auth');

      await expect(createChange(testDir, 'add-auth')).rejects.toThrow(
        /already exists/
      );
    });
  });

  describe('invalid name throws validation error', () => {
    it('should throw error for uppercase name', async () => {
      await expect(createChange(testDir, 'Add-Auth')).rejects.toThrow(
        /lowercase/
      );
    });

    it('should throw error for name with spaces', async () => {
      await expect(createChange(testDir, 'add auth')).rejects.toThrow(
        /spaces/
      );
    });

    it('should throw error for empty name', async () => {
      await expect(createChange(testDir, '')).rejects.toThrow(
        /empty/
      );
    });
  });

  describe('creates parent directories if needed', () => {
    it('should create openspec/changes/ directories if they do not exist', async () => {
      const newProjectDir = path.join(testDir, 'new-project');
      await fs.mkdir(newProjectDir);

      // openspec/changes/ does not exist yet
      await createChange(newProjectDir, 'add-auth');

      const changeDir = path.join(newProjectDir, 'openspec', 'changes', 'add-auth');
      const stats = await fs.stat(changeDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });
});
