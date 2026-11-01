import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { readProjectConfig } from '../../src/core/project-config.js';
import { resolveNamingLanguage } from '../../src/utils/change-utils.js';

/**
 * Two-level naming-language resolution (configurable-naming-language):
 * project config.yaml naming.changeNameLanguage > global config.json
 * naming.changeNameLanguage > built-in zh-CN. The global level is a
 * machine-level fallback and never overrides the project; each level
 * degrades independently.
 */
describe('naming language configuration', () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;
  let projectRoot: string;
  let globalConfigDir: string;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openspec-naming-test-'));
    originalEnv = { ...process.env };
    globalConfigDir = path.join(tempDir, 'xdg', 'openspec');
    process.env.XDG_CONFIG_HOME = path.join(tempDir, 'xdg');
    fs.mkdirSync(globalConfigDir, { recursive: true });
    projectRoot = path.join(tempDir, 'project');
    fs.mkdirSync(path.join(projectRoot, 'openspec'), { recursive: true });
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tempDir, { recursive: true, force: true });
    warnSpy.mockRestore();
  });

  function writeProjectConfig(content: string): void {
    fs.writeFileSync(path.join(projectRoot, 'openspec', 'config.yaml'), content, 'utf-8');
  }

  function writeGlobalConfig(json: unknown): void {
    fs.writeFileSync(
      path.join(globalConfigDir, 'config.json'),
      JSON.stringify(json, null, 2),
      'utf-8'
    );
  }

  describe('resolveNamingLanguage precedence', () => {
    it('lets the project value override the global value', () => {
      writeProjectConfig('naming:\n  changeNameLanguage: zh-CN\n');
      writeGlobalConfig({ naming: { changeNameLanguage: 'en' } });
      expect(resolveNamingLanguage(projectRoot)).toBe('zh-CN');
    });

    it('applies the global value when the project has no naming node', () => {
      writeProjectConfig('schema: spec-driven\n');
      writeGlobalConfig({ naming: { changeNameLanguage: 'en' } });
      expect(resolveNamingLanguage(projectRoot)).toBe('en');
    });

    it('defaults to zh-CN when neither level configures naming', () => {
      expect(resolveNamingLanguage(projectRoot)).toBe('zh-CN');
    });

    it('degrades to the global level when the project config cannot be parsed', () => {
      writeProjectConfig('::::: not yaml [\n');
      writeGlobalConfig({ naming: { changeNameLanguage: 'en' } });
      expect(resolveNamingLanguage(projectRoot)).toBe('en');
    });

    it('skips an unknown global value and falls back to the default', () => {
      writeGlobalConfig({ naming: { changeNameLanguage: 'fr' } });
      expect(resolveNamingLanguage(projectRoot)).toBe('zh-CN');
    });

    it('normalizes project aliases to charset-map keys', () => {
      writeProjectConfig('naming:\n  changeNameLanguage: zh\n');
      expect(resolveNamingLanguage(projectRoot)).toBe('zh-CN');
      writeProjectConfig('naming:\n  changeNameLanguage: ZH-cn\n');
      expect(resolveNamingLanguage(projectRoot)).toBe('zh-CN');
    });
  });

  describe('readProjectConfig explicit naming parsing', () => {
    it('parses legal values into the returned config', () => {
      for (const value of ['zh-CN', 'en']) {
        writeProjectConfig(`schema: spec-driven\nnaming:\n  changeNameLanguage: ${value}\n`);
        const config = readProjectConfig(projectRoot);
        expect(config?.naming?.changeNameLanguage, value).toBe(value);
      }
    });

    it('warns and drops a non-object naming node, keeping other fields', () => {
      writeProjectConfig('schema: spec-driven\nnaming: "zh-CN"\n');
      const config = readProjectConfig(projectRoot);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid 'naming' field in config (must be an object)")
      );
      expect(config?.naming).toBeUndefined();
      expect(config?.schema).toBe('spec-driven');
    });

    it('warns and drops a non-string changeNameLanguage', () => {
      writeProjectConfig('naming:\n  changeNameLanguage: 123\n');
      const config = readProjectConfig(projectRoot);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid 'naming.changeNameLanguage' field in config")
      );
      expect(config?.naming).toBeUndefined();
    });

    it('warns with the supported list for unknown values and drops the field', () => {
      writeProjectConfig('naming:\n  changeNameLanguage: fr\n');
      const config = readProjectConfig(projectRoot);
      expect(warnSpy).toHaveBeenCalledWith(
        "Invalid 'naming.changeNameLanguage' value 'fr'. Supported: zh-CN, en"
      );
      expect(config?.naming).toBeUndefined();
      // The consumer falls back to the default without hard failure.
      expect(resolveNamingLanguage(projectRoot)).toBe('zh-CN');
    });

    it('stays silent when the naming node is absent', () => {
      writeProjectConfig('schema: spec-driven\n');
      readProjectConfig(projectRoot);
      const namingWarnings = warnSpy.mock.calls.filter(call =>
        String(call[0]).includes('naming')
      );
      expect(namingWarnings).toEqual([]);
    });
  });
});
