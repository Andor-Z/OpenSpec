import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// @ts-expect-error - plain ESM helper shared with the generator script
import {
  cleanSkillSubdirectories,
  prepareSkillDirectory,
  validateManualSkillDirs,
} from '../../../scripts/skillssh-shared.mjs';

// Guards for scripts/generate-skillssh.mjs: cleanup must never follow a
// symlink, and writes must only ever land in a real directory inside skills/.
describe('skills.sh generator guards', () => {
  let outDir: string;
  let outsideDir: string;

  beforeEach(() => {
    const base = mkdtempSync(join(tmpdir(), 'skillssh-guards-'));
    outDir = join(base, 'skills');
    outsideDir = join(base, 'outside');
    mkdirSync(outDir, { recursive: true });
    mkdirSync(outsideDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(join(outDir, '..'), { recursive: true, force: true });
  });

  /** Dir symlinks need 'junction' to work unprivileged on Windows; skip if unsupported. */
  function trySymlinkDir(target: string, linkPath: string): boolean {
    try {
      symlinkSync(target, linkPath, 'junction');
      return true;
    } catch {
      return false;
    }
  }

  it('cleanup removes stale skill directories but preserves top-level files', () => {
    mkdirSync(join(outDir, 'openspec-renamed-away'));
    writeFileSync(join(outDir, 'openspec-renamed-away', 'SKILL.md'), 'stale', 'utf8');
    writeFileSync(join(outDir, 'README.md'), 'keep me', 'utf8');

    cleanSkillSubdirectories(outDir);

    expect(existsSync(join(outDir, 'openspec-renamed-away'))).toBe(false);
    expect(readFileSync(join(outDir, 'README.md'), 'utf8')).toBe('keep me');
  });

  it('cleanup refuses to run when the tree contains a symlink, deleting nothing at all', () => {
    writeFileSync(join(outsideDir, 'precious.md'), 'do not touch', 'utf8');
    // Sorts before the symlink: proves the scan rejects before any deletion.
    mkdirSync(join(outDir, 'openspec-aaa-real'));
    if (!trySymlinkDir(outsideDir, join(outDir, 'openspec-linked'))) return;

    expect(() => cleanSkillSubdirectories(outDir)).toThrow(/symlink/);
    expect(readFileSync(join(outsideDir, 'precious.md'), 'utf8')).toBe('do not touch');
    expect(existsSync(join(outDir, 'openspec-aaa-real'))).toBe(true);
  });

  it('cleanup preserves registered manual skill directories byte-for-byte', () => {
    const manualDir = join(outDir, 'opsx-archive-with-validation');
    mkdirSync(join(manualDir, 'references'), { recursive: true });
    writeFileSync(join(manualDir, 'SKILL.md'), 'hand-written skill body', 'utf8');
    writeFileSync(join(manualDir, 'references', 'deep.md'), 'subdocument', 'utf8');

    cleanSkillSubdirectories(outDir, ['opsx-archive-with-validation']);

    expect(readFileSync(join(manualDir, 'SKILL.md'), 'utf8')).toBe('hand-written skill body');
    expect(readFileSync(join(manualDir, 'references', 'deep.md'), 'utf8')).toBe('subdocument');
  });

  it('cleanup still removes unregistered directories alongside protected ones', () => {
    mkdirSync(join(outDir, 'opsx-archive-with-validation'), { recursive: true });
    writeFileSync(join(outDir, 'opsx-archive-with-validation', 'SKILL.md'), 'manual', 'utf8');
    mkdirSync(join(outDir, 'openspec-stale'));
    writeFileSync(join(outDir, 'openspec-stale', 'SKILL.md'), 'stale', 'utf8');

    cleanSkillSubdirectories(outDir, ['opsx-archive-with-validation']);

    expect(existsSync(join(outDir, 'opsx-archive-with-validation', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(outDir, 'openspec-stale'))).toBe(false);
  });

  it('symlink guard runs before deletion even when the allowlist is honored', () => {
    writeFileSync(join(outsideDir, 'precious.md'), 'do not touch', 'utf8');
    const manualDir = join(outDir, 'opsx-archive-with-validation');
    mkdirSync(manualDir, { recursive: true });
    writeFileSync(join(manualDir, 'SKILL.md'), 'manual', 'utf8');
    if (!trySymlinkDir(outsideDir, join(outDir, 'openspec-linked'))) return;

    expect(() => cleanSkillSubdirectories(outDir, ['opsx-archive-with-validation'])).toThrow(
      /symlink/
    );
    // Rejection happens before any deletion: the protected directory survives.
    expect(readFileSync(join(manualDir, 'SKILL.md'), 'utf8')).toBe('manual');
  });

  it('manual allowlist validation rejects unsafe entries before any cleanup', () => {
    for (const name of ['../escape', 'a/b', '..', '.hidden', 'UPPER', '']) {
      expect(
        () => validateManualSkillDirs(outDir, [name], ['openspec-fresh']),
        name
      ).toThrow(/unsafe skill directory name/);
    }
  });

  it('manual allowlist validation rejects names colliding with template skills', () => {
    expect(() =>
      validateManualSkillDirs(outDir, ['opsx-archive-with-validation'], ['opsx-archive-with-validation'])
    ).toThrow(/collide with generated skill directory names/);
  });

  it('manual allowlist validation only warns for registered names missing on disk', () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (message: string) => warnings.push(message);
    try {
      expect(() =>
        validateManualSkillDirs(outDir, ['opsx-archive-with-validation'], ['openspec-fresh'])
      ).not.toThrow();
    } finally {
      console.warn = originalWarn;
    }
    expect(warnings.some((w) => w.includes('opsx-archive-with-validation'))).toBe(true);
  });

  it('prepareSkillDirectory rejects path-traversing or non-simple names', () => {
    for (const name of ['../escape', 'a/b', '..', '.hidden', 'UPPER', '']) {
      expect(() => prepareSkillDirectory(outDir, name), name).toThrow(/unsafe skill directory name/);
    }
    expect(existsSync(join(outDir, '..', 'escape'))).toBe(false);
  });

  it('prepareSkillDirectory refuses a pre-existing symlinked skill directory', () => {
    if (!trySymlinkDir(outsideDir, join(outDir, 'openspec-linked'))) return;

    expect(() => prepareSkillDirectory(outDir, 'openspec-linked')).toThrow(/not a real directory/);
  });

  it('prepareSkillDirectory returns a real contained directory for valid names', () => {
    const dir = prepareSkillDirectory(outDir, 'openspec-new-skill');
    expect(dir).toBe(join(outDir, 'openspec-new-skill'));
    expect(lstatSync(dir).isDirectory()).toBe(true);
    expect(lstatSync(dir).isSymbolicLink()).toBe(false);
  });
});
