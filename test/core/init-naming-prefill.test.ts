import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { InitCommand } from '../../src/core/init.js';
import { readProjectConfig } from '../../src/core/project-config.js';

const { confirmMock, showWelcomeScreenMock, searchableMultiSelectMock } = vi.hoisted(() => ({
  confirmMock: vi.fn(),
  showWelcomeScreenMock: vi.fn().mockResolvedValue(undefined),
  searchableMultiSelectMock: vi.fn(),
}));

vi.mock('@inquirer/prompts', () => ({
  confirm: confirmMock,
}));

vi.mock('../../src/ui/welcome-screen.js', () => ({
  showWelcomeScreen: showWelcomeScreenMock,
}));

vi.mock('../../src/prompts/searchable-multi-select.js', () => ({
  searchableMultiSelect: searchableMultiSelectMock,
}));

/**
 * The init prefill for naming.changeNameLanguage (configurable-naming-language):
 * fresh configs get the default zh-CN, --language maps onto the prefill when it
 * names a charset-map key, and an existing config is never overwritten.
 */
describe('init naming prefill', () => {
  let testDir: string;
  let configTempDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-init-naming-test-'));
    originalEnv = { ...process.env };
    configTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-config-init-naming-'));
    process.env.XDG_CONFIG_HOME = configTempDir;
    process.env.CODEX_HOME = path.join(testDir, 'codex-home');
    process.env.HOME = path.join(testDir, 'home');
    process.env.USERPROFILE = path.join(testDir, 'home');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    confirmMock.mockReset();
    confirmMock.mockResolvedValue(true);
    showWelcomeScreenMock.mockClear();
    searchableMultiSelectMock.mockReset();
  });

  afterEach(async () => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    await fs.rm(testDir, { recursive: true, force: true });
    await fs.rm(configTempDir, { recursive: true, force: true });
  });

  function configPath(): string {
    return path.join(testDir, 'openspec', 'config.yaml');
  }

  it('prefills the default zh-CN on a fresh init', async () => {
    await new InitCommand({ tools: 'none', force: true }).execute(testDir);
    const yaml = await fs.readFile(configPath(), 'utf-8');
    expect(yaml).toContain('naming:');
    expect(yaml).toContain('changeNameLanguage: zh-CN');
    const config = readProjectConfig(testDir);
    expect(config?.naming?.changeNameLanguage).toBe('zh-CN');
  });

  it('maps --language zh-CN and en onto the naming prefill', async () => {
    const zhDir = path.join(testDir, 'zh');
    await fs.mkdir(zhDir);
    await new InitCommand({ tools: 'none', force: true, language: 'zh-CN' }).execute(zhDir);
    expect(await fs.readFile(path.join(zhDir, 'openspec', 'config.yaml'), 'utf-8'))
      .toContain('changeNameLanguage: zh-CN');

    const enDir = path.join(testDir, 'en');
    await fs.mkdir(enDir);
    await new InitCommand({ tools: 'none', force: true, language: 'en' }).execute(enDir);
    expect(await fs.readFile(path.join(enDir, 'openspec', 'config.yaml'), 'utf-8'))
      .toContain('changeNameLanguage: en');
  });

  it('maps the zh alias case-insensitively and keeps free text away from naming', async () => {
    const aliasDir = path.join(testDir, 'alias');
    await fs.mkdir(aliasDir);
    await new InitCommand({ tools: 'none', force: true, language: 'ZH' }).execute(aliasDir);
    expect(await fs.readFile(path.join(aliasDir, 'openspec', 'config.yaml'), 'utf-8'))
      .toContain('changeNameLanguage: zh-CN');

    const freeDir = path.join(testDir, 'free');
    await fs.mkdir(freeDir);
    await new InitCommand({ tools: 'none', force: true, language: 'Spanish' }).execute(freeDir);
    const yaml = await fs.readFile(path.join(freeDir, 'openspec', 'config.yaml'), 'utf-8');
    expect(yaml).toContain('changeNameLanguage: zh-CN');
  });

  it('never overwrites an existing config (no silent migration)', async () => {
    await new InitCommand({ tools: 'none', force: true }).execute(testDir);
    const before = await fs.readFile(configPath(), 'utf-8');

    // A second init over the existing config must leave the file byte-identical:
    // createConfig returns 'exists' without writing (no silent migration).
    await new InitCommand({ tools: 'none', force: true }).execute(testDir);
    expect(await fs.readFile(configPath(), 'utf-8')).toBe(before);
  });
});
