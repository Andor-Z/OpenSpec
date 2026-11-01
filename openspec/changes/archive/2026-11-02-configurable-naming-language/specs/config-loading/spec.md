## ADDED Requirements

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
