# global-config Specification

## Purpose

This spec defines how OpenSpec resolves, reads, and writes user-level global configuration. It governs the `src/core/global-config.ts` module, which provides the foundation for storing user preferences, feature flags, and settings that persist across projects. The spec ensures cross-platform compatibility by following XDG Base Directory Specification with platform-specific fallbacks, and guarantees forward/backward compatibility through schema evolution rules.

## Requirements

### Requirement: Global configuration storage
The system SHALL store global configuration in `~/.config/openspec/config.json`, including telemetry state with `anonymousId` and `noticeSeen` fields.

#### Scenario: Initial config creation
- **WHEN** no global config file exists
- **AND** the first telemetry event is about to be sent
- **THEN** the system creates `~/.config/openspec/config.json` with telemetry configuration

#### Scenario: Telemetry config structure
- **WHEN** reading or writing telemetry configuration
- **THEN** the config contains a `telemetry` object with `anonymousId` (string UUID) and `noticeSeen` (boolean) fields

#### Scenario: Config file format
- **WHEN** storing configuration
- **THEN** the system writes valid JSON that can be read and modified by users

#### Scenario: Existing config preservation
- **WHEN** adding telemetry fields to an existing config file
- **THEN** the system preserves all existing configuration fields

### Requirement: Global Config Directory Path

The system SHALL resolve the global configuration directory path following XDG Base Directory Specification with platform-specific fallbacks.

#### Scenario: Unix/macOS with XDG_CONFIG_HOME set
- **WHEN** `$XDG_CONFIG_HOME` environment variable is set to `/custom/config`
- **THEN** `getGlobalConfigDir()` returns `/custom/config/openspec`

#### Scenario: Unix/macOS without XDG_CONFIG_HOME
- **WHEN** `$XDG_CONFIG_HOME` environment variable is not set
- **AND** the platform is Unix or macOS
- **THEN** `getGlobalConfigDir()` returns `~/.config/openspec` (expanded to absolute path)

#### Scenario: Windows platform
- **WHEN** the platform is Windows
- **AND** `%APPDATA%` is set to `C:\Users\User\AppData\Roaming`
- **THEN** `getGlobalConfigDir()` returns `C:\Users\User\AppData\Roaming\openspec`

### Requirement: Global Config Loading

The system SHALL load global configuration from the config directory with sensible defaults when the config file does not exist or cannot be parsed.

#### Scenario: Config file exists and is valid
- **WHEN** `config.json` exists in the global config directory
- **AND** the file contains valid JSON matching the config schema
- **THEN** `getGlobalConfig()` returns the parsed configuration

#### Scenario: Config file does not exist
- **WHEN** `config.json` does not exist in the global config directory
- **THEN** `getGlobalConfig()` returns the default configuration
- **AND** no directory or file is created

#### Scenario: Config file is invalid JSON
- **WHEN** `config.json` exists but contains invalid JSON
- **THEN** `getGlobalConfig()` returns the default configuration
- **AND** a warning is logged to stderr

### Requirement: Global Config Saving

The system SHALL save global configuration to the config directory, creating the directory if it does not exist.

#### Scenario: Save config to new directory
- **WHEN** `saveGlobalConfig(config)` is called
- **AND** the global config directory does not exist
- **THEN** the directory is created
- **AND** `config.json` is written with the provided configuration

#### Scenario: Save config to existing directory
- **WHEN** `saveGlobalConfig(config)` is called
- **AND** the global config directory already exists
- **THEN** `config.json` is written (overwriting if exists)

### Requirement: Default Configuration

The system SHALL provide a default configuration that is used when no config file exists.

#### Scenario: Default config structure
- **WHEN** no config file exists
- **THEN** the default configuration includes an empty `featureFlags` object

### Requirement: Config Schema Evolution

The system SHALL merge loaded configuration with default values to ensure new config fields are available even when loading older config files.

#### Scenario: Config file missing new fields
- **WHEN** `config.json` exists with `{ "featureFlags": {} }`
- **AND** the current schema includes a new field `defaultAiTool`
- **THEN** `getGlobalConfig()` returns `{ featureFlags: {}, defaultAiTool: <default> }`
- **AND** the loaded values take precedence over defaults for fields that exist in both

#### Scenario: Config file has extra unknown fields
- **WHEN** `config.json` contains fields not in the current schema
- **THEN** the unknown fields are preserved in the returned configuration
- **AND** no error or warning is raised

### Requirement: Global naming language fallback

全局配置（`~/.config/openspec/config.json`，JSON 格式）SHALL 支持可选 `naming.changeNameLanguage` 字段，语义为 machine-level fallback：仅当项目配置未提供 `naming.changeNameLanguage` 时生效，项目配置 MUST 永远优先（全局永不 override 项目，与 `defaultStore` 的 fallback 语义一致）。`openspec config` SHALL 支持 `naming.changeNameLanguage` 点分键的 `get`/`set`/`unset`：`set` SHALL 在写入前校验值域（未知值拒绝并列出支持值清单，不写文件）；键路径登记 SHALL 在 `KNOWN_TOP_LEVEL_KEYS` 白名单与嵌套键分支两处完成，且仅允许 `naming.changeNameLanguage` 一个嵌套键；`--allow-unknown` 逃生口语义保持不变。

#### Scenario: 全局值在项目未配置时生效

- **GIVEN** 全局 config.json 配置 `naming.changeNameLanguage: en`，项目 config.yaml 未配置 `naming` 节
- **WHEN** 项目内创建变更时解析命名语言
- **THEN** 采用全局值 `en`

#### Scenario: 项目配置优先于全局（永不 override）

- **GIVEN** 项目 config.yaml 配置 `naming.changeNameLanguage: zh-CN`，全局 config.json 配置 `naming.changeNameLanguage: en`
- **WHEN** 项目内创建变更时解析命名语言
- **THEN** 采用项目值 `zh-CN`
- **AND** 全局值不被读取为生效值，也不被任何流程改写

#### Scenario: set 合法值写入全局 config.json

- **WHEN** 运行 `openspec config set naming.changeNameLanguage en`
- **THEN** 全局 config.json 的 `naming` 节写入 `changeNameLanguage: en`
- **AND** config.json 中既有其他字段全部保留

#### Scenario: set 未知值被拒绝且不写文件

- **WHEN** 运行 `openspec config set naming.changeNameLanguage fr`
- **THEN** 命令报错并列出支持值清单（`zh-CN`、`en`），全局 config.json 保持原样未写入

#### Scenario: get 输出当前值

- **WHEN** 运行 `openspec config get naming.changeNameLanguage` 且全局已设置该键
- **THEN** 输出当前设置值

#### Scenario: unset 清除全局值

- **WHEN** 运行 `openspec config unset naming.changeNameLanguage` 且全局已设置该键
- **THEN** 该键从全局 config.json 移除，命名语言回退到项目配置或内置默认

#### Scenario: 全局配置不可用时独立降级

- **GIVEN** 全局 config.json 不存在或不可解析
- **WHEN** 项目未配置 `naming` 节时解析命名语言
- **THEN** 按既有全局配置降级语义回退默认值，命名语言取内置默认 `zh-CN`
- **AND** 不因全局 naming 缺失而阻断创建流程
