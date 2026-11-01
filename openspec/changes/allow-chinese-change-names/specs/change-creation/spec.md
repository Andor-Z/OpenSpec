## MODIFIED Requirements

### Requirement: Change Name Validation
Change 名校验 SHALL 使用 change 名专用字符集：汉字（`\p{Script=Han}`）与小写字母、数字的并集 `[\p{Script=Han}a-z0-9]`，以连字符分段（`/^[\p{Script=Han}a-z0-9]+(?:-[\p{Script=Han}a-z0-9]+)*$/u`；`u` 标志必须启用，`\p` 属性转义依赖它）。并集语义保证数字前缀名（如 `100-add-feature`）与归档日期前缀形态（如 `2026-01-02-修复会话过期`）在放宽后仍然合法。长度校验 SHALL 按 UTF-8 字节执行：`Buffer.byteLength(name, 'utf8')` 不超过 220 字节（文件系统目录组件 255 字节上限，扣除归档日期前缀 11 字节与安全余量），超限错误信息 MUST 说明字节语义（中文每字占 3 字节）。校验失败文案 SHALL 说明 change 名允许中文、小写字母、数字与连字符。store/initiative/workset 等内部 id 的共享 kebab 语法源（`isKebabId`/`KEBAB_ID_REGEX`）及其错误文案 MUST NOT 因本 requirement 改动；workflow schema 名的独立校验（首段必须字母开头）保持不变。

#### Scenario: Valid kebab-case name accepted
- **WHEN** 校验 change 名 `add-user-auth`
- **THEN** 返回 `{ valid: true }`（并集字符集包含小写字母与数字，英文 kebab 名依然合法）

#### Scenario: Numeric suffixes accepted
- **WHEN** 校验 change 名 `add-feature-2`
- **THEN** 返回 `{ valid: true }`

#### Scenario: Single word accepted
- **WHEN** 校验 change 名 `refactor`
- **THEN** 返回 `{ valid: true }`

#### Scenario: Uppercase characters rejected
- **WHEN** 校验 change 名 `Add-Auth`
- **THEN** 返回 `{ valid: false }`，错误信息说明必须使用小写字母

#### Scenario: Spaces rejected
- **WHEN** 校验 change 名 `add auth`
- **THEN** 返回 `{ valid: false }`，错误信息说明空格应改用连字符

#### Scenario: Underscores rejected
- **WHEN** 校验 change 名 `add_auth`
- **THEN** 返回 `{ valid: false }`，错误信息说明下划线应改用连字符

#### Scenario: Special characters rejected
- **WHEN** 校验 change 名 `add-auth!`
- **THEN** 返回 `{ valid: false }`，错误信息说明允许字符集（中文、小写字母、数字、连字符）

#### Scenario: Leading hyphen rejected
- **WHEN** 校验 change 名 `-add-auth`
- **THEN** 返回 `{ valid: false }`，错误信息说明不能以连字符开头

#### Scenario: Trailing hyphen rejected
- **WHEN** 校验 change 名 `add-auth-`
- **THEN** 返回 `{ valid: false }`，错误信息说明不能以连字符结尾

#### Scenario: Consecutive hyphens rejected
- **WHEN** 校验 change 名 `add--auth`
- **THEN** 返回 `{ valid: false }`，错误信息说明不能包含连续连字符

#### Scenario: 纯中文 change 名通过
- **WHEN** 校验 change 名 `修复会话过期`
- **THEN** 返回 `{ valid: true }`（`\p{Script=Han}` 命中汉字）

#### Scenario: 数字前缀加中文通过
- **WHEN** 校验 change 名 `100-修复登录`
- **THEN** 返回 `{ valid: true }`（并集字符集保住编号前缀排序习惯）

#### Scenario: 中英混合段通过
- **WHEN** 校验 change 名 `修复-session-timeout`
- **THEN** 返回 `{ valid: true }`（同一分段内汉字与英数混排合法）

#### Scenario: 归档日期前缀形态通过
- **WHEN** 校验 change 名 `2026-01-02-修复会话过期`
- **THEN** 返回 `{ valid: true }`（归档拼接 `YYYY-MM-DD-<名>` 后的形态不破坏正则结构）

#### Scenario: 全角字符拒绝
- **WHEN** 校验 change 名 `ＡＢＣ`（全角字母，属 `Script=Common` 而非 `Script=Han`）
- **THEN** 返回 `{ valid: false }`，错误信息说明允许字符集

#### Scenario: 字节上限内通过
- **WHEN** 校验 73 个汉字组成的 change 名（UTF-8 编码 219 字节）
- **THEN** 返回 `{ valid: true }`

#### Scenario: 字节上限超限拒绝
- **WHEN** 校验 74 个汉字组成的 change 名（UTF-8 编码 222 字节，超过 220 字节上限）
- **THEN** 返回 `{ valid: false }`，错误信息说明按 UTF-8 字节计（中文每字 3 字节）与 220 字节上限，而非字符数
