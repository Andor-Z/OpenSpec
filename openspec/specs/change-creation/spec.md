# change-creation Specification

## Purpose
Provide programmatic utilities for creating and validating OpenSpec change directories.

## Requirements

### Requirement: Change Creation
The system SHALL provide a function to create new change directories programmatically.

#### Scenario: Create change
- **WHEN** `createChange(projectRoot, 'add-auth')` is called
- **THEN** the system creates `openspec/changes/add-auth/` directory

#### Scenario: Duplicate change rejected
- **WHEN** `createChange(projectRoot, 'add-auth')` is called and `openspec/changes/add-auth/` already exists
- **THEN** the system throws an error indicating the change already exists

#### Scenario: Creates parent directories if needed
- **WHEN** `createChange(projectRoot, 'add-auth')` is called and `openspec/changes/` does not exist
- **THEN** the system creates the full path including parent directories

#### Scenario: Invalid change name rejected
- **WHEN** `createChange(projectRoot, 'Add Auth')` is called with an invalid name
- **THEN** the system throws a validation error

### Requirement: Change Name Validation
Change 名校验 SHALL 由命名语言配置驱动：语言键取两级配置 `naming.changeNameLanguage`，precedence 为项目 `openspec/config.yaml` > 全局 `~/.config/openspec/config.json` > 内置默认 `zh-CN`（全局为 machine-level fallback，永不 override 项目配置）。字符集 SHALL 从映射表（`CHARSET_MAP`）经 `buildChangeNamePattern(language)` 动态构建（含缓存）：任何语言下正则保持「映射字符类与小写字母、数字的并集 + 连字符分段」结构（`/^[<字符类>a-z0-9]+(?:-[<字符类>a-z0-9]+)*$/u`，`u` 标志必须启用）——数字前缀名与归档日期前缀形态在所有支持语言下均合法。zh-CN 字符类为 `\p{Script=Han}`（汉字与小写字母、数字混排合法）；en 为空增量即纯 kebab（等价上游行为）；未知语言值由配置解析层警告（列出支持值清单）并回退默认 zh-CN。长度校验 SHALL 按 UTF-8 字节执行且全语言统一：`Buffer.byteLength(name, 'utf8')` 不超过 220 字节，超限错误信息 MUST 说明字节语义（中文每字占 3 字节）。校验函数 SHALL 接受可选 language 参数，由调用方解析配置后传入，不传时按默认 zh-CN 行为。store/initiative/workset 等内部 id 的共享 kebab 语法源与 workflow schema 名的独立校验（首段必须字母开头）MUST NOT 受命名语言配置影响。

#### Scenario: 纯中文 change 名通过
- **GIVEN** 项目 config.yaml 与全局 config.json 均未配置 `naming.changeNameLanguage`
- **WHEN** 校验 change 名 `修复会话过期`
- **THEN** 返回 `{ valid: true }`（内置默认语言为 zh-CN）

#### Scenario: Valid kebab-case name accepted
- **WHEN** 校验 change 名 `add-user-auth`（默认语言 zh-CN）
- **THEN** 返回 `{ valid: true }`（并集字符集包含小写字母与数字）

#### Scenario: en 语言下英数 kebab 通过
- **GIVEN** `naming.changeNameLanguage` 解析为 `en`
- **WHEN** 校验 change 名 `add-user-auth`
- **THEN** 返回 `{ valid: true }`（en 为纯 kebab，等价上游行为）

#### Scenario: en 语言下中文名拒绝
- **GIVEN** `naming.changeNameLanguage` 解析为 `en`
- **WHEN** 校验 change 名 `修复会话过期`
- **THEN** 返回 `{ valid: false }`，错误信息说明该语言下仅允许小写字母、数字与连字符

#### Scenario: Numeric suffixes accepted
- **WHEN** 校验 change 名 `add-feature-2`（zh-CN 与 en 下分别校验）
- **THEN** 均返回 `{ valid: true }`

#### Scenario: Single word accepted
- **WHEN** 校验 change 名 `refactor`（zh-CN 与 en 下分别校验）
- **THEN** 均返回 `{ valid: true }`

#### Scenario: 数字前缀加中文通过
- **WHEN** 校验 change 名 `100-修复登录`
- **THEN** 返回 `{ valid: true }`（并集结构保住编号前缀排序习惯）

#### Scenario: 中英混合段通过
- **WHEN** 校验 change 名 `修复-session-timeout`
- **THEN** zh-CN 下返回 `{ valid: true }`（汉字与英数混排合法）
- **AND** en 下返回 `{ valid: false }`（汉字不在 en 字符集内）

