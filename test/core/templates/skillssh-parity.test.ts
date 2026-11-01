import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  MANUAL_SKILL_DIRS,
  generateSkillContent,
  getSkillTemplates,
} from '../../../src/core/shared/skill-generation.js';
import { transformToSkillReferences } from '../../../src/utils/command-references.js';
// @ts-expect-error - plain ESM helper shared with the generator script
import { SKILLS_DIR, stripVolatileFrontmatter } from '../../../scripts/skillssh-shared.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// Guard against extra, renamed, or symlinked entries that the per-template
// loop above would never visit: the committed tree must be exactly what the
// generator owns — README.md plus one real directory per template, each
// holding a single real SKILL.md — plus any directory registered in
// MANUAL_SKILL_DIRS (hand-written skills: exempt from the per-template
// content pins and the single-file inner check, never from the symlink
// guard). Unregistered extra directories are still rejected.
function expectExactGeneratedFileSet(skillsRoot: string): void {
  const templateDirs = getSkillTemplates()
    .map(({ dirName }) => dirName)
    .sort();
  const allowedDirs = [...templateDirs, ...MANUAL_SKILL_DIRS].sort();

  const entries = readdirSync(skillsRoot, { withFileTypes: true });
  for (const entry of entries) {
    expect(entry.isSymbolicLink(), `skills/${entry.name} must not be a symlink`).toBe(false);
  }

  // Untracked OS droppings like .DS_Store would fail the exact-set check
  // without telling us anything about the published tree, so hidden *files*
  // are tolerated; hidden directories still fail the dirs assertion.
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  const files = entries
    .filter((e) => e.isFile() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
  const unregistered = dirs.filter((d) => !allowedDirs.includes(d));
  expect(
    unregistered,
    'unregistered extra directories under skills/ — register them in MANUAL_SKILL_DIRS or remove them'
  ).toEqual([]);
  const missingTemplates = templateDirs.filter((d) => !dirs.includes(d));
  expect(missingTemplates, 'generated skill directories missing from skills/').toEqual([]);
  expect(files).toEqual(['README.md']);

  for (const dir of dirs) {
    if (MANUAL_SKILL_DIRS.includes(dir)) {
      // Hand-written skills may carry references/ etc.; nothing to pin here.
      continue;
    }
    const inner = readdirSync(join(skillsRoot, dir), { withFileTypes: true }).filter(
      (e) => !(e.isFile() && e.name.startsWith('.'))
    );
    expect(
      inner.map((e) => e.name),
      `skills/${dir} must contain only SKILL.md`
    ).toEqual(['SKILL.md']);
    expect(inner[0]!.isFile(), `skills/${dir}/SKILL.md must be a regular file`).toBe(true);
  }
}

function createTemporarySkillsRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'skillssh-parity-'));
  writeFileSync(join(root, 'README.md'), 'distribution root', 'utf8');
  for (const dirName of getSkillTemplates().map(({ dirName }) => dirName)) {
    mkdirSync(join(root, dirName), { recursive: true });
    writeFileSync(join(root, dirName, 'SKILL.md'), `generated: ${dirName}`, 'utf8');
  }
  return root;
}

// The committed `skills/<name>/SKILL.md` tree is the skills.sh distribution
// (`npx skills add Fission-AI/OpenSpec`). It must match what the generator
// would produce from the live templates; regenerate with `pnpm generate:skills`.
describe('skills.sh distribution parity', () => {
  it('keeps committed skills/ in sync with the workflow templates', () => {
    for (const { template, dirName } of getSkillTemplates()) {
      const expected = stripVolatileFrontmatter(
        generateSkillContent(template, 'skills.sh', transformToSkillReferences)
      );
      const committedPath = join(repoRoot, SKILLS_DIR, dirName, 'SKILL.md');
      const committed = readFileSync(committedPath, 'utf8');
      expect(committed, `${dirName} is stale — run \`pnpm generate:skills\``).toBe(expected);
    }
  });

  it('commits exactly the generated file set — no extra or symlinked entries', () => {
    expectExactGeneratedFileSet(join(repoRoot, SKILLS_DIR));
  });

  it('tolerates a registered manual skill directory (and its subdocuments)', () => {
    const root = createTemporarySkillsRoot();
    try {
      const manualDir = join(root, MANUAL_SKILL_DIRS[0]!);
      mkdirSync(join(manualDir, 'references'), { recursive: true });
      writeFileSync(join(manualDir, 'SKILL.md'), 'hand-written', 'utf8');
      writeFileSync(join(manualDir, 'references', 'deep.md'), 'subdocument', 'utf8');
      expectExactGeneratedFileSet(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('still rejects an unregistered extra directory', () => {
    const root = createTemporarySkillsRoot();
    try {
      mkdirSync(join(root, 'openspec-unregistered-extra'), { recursive: true });
      writeFileSync(join(root, 'openspec-unregistered-extra', 'SKILL.md'), 'extra', 'utf8');
      expect(() => expectExactGeneratedFileSet(root)).toThrow(
        /unregistered extra directories/
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
