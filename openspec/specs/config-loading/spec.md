# config-loading Specification

## Purpose
Define how `openspec/config.yaml` is discovered, parsed, validated, and exposed to callers with safe fallbacks.

## Requirements

### Requirement: Load project config from openspec/config.yaml

The system SHALL read and parse the project configuration file located at `openspec/config.yaml` relative to the project root.

#### Scenario: Valid config file exists
- **WHEN** `openspec/config.yaml` exists with valid YAML content
- **THEN** system parses the file and returns a ProjectConfig object

#### Scenario: Config file does not exist
- **WHEN** `openspec/config.yaml` does not exist
- **THEN** system returns null without error

#### Scenario: Config file has invalid YAML syntax
- **WHEN** `openspec/config.yaml` contains malformed YAML
- **THEN** system logs a warning message and returns null

#### Scenario: Config file has valid YAML but invalid schema
- **WHEN** `openspec/config.yaml` contains valid YAML that fails Zod schema validation
- **THEN** system logs a warning message with validation details and returns null

### Requirement: Support .yml file extension alias

The system SHALL accept both `.yaml` and `.yml` file extensions for the config file.

#### Scenario: Config file uses .yml extension
- **WHEN** `openspec/config.yml` exists and `openspec/config.yaml` does not exist
- **THEN** system reads from `openspec/config.yml`

#### Scenario: Both .yaml and .yml exist
- **WHEN** both `openspec/config.yaml` and `openspec/config.yml` exist
- **THEN** system prefers `openspec/config.yaml`

### Requirement: Use resilient field-by-field parsing

The system SHALL parse each config field independently, collecting valid fields and warning about invalid ones without rejecting the entire config.

#### Scenario: Schema field is valid
- **WHEN** config contains `schema: "spec-driven"`
- **THEN** schema field is included in returned config

#### Scenario: Schema field is missing
- **WHEN** config lacks the `schema` field
- **THEN** no warning is logged (field is optional at parse level)

#### Scenario: Schema field is empty string
- **WHEN** config contains `schema: ""`
- **THEN** warning is logged and schema field is not included in returned config

#### Scenario: Schema field is invalid type
- **WHEN** config contains `schema: 123` (number instead of string)
- **THEN** warning is logged and schema field is not included in returned config

#### Scenario: Context field is valid
- **WHEN** config contains `context: "Tech stack: TypeScript"`
- **THEN** context field is included in returned config

#### Scenario: Context field is invalid type
- **WHEN** config contains `context: 123` (number instead of string)
- **THEN** warning is logged and context field is not included in returned config

#### Scenario: Rules field has valid structure
- **WHEN** config contains `rules: { proposal: ["Rule 1"], specs: ["Rule 2"] }`
- **THEN** rules field is included in returned config with valid rules

#### Scenario: Rules field has non-array value for artifact
- **WHEN** config contains `rules: { proposal: "not an array", specs: ["Valid"] }`
- **THEN** warning is logged for proposal, but specs rules are still included in returned config

#### Scenario: Rules array contains non-string elements
- **WHEN** config contains `rules: { proposal: ["Valid rule", 123, ""] }`
- **THEN** only "Valid rule" is included, warning logged about invalid elements

#### Scenario: Mix of valid and invalid fields
- **WHEN** config contains valid schema, invalid context type, valid rules
- **THEN** config is returned with schema and rules fields, warning logged about context

### Requirement: Enforce context size limit

The system SHALL reject context fields exceeding 50KB and log a warning.

#### Scenario: Context within size limit
- **WHEN** config contains context of 1KB
- **THEN** context is included in returned config

#### Scenario: Context at size limit
- **WHEN** config contains context of exactly 50KB
- **THEN** context is included in returned config

#### Scenario: Context exceeds size limit
- **WHEN** config contains context of 51KB
- **THEN** warning is logged with size and limit, context field is not included in returned config

### Requirement: Load operation guidance independently

The system SHALL parse the optional `operations` project-config field independently from `schema`, `context`, `rules`, `references`, and `store` so an invalid operation entry does not discard other valid configuration.

#### Scenario: Valid operation guidance

- **WHEN** config contains `operations.apply.guidance` and `operations.archive.guidance` as arrays of strings
- **THEN** the returned project config includes both operation entries

#### Scenario: One operation is malformed

- **WHEN** apply guidance is a valid string array and archive guidance is malformed
- **THEN** the returned project config includes apply guidance
- **AND** omits archive guidance with an actionable warning

#### Scenario: Operations field is not an object

- **WHEN** config contains a non-object `operations` value
- **THEN** the system warns about the invalid field
- **AND** continues with all independently valid config fields

#### Scenario: Unknown operation ID

