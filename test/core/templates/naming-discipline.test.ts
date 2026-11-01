import { describe, expect, it } from 'vitest';

import { NAMING_DISCIPLINE } from '../../../src/core/templates/workflows/naming-discipline.js';
import { PROJECT_ROOT_GUARD } from '../../../src/core/templates/workflows/project-root.js';
import { STORE_SELECTION_GUIDANCE } from '../../../src/core/templates/workflows/store-selection.js';
import { getApplyInstructions } from '../../../src/core/templates/skill-templates.js';
import {
  generateSkillContent,
  getCommandContents,
  getSkillTemplates,
} from '../../../src/core/shared/skill-generation.js';

/**
 * Regression coverage for naming-discipline-injection: the shared
 * NAMING_DISCIPLINE constant is injected into the skill face of the four
 * change-creating workflows and into apply's shared body (both surfaces),
 * while the propose/new/ff command faces stay upstream-verbatim — an English
 * kebab name derived there still passes validation, so the asymmetry is a
 * graceful degradation, not a ban.
 */
describe('naming discipline injection', () => {
  function renderedSkill(dirName: string): string {
    const entry = getSkillTemplates().find(({ dirName: name }) => name === dirName);
    expect(entry, dirName).toBeDefined();
    return generateSkillContent(entry!.template, 'PARITY-BASELINE');
  }

  function renderedCommand(id: string): string {
    const entry = getCommandContents().find(({ id: name }) => name === id);
    expect(entry, id).toBeDefined();
    return entry!.body;
  }

  it('teaches both directory disciplines with motivation and examples', () => {
    // Two disciplines: change directory names and capability directory names.
    expect(NAMING_DISCIPLINE).toContain('change 目录名');
    expect(NAMING_DISCIPLINE).toContain('capability');
    // Motivation: names are self-documenting once specs accumulate.
    expect(NAMING_DISCIPLINE).toContain('自解释');
    expect(NAMING_DISCIPLINE).toContain('几百个');
    // Valid and invalid examples.
    expect(NAMING_DISCIPLINE).toContain('修复会话过期');
    expect(NAMING_DISCIPLINE).toContain('Fix_Session');
    // "Prefer Chinese", never "ban English": kebab names remain legal.
    expect(NAMING_DISCIPLINE).toContain('优先中文');
    expect(NAMING_DISCIPLINE).toContain('不是「禁止英文」');
    expect(NAMING_DISCIPLINE).toContain('依然合法');
    // RFC 2119 keywords stay English in artifact bodies.
    expect(NAMING_DISCIPLINE).toContain('SHALL');
    expect(NAMING_DISCIPLINE).toContain('MUST');
    expect(NAMING_DISCIPLINE).toContain('RFC 2119');
  });

  it('injects the discipline into every change-creating skill face', () => {
    for (const dirName of [
      'openspec-propose',
      'openspec-new-change',
      'openspec-ff-change',
      'openspec-onboard',
    ]) {
      expect(renderedSkill(dirName), dirName).toContain(NAMING_DISCIPLINE);
    }
  });

  it('carries the discipline on both apply surfaces from the shared body', () => {
    expect(getApplyInstructions()).toContain(NAMING_DISCIPLINE);
    expect(renderedSkill('openspec-apply-change')).toContain(NAMING_DISCIPLINE);
    expect(renderedCommand('apply')).toContain(NAMING_DISCIPLINE);
  });

  it('keeps the propose/new/ff command faces upstream-verbatim', () => {
    for (const id of ['propose', 'new', 'ff']) {
      const body = renderedCommand(id);
      expect(body, id).not.toContain(NAMING_DISCIPLINE);
      // The asymmetry contract: the original kebab wording survives untouched,
      // so a command-driven flow still derives a legal English name.
      expect(body, id).toContain('derive a kebab-case name');
      expect(body, id).toContain('(kebab-case)');
    }
  });

  it('leaves no contradictory kebab naming instruction on the skill faces', () => {
    for (const dirName of [
      'openspec-propose',
      'openspec-new-change',
      'openspec-ff-change',
      'openspec-onboard',
    ]) {
      const body = renderedSkill(dirName);
      expect(body, dirName).not.toContain('derive a kebab-case name');
      expect(body, dirName).not.toContain('(kebab-case)');
    }
  });

  it('sits directly under the project root guard in every injected surface', () => {
    // Same header position contract as the other shared guidance blocks:
    // store selection, then the root guard, then the discipline.
    const bodies: Array<[string, string]> = [
      ['skill propose', renderedSkill('openspec-propose')],
      ['skill new', renderedSkill('openspec-new-change')],
      ['skill ff', renderedSkill('openspec-ff-change')],
      ['skill onboard', renderedSkill('openspec-onboard')],
      ['skill apply', renderedSkill('openspec-apply-change')],
      ['command apply', renderedCommand('apply')],
    ];
    for (const [label, body] of bodies) {
      const guardStart = body.indexOf(PROJECT_ROOT_GUARD);
      expect(guardStart, label).toBeGreaterThanOrEqual(0);
      const disciplineStart = body.indexOf(NAMING_DISCIPLINE);
      expect(disciplineStart, label).toBe(
        guardStart + PROJECT_ROOT_GUARD.length + '\n\n'.length
      );
    }
  });

  it('never leaks the discipline into the optionalWorkflow handoff tokens', () => {
    // The handoff sentences interpolate optionalWorkflow results, never the
    // discipline; pin the boundary the other way: the discipline appears
    // exactly once per injected skill body, at the pinned position above.
    for (const dirName of [
      'openspec-propose',
      'openspec-new-change',
      'openspec-ff-change',
      'openspec-onboard',
      'openspec-apply-change',
    ]) {
      const body = renderedSkill(dirName);
      expect(body.split(NAMING_DISCIPLINE).length - 1, dirName).toBe(1);
    }
  });

  it('does not reach the surfaces that carry neither registry', () => {
    // Feedback ships outside both guidance registries (see
    // project-root-guard.test.ts); it must not inherit the discipline either.
    const entry = getSkillTemplates().find(({ dirName }) => dirName === 'openspec-feedback');
    if (entry) {
      expect(entry.template.instructions).not.toContain(NAMING_DISCIPLINE);
    }
  });
});
