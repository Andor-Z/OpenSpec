import path from 'path';
import { FileSystemUtils } from './file-system.js';
import { writeChangeMetadata, validateSchemaName } from './change-metadata.js';
import { formatLocalDate } from './date.js';
import { readProjectConfig } from '../core/project-config.js';
import { resolveSchema } from '../core/artifact-graph/resolver.js';
import { isSpecsArtifactPath } from '../core/artifact-graph/outputs.js';
import type { ChangeMetadata } from '../core/change-metadata/index.js';

const DEFAULT_SCHEMA = 'spec-driven';

/**
 * Change-name-specific grammar. Independent of the shared kebab id grammar in
 * `src/core/id.ts` (which store/initiative/workset ids keep using): the
 * character set is the union of Han script characters with lowercase letters
 * and digits, segmented by single hyphens. The union — not a replacement —
 * keeps numeric prefixes (`100-add-feature`) and archive-date prefixed forms
 * (`2026-01-02-修复会话过期`) valid. The `u` flag is required for the
 * `\p{...}` Unicode property escapes.
 */
const CHANGE_NAME_PATTERN = /^[\p{Script=Han}a-z0-9]+(?:-[\p{Script=Han}a-z0-9]+)*$/u;

/** UTF-8 byte cap for a change name (see validateChangeName). */
const CHANGE_NAME_MAX_UTF8_BYTES = 220;

/**
 * Options for creating a change.
 */
export interface CreateChangeOptions {
  /** The workflow schema to use (default: 'spec-driven') */
  schema?: string;
  /** Default schema to use when no explicit schema or project config is present */
  defaultSchema?: string;
  /** Directory that should contain the change directories */
  changesDir?: string;
  /** Additional metadata to persist in the change's .openspec.yaml */
  metadata?: Partial<Pick<ChangeMetadata, 'goal' | 'affected_areas' | 'initiative'>>;
}

/**
 * Result of creating a change.
 */
export interface CreateChangeResult {
  /** The schema that was actually used (resolved from options, config, or default) */
  schema: string;
  /** Absolute path to the created change directory */
  changeDir: string;
}

/**
 * Result of validating a change name.
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates that a change name follows the change-name grammar.
 *
 * Change names use their own grammar — not the shared kebab id grammar in
 * `src/core/id.ts`, which store/initiative/workset ids keep using — so a
 * change name may:
 * - Contain Chinese characters (Han script), lowercase letters, and numbers
 * - Be segmented by single hyphens
 * - Not start or end with a hyphen
 * - Not contain consecutive hyphens
 *
 * The union character set keeps English kebab names valid (the naming
 * discipline is "prefer Chinese", not "ban English") alongside numeric
 * prefixes like `100-add-feature` and archive-date prefixed forms like
 * `2026-01-02-修复会话过期`.
 *
 * The length cap counts UTF-8 bytes, not characters: Chinese characters
 * take 3 bytes each, and the filesystem directory component cap is 255
 * bytes. Bounding here turns the failure into a validation message
 * instead of a raw ENAMETOOLONG from mkdir.
 *
 * @param name - The change name to validate
 * @returns Validation result with `valid: true` or `valid: false` with an error message
 *
 * @example
 * validateChangeName('add-auth') // { valid: true }
 * validateChangeName('修复会话过期') // { valid: true }
 * validateChangeName('100-add-feature') // { valid: true }
 * validateChangeName('Fix_Session') // { valid: false, error: '...' }
 */
export function validateChangeName(name: string): ValidationResult {
  if (!name) {
    return { valid: false, error: 'Change name cannot be empty' };
  }

  // Filesystem directory components cap at 255 bytes and archive prepends an
  // 11-byte `YYYY-MM-DD-` date prefix (255 - 11 = 244); the remaining
  // headroom guards against deep directory nesting (the Windows 260-char
  // total-path limit makes that more sensitive). The cap is UTF-8 bytes —
  // not characters — because Chinese characters take 3 bytes each, so a
  // character-based cap would let oversized Chinese names reach mkdir and
  // die with a raw ENAMETOOLONG. 220 bytes ≈ 73 Chinese characters or
  // 220 ASCII characters.
  if (Buffer.byteLength(name, 'utf8') > CHANGE_NAME_MAX_UTF8_BYTES) {
    return {
      valid: false,
      error: 'Change name is too long (max 220 UTF-8 bytes; Chinese characters take 3 bytes each)'
    };
  }

  if (!CHANGE_NAME_PATTERN.test(name)) {
    // Provide specific error messages for common mistakes. These checks are
    // language-agnostic and fire for Chinese names too (e.g. `修复-Session`).
    // The underscore check runs before the uppercase check so mixed
    // violations like `Fix_Session` surface the fixable separator mistake.
    if (/_/.test(name)) {
      return { valid: false, error: 'Change name cannot contain underscores (use hyphens instead)' };
    }
    if (/[A-Z]/.test(name)) {
      return { valid: false, error: 'Change name must be lowercase' };
    }
    if (/\s/.test(name)) {
      return { valid: false, error: 'Change name cannot contain spaces (use hyphens instead)' };
    }
    if (name.startsWith('-')) {
      return { valid: false, error: 'Change name cannot start with a hyphen' };
    }
    if (name.endsWith('-')) {
      return { valid: false, error: 'Change name cannot end with a hyphen' };
    }
    if (/--/.test(name)) {
      return { valid: false, error: 'Change name cannot contain consecutive hyphens' };
    }
    if (/[^\p{Script=Han}a-z0-9-]/u.test(name)) {
      return {
        valid: false,
        error: 'Change name can only contain Chinese characters, lowercase letters, numbers, and hyphens'
      };
    }

    return {
      valid: false,
      error: 'Change name must use Chinese characters, lowercase letters, numbers, and single hyphen separators (e.g., add-auth, 修复会话过期)'
    };
  }

  return { valid: true };
}

