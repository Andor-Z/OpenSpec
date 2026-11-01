import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

async function runConfigCommand(args: string[]): Promise<void> {
  const { registerConfigCommand } = await import('../../src/cli/commands/config.js');
  const program = new Command();
  registerConfigCommand(program);
  await program.parseAsync(['node', 'openspec', 'config', ...args]);
}

/**
 * CLI surface for the global naming fallback (configurable-naming-language):
 * `config set/get/unset naming.changeNameLanguage`, with the value domain
 * enforced at set time so an unknown value is rejected before any write.
 */
describe('config command naming keys', () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openspec-config-naming-test-'));
    originalEnv = { ...process.env };
    process.env.XDG_CONFIG_HOME = tempDir;
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tempDir, { recursive: true, force: true });
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    vi.resetModules();
  });

  function configPath(): string {
    return path.join(tempDir, 'openspec', 'config.json');
  }

  function seedConfigJson(json: unknown): void {
    fs.mkdirSync(path.dirname(configPath()), { recursive: true });
    fs.writeFileSync(configPath(), JSON.stringify(json, null, 2), 'utf-8');
  }

  function readConfigJson(): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(configPath(), 'utf-8')) as Record<string, unknown>;
  }

  it('writes a legal value into the global config.json keeping other fields', async () => {
    seedConfigJson({ profile: 'custom', delivery: 'skills' });
    await runConfigCommand(['set', 'naming.changeNameLanguage', 'en']);
    const config = readConfigJson();
    expect(config.naming).toEqual({ changeNameLanguage: 'en' });
    expect(config.profile).toBe('custom');
    expect(config.delivery).toBe('skills');
  });

  it('rejects an unknown value without writing the file', async () => {
    seedConfigJson({ profile: 'core' });
    await runConfigCommand(['set', 'naming.changeNameLanguage', 'fr']);
    expect(process.exitCode).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('zh-CN, en'));
    expect(readConfigJson()).toEqual({ profile: 'core' });
    process.exitCode = 0;
  });

  it('rejects a non-string coerced value without writing the file', async () => {
    seedConfigJson({ profile: 'core' });
    await runConfigCommand(['set', 'naming.changeNameLanguage', '123']);
    expect(process.exitCode).toBe(1);
    expect(readConfigJson()).toEqual({ profile: 'core' });
    process.exitCode = 0;
  });

  it('rejects unknown naming nested keys', async () => {
    await runConfigCommand(['set', 'naming.otherKey', 'x']);
    expect(process.exitCode).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('changeNameLanguage')
    );
    expect(fs.existsSync(configPath())).toBe(false);
    process.exitCode = 0;
  });

  it('prints the current value on get', async () => {
    seedConfigJson({ naming: { changeNameLanguage: 'en' } });
    await runConfigCommand(['get', 'naming.changeNameLanguage']);
    expect(consoleLogSpy).toHaveBeenCalledWith('en');
  });

  it('removes the key on unset', async () => {
    seedConfigJson({ profile: 'core', naming: { changeNameLanguage: 'en' } });
    await runConfigCommand(['unset', 'naming.changeNameLanguage']);
    const config = readConfigJson();
    // The changeNameLanguage key is gone, so resolution falls back to the
    // project config or the built-in default.
    expect((config.naming as Record<string, unknown> | undefined)?.changeNameLanguage).toBeUndefined();
    expect(config.profile).toBe('core');
  });

  it('keeps --allow-unknown bypassing the value domain but not the key whitelist', async () => {
    await runConfigCommand(['set', 'naming.changeNameLanguage', 'fr', '--allow-unknown']);
    expect(readConfigJson().naming).toEqual({ changeNameLanguage: 'fr' });
    process.exitCode = 0;
  });
});
