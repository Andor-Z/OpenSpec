/**
 * Shared helpers for the skills.sh distribution generator and its parity test.
 */

import { lstatSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/** Directory (repo-relative) that skills.sh scans for `SKILL.md` files. */
export const SKILLS_DIR = 'skills';

/**
 * Drop the per-release `generatedBy` frontmatter line so the committed
 * skills.sh copies stay byte-stable across OpenSpec version bumps. The line is
 * meaningful only for skills that `openspec init` writes into a project; in the
 * standalone distribution it would just churn the files on every release.
 */
export function stripVolatileFrontmatter(content) {
  return content.replace(/^ {2}generatedBy: .*\n/m, '');
}

/**
 * Remove existing skill subdirectories (clears any renamed/removed skills)
 * while preserving top-level files like README.md. Directories listed in
 * `protectedNames` (the MANUAL_SKILL_DIRS allowlist) are skipped: manual
 * skills are hand-written, not generated, so regeneration must leave them
 * untouched. Refuses to run if the tree contains a symlink: deleting one
 * would only unlink it, and a symlinked skill directory would otherwise let
 * later writes land outside the repo. The symlink check runs before any
 * deletion and covers protected directories too — the allowlist protects a
 * directory from cleanup, never from the safety checks.
 */
export function cleanSkillSubdirectories(outDir, protectedNames = []) {
  mkdirSync(outDir, { recursive: true });
  const entries = readdirSync(outDir, { withFileTypes: true });
  // Reject before deleting anything so a bad tree is left fully intact.
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      throw new Error(
        `Refusing to generate: ${join(outDir, entry.name)} is a symlink. Remove it and re-run.`
      );
    }
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !protectedNames.includes(entry.name)) {
      rmSync(join(outDir, entry.name), { recursive: true, force: true });
    }
  }
}

/** Same kebab-case rule as prepareSkillDirectory — one pattern, two consumers. */
const SKILL_DIR_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Validate the manual-skill allowlist before anything gets cleaned or
 * written. An unsafe name or a name that collides with a generated template
 * skill directory aborts generation (a silent skip would let a typo'd
 * registration vanish the manual skill on the next run). A registered name
 * that is simply not on disk yet only warns: registering ahead of writing
 * the skill is a normal workflow, not an error.
 */
export function validateManualSkillDirs(outDir, manualDirs, templateDirNames) {
  for (const name of manualDirs) {
    if (!SKILL_DIR_NAME_PATTERN.test(name)) {
      throw new Error(
        `Invalid MANUAL_SKILL_DIRS entry ${JSON.stringify(name)}: unsafe skill directory name (expected kebab-case)`
      );
    }
  }
  const conflicts = manualDirs.filter((name) => templateDirNames.includes(name));
  if (conflicts.length > 0) {
    throw new Error(
      `MANUAL_SKILL_DIRS entries ${conflicts.map((n) => JSON.stringify(n)).join(', ')} collide with generated skill directory names. Pick one: register it as a manual skill (remove the template) or keep it generated (remove it from MANUAL_SKILL_DIRS).`
    );
  }
  for (const name of manualDirs) {
    if (!readdirSync(outDir, { withFileTypes: true }).some((e) => e.name === name)) {
      console.warn(
        `MANUAL_SKILL_DIRS entry ${JSON.stringify(name)} does not exist under ${outDir} yet; nothing to preserve.`
      );
    }
  }
}

/**
 * Create `<outDir>/<dirName>` and return its path, guaranteeing the write
 * target is a real directory contained in outDir — never a path-traversing
 * name and never a symlink that would redirect the write elsewhere.
 */
export function prepareSkillDirectory(outDir, dirName) {
  if (!SKILL_DIR_NAME_PATTERN.test(dirName)) {
    throw new Error(`Refusing to generate: unsafe skill directory name ${JSON.stringify(dirName)}`);
  }
  const skillDir = join(outDir, dirName);
  mkdirSync(skillDir, { recursive: true });
  if (!lstatSync(skillDir).isDirectory()) {
    throw new Error(`Refusing to write through ${skillDir}: not a real directory.`);
  }
  return skillDir;
}