/**
 * Creates a new change directory with metadata file.
 *
 * @param projectRoot - The root directory of the project (where `openspec/` lives)
 * @param name - The change name (must satisfy validateChangeName: Chinese characters, lowercase letters, numbers, and hyphens)
 * @param options - Optional settings for the change
 * @throws Error if the change name is invalid
 * @throws Error if the schema name is invalid
 * @throws Error if the change directory already exists
 *
 * @returns Result containing the resolved schema name
 *
 * @example
 * // Creates openspec/changes/add-auth/ with default schema
 * const result = await createChange('/path/to/project', 'add-auth')
 * console.log(result.schema) // 'spec-driven' or value from config
 *
 * @example
 * // Creates openspec/changes/add-auth/ with custom schema
 * const result = await createChange('/path/to/project', 'add-auth', { schema: 'my-workflow' })
 * console.log(result.schema) // 'my-workflow'
 */
export async function createChange(
  projectRoot: string,
  name: string,
  options: CreateChangeOptions = {}
): Promise<CreateChangeResult> {
  // Validate the name first
  const validation = validateChangeName(name);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const defaultSchema = options.defaultSchema ?? DEFAULT_SCHEMA;

  // Determine schema: explicit option → project config → supplied default
  let schemaName: string;
  if (options.schema) {
    schemaName = options.schema;
  } else {
    // Try to read from project config
    try {
      const config = readProjectConfig(projectRoot);
      schemaName = config?.schema ?? defaultSchema;
    } catch {
      // If config read fails, use default
      schemaName = defaultSchema;
    }
  }

  // Validate the resolved schema
  validateSchemaName(schemaName, projectRoot);

  // Build the change directory path
  const changeDir = path.join(options.changesDir ?? path.join(projectRoot, 'openspec', 'changes'), name);

  // Check if change already exists
  if (await FileSystemUtils.directoryExists(changeDir)) {
    throw new Error(`Change '${name}' already exists at ${changeDir}`);
  }

  const schema = resolveSchema(schemaName, projectRoot);
  const skipsSpecs = !schema.artifacts.some(artifact =>
    isSpecsArtifactPath(artifact.generates)
  );

  // Creating a change may scaffold or complete the root itself (an
  // implicit root, or a config-only/incomplete clone). Never leave a
  // half-root behind that doctor immediately calls unhealthy: ensure
  // specs/ and changes/archive/ exist, and write a config only when
  // none exists. The config records the PROJECT default schema, never
  // a one-change --schema override.
  const openspecDir = path.join(projectRoot, 'openspec');

  // Create the directory (including parent directories if needed)
  await FileSystemUtils.createDirectory(changeDir);
  await FileSystemUtils.createDirectory(path.join(openspecDir, 'specs'));
  await FileSystemUtils.createDirectory(path.join(openspecDir, 'changes', 'archive'));
  const configPath = path.join(openspecDir, 'config.yaml');
  const configYmlPath = path.join(openspecDir, 'config.yml');
  if (
    !(await FileSystemUtils.fileExists(configPath)) &&
    !(await FileSystemUtils.fileExists(configYmlPath))
  ) {
    await FileSystemUtils.writeFile(configPath, `schema: ${defaultSchema}\n`);
  }

  // Write metadata file with schema and creation date
  writeChangeMetadata(changeDir, {
    schema: schemaName,
    created: formatLocalDate(),
    ...(skipsSpecs ? { skip_specs: true } : {}),
    ...options.metadata,
  }, projectRoot);

  return { schema: schemaName, changeDir };
}