- **WHEN** config contains an unsupported operation ID
- **THEN** the system warns with the supported operation IDs
- **AND** ignores only the unsupported operation entry

#### Scenario: Unknown fields in an operation

- **WHEN** a supported operation contains fields other than `guidance`
- **THEN** the system warns about those fields
- **AND** preserves valid guidance for that operation

#### Scenario: Empty and formatted guidance

- **WHEN** a guidance array contains empty strings and non-empty strings with line breaks or Markdown
- **THEN** the system removes the empty entries
- **AND** preserves the non-empty entries in their original order and form

### Requirement: Defer artifact ID validation to instruction loading

The system SHALL NOT validate artifact IDs in rules during config load time. Validation happens during instruction loading when schema is known.

#### Scenario: Config with rules is loaded
- **WHEN** config contains `rules: { unknownartifact: [...] }`
- **THEN** config is loaded successfully without validation errors

#### Scenario: Validation happens at instruction load time
- **WHEN** instructions are loaded for any artifact and config has unknown artifact IDs in rules
- **THEN** warnings are emitted about unknown artifact IDs (see rules-injection spec for details)

### Requirement: Gracefully handle config errors without halting

The system SHALL continue operation with default values when config loading or parsing fails, except in `openspec validate`, which SHALL report the failure and exit with status 1 before checking any item.

#### Scenario: Config parse failure during command execution
- **WHEN** config file has syntax errors and user runs `openspec new change`
- **THEN** command executes using default schema "spec-driven"

#### Scenario: Warning is visible to user
- **WHEN** config loading fails
- **THEN** system outputs warning message to stderr with details about the failure

#### Scenario: Validate fails on a config that is not valid YAML
- **WHEN** config file has syntax errors and user runs `openspec validate`
- **THEN** the command reports `Could not parse` with the config path, validates no items, and exits with status 1
- **AND** with `--json` the failure is a single `status` entry with code `unparseable_config`

#### Scenario: Validate fails on a config that cannot be read
- **WHEN** the config path exists but cannot be read as a file (for example it is a directory) and user runs `openspec validate`
- **THEN** the command reports `Could not read` with the config path, validates no items, and exits with status 1
- **AND** with `--json` the failure is a single `status` entry with code `unreadable_config`

### Requirement: Parse naming section with explicit resilient parsing

项目配置解析 SHALL 显式解析 `openspec/config.yaml` 的可选顶层节 `naming`（当前唯一字段 `changeNameLanguage`，值域 `zh-CN` / `en`）：`naming` 是显式解析字段，MUST NOT 依赖顶层未知键静默忽略的既有行为（否则配置不生效且无提示）。解析失败 SHALL 遵循 resilient field-by-field parsing 语义：警告（未知值警告 MUST 包含支持值清单）、丢弃该字段回退默认值（`zh-CN`）、不影响其他字段、不硬失败。语言别名 SHALL 在解析层归一化（`zh`/`zh-CN` 大小写不敏感归一为 `zh-CN`）后再进入映射表。

#### Scenario: 合法值解析进返回的 config

- **WHEN** config 包含 `naming: { changeNameLanguage: zh-CN }` 或 `naming: { changeNameLanguage: en }`
- **THEN** 返回的 ProjectConfig 包含对应 `naming.changeNameLanguage` 值

#### Scenario: naming 非对象时警告并丢弃

- **WHEN** config 包含 `naming: "zh-CN"`（字符串而非对象）或 `naming: [1, 2]`（数组）
- **THEN** 输出 `Invalid 'naming' field in config (must be an object)` 类警告
- **AND** naming 字段不进入返回的 config，其他字段正常保留

#### Scenario: 字段类型非法时警告并丢弃

- **WHEN** config 包含 `naming: { changeNameLanguage: 123 }`（数字而非字符串）
- **THEN** 输出包含字段名的警告，naming 字段不进入返回的 config
- **AND** 其他字段正常保留

#### Scenario: 未知值警告列出支持值清单

- **WHEN** config 包含 `naming: { changeNameLanguage: fr }`
- **THEN** 警告信息包含该值与支持值清单（形如 `Invalid 'naming.changeNameLanguage' value 'fr'. Supported: zh-CN, en`）
- **AND** naming 字段被丢弃，消费方回退默认 zh-CN，不硬失败

#### Scenario: 缺失 naming 节时静默回退

- **WHEN** config 不包含 `naming` 节
- **THEN** 不输出 naming 相关警告，naming 不进入返回的 config
- **AND** 消费方按内置默认 zh-CN 处理

#### Scenario: 语言别名归一化

- **WHEN** config 包含 `naming: { changeNameLanguage: zh }` 或 `ZH-cn`（大小写不敏感）
- **THEN** 解析结果归一化为映射表键 `zh-CN` 后供消费方使用