#### Scenario: 归档日期前缀形态通过
- **WHEN** 校验 change 名 `2026-01-02-修复会话过期`（zh-CN）或 `2026-01-02-fix-login`（en）
- **THEN** 均返回 `{ valid: true }`（归档拼接 `YYYY-MM-DD-<名>` 的形态不破坏任何语言的正则结构）

#### Scenario: Uppercase characters rejected
- **WHEN** 校验 change 名 `Add-Auth`（zh-CN 与 en 下分别校验）
- **THEN** 均返回 `{ valid: false }`，错误信息说明必须使用小写字母

#### Scenario: Spaces rejected
- **WHEN** 校验 change 名 `add auth` 或 `修复 会话过期`
- **THEN** 均返回 `{ valid: false }`，错误信息说明空格应改用连字符

#### Scenario: Underscores rejected
- **WHEN** 校验 change 名 `add_auth` 或 `Fix_Session`
- **THEN** 均返回 `{ valid: false }`，错误信息说明下划线应改用连字符

#### Scenario: Special characters rejected
- **WHEN** 校验 change 名 `add-auth!`
- **THEN** 均返回 `{ valid: false }`，错误信息说明该语言允许的字符集

#### Scenario: Leading hyphen rejected
- **WHEN** 校验 change 名 `-add-auth`
- **THEN** 均返回 `{ valid: false }`，错误信息说明不能以连字符开头

#### Scenario: Trailing hyphen rejected
- **WHEN** 校验 change 名 `add-auth-`
- **THEN** 均返回 `{ valid: false }`，错误信息说明不能以连字符结尾

#### Scenario: Consecutive hyphens rejected
- **WHEN** 校验 change 名 `add--auth` 或 `修复--会话`
- **THEN** 均返回 `{ valid: false }`，错误信息说明不能包含连续连字符

#### Scenario: 全角字符拒绝
- **WHEN** 校验 change 名 `ＡＢＣ`（全角字母，属 `Script=Common`，不在任何语言的映射字符类内）
- **THEN** 均返回 `{ valid: false }`，错误信息说明该语言允许的字符集

#### Scenario: 字节上限内通过
- **WHEN** 校验 73 个汉字组成的 change 名（UTF-8 编码 219 字节）
- **THEN** 返回 `{ valid: true }`

#### Scenario: 字节上限超限拒绝
- **WHEN** 校验 74 个汉字组成的 change 名（UTF-8 编码 222 字节，超过 220 字节上限）
- **THEN** 返回 `{ valid: false }`，错误信息说明按 UTF-8 字节计（中文每字 3 字节）与 220 字节上限

#### Scenario: 字节上限全语言统一
- **GIVEN** `naming.changeNameLanguage` 解析为 `en`
- **WHEN** 校验 221 个 ASCII 字符组成的 change 名（221 字节超过 220 字节上限）
- **THEN** 返回 `{ valid: false }`，错误信息说明字节语义（字节上限不随语言变化）

#### Scenario: 项目配置覆盖全局
- **GIVEN** 项目 config.yaml 配置 `naming.changeNameLanguage: zh-CN`，全局 config.json 配置 `naming.changeNameLanguage: en`
- **WHEN** 校验 change 名 `修复会话过期`
- **THEN** 按项目配置 zh-CN 判定，返回 `{ valid: true }`（全局永不 override 项目配置）

#### Scenario: 全局 fallback 生效
- **GIVEN** 项目 config.yaml 未配置 `naming` 节，全局 config.json 配置 `naming.changeNameLanguage: en`
- **WHEN** 校验 change 名 `修复会话过期`
- **THEN** 按全局配置 en 判定，返回 `{ valid: false }`（全局在项目未配置时生效）

#### Scenario: 未知语言值警告并回退默认
- **GIVEN** `naming.changeNameLanguage` 配置为不支持值（如 `fr`）
- **WHEN** 解析命名语言并校验 change 名
- **THEN** 配置解析层输出警告，警告信息包含支持值清单（`zh-CN`、`en`）
- **AND** 该字段被丢弃，命名语言回退默认 zh-CN，校验按 zh-CN 字符集执行

### Requirement: Local Creation Date Metadata

The system SHALL record the `created` value in metadata for a newly created change as the `YYYY-MM-DD` calendar date in the effective local time zone of the Node.js process executing the CLI.

#### Scenario: Create change across a UTC date boundary

- **GIVEN** the CLI process's effective local time zone is `Asia/Shanghai`
- **AND** the current instant is `2026-07-14T16:30:00.000Z`
- **WHEN** the user creates a change
- **THEN** the new change's `.openspec.yaml` contains `created: 2026-07-15`
