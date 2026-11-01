## ADDED Requirements

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
