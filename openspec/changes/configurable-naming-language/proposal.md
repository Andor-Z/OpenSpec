# 命名语言可配置（第二阶段）

> **溯源声明：本变更第二阶段正文为设计补全，非还原稿原文。** 还原稿「第二阶段：命名语言可配置（新方案）」一节正文未拍到（仅 4 条大纲条目入镜：config 加 naming 配置 / 字符集映射表 / 动态正则构建 / config 预填默认值），「两阶段关系」「纪律」两节同样缺失；两级配置 precedence 为用户口头需求。本 proposal 按 4 条大纲 + 用户口头需求 + 探索文档第 4 节补全，设计性质标注为「设计补全，非原文」。

## Why

第一阶段（allow-chinese-change-names）把 change 名校验硬编码为中文并集字符集，引导层纪律文案也写死「优先中文」——中文项目就中文、英文项目就英文，命名语言应是配置而非硬编码。配置分两级：项目级（项目内 `openspec/config.yaml`）与全局级（全局安装时的 `~/.config/openspec/config.json`，**是 JSON 不是 YAML**）。用户预期：「项目没配用全局、配了以项目为准」——即全局是 fallback 永不 override，与仓库既有方向一致（全局 `defaultStore` 注释明言 Machine-level fallback，项目 `store:` 同标注 fallback, never an override，仓库没有任何「全局覆盖项目」先例）。

两阶段关系：第一阶段是第二阶段的特例（zh-CN 写死）；本变更只抽「字符集」与「配置驱动」，校验层的正则结构、字节上限、错误分支结构，以及引导层的注入面、检查层的门语义全部不变。

## What Changes

### 1. config schema：naming 节

项目 `config.yaml` 新增可选顶层节 `naming`（与既有顶层键 `schema/context/rules/operations/references/store/githubCopilot` 无冲突），首字段 `changeNameLanguage`：默认 `zh-CN`（本 fork 魔改默认中文），值域 `zh-CN` / `en`。`readProjectConfig` 对 naming 键做**显式解析**——recon 证据：readProjectConfig 是手工逐字段解析、顶层未知键静默忽略，不显式解析则「配了不生效还无提示」。宽松解析语义保持（与 config-loading「resilient field-by-field parsing」一致）：naming 非对象 / 字段类型非法 / 未知值 → `console.warn`（文案列出支持值清单，如 `Invalid 'naming.changeNameLanguage' value 'xx'. Supported: zh-CN, en`）→ 丢弃该字段回退默认，不影响其他字段、不硬失败。

### 2. 两级配置 precedence

```text
项目 config.yaml naming.changeNameLanguage  >  全局 config.json naming.changeNameLanguage  >  内置默认 zh-CN
```

项目没配 → 用全局；项目配了 → 以项目为准（全局永不 override）。`GlobalConfig` 接口加可选 `naming?: { changeNameLanguage?: string }` 字段（`getGlobalConfig` 的 spread 合并天然透传，读取侧零改动）。解析 helper：`resolveNamingLanguage(projectRoot)`——项目 `readProjectConfig` → 全局 `getGlobalConfig` → `'zh-CN'`。

### 3. openspec config set/get/unset 登记 naming 键

`config get` 走 `getNestedValue` 点分键现成可用（`openspec config get naming.changeNameLanguage` 直接可用）；**`set`/`unset` 不现成**，需 `config-schema.ts` 两处登记（探索裁定 5a）：① `KNOWN_TOP_LEVEL_KEYS` 白名单加 `'naming'`；② 仿 `telemetry` 分支加 `naming` 嵌套键分支——允许且仅允许 `naming.changeNameLanguage` 一个嵌套键，set 时即校验值域（未知值拒绝并列出支持清单，比写进文件再 warn 更早拦）。`--allow-unknown` 逃生口语义保持现状。

### 4. 字符集映射表 + 动态正则构建

新文件 `src/core/naming-grammar.ts`（紧邻 `id.ts`）：`CHARSET_MAP`（zh-CN → 字符类增量 `\p{Script=Han}`；en → 空增量即纯 `[a-z0-9]` 等价上游行为；结构预留其他语言扩展键，新语言 = 加一个键不改消费方）+ `buildChangeNamePattern(language)` 纯函数（进程级 Map 缓存；并集规则与连字符分段结构、`u` 标志在构建函数内固化，映射表只贡献字符类增量——任何语言下编号前缀 `100-add-feature` 与归档日期前缀形态 `2026-01-02-中文` 都合法）。未知映射表键由配置解析层拦（值域校验），构建函数对未知键 throw 兜底（防代码直调绕过 config）。

### 5. validateChangeName 可选 language 参数（探索裁定 5b）

`validateChangeName(name, options?: { language?: string })`：两个调用方（`new-change.ts:129` 入口校验、`createChange` 内部二次校验）都握有 projectRoot，读配置解析语言后传入；不传时按默认语言（zh-CN）行为，既有调用与测试结构不破坏。错误分支的兜底正则与总结文案按字符集拼装（大写/空格/下划线/首尾连字符/连续连字符判定与语言无关，保留）。

### 6. init 预填默认值

`init.ts:createConfig` 的 `serializeConfig` 入参加 `naming` 节；`config-prompts.ts:serializeConfig` 加 naming 分支输出 `naming:` + `changeNameLanguage: zh-CN`。复用 `--language` 先例的守卫精神：`createConfig` 本就「config 已存在返回 'exists' 不覆盖」——已有用户配置不覆盖、不做静默迁移，缺 `naming` 节的项目靠文档与默认值兜底；`--language` 值能映射到映射表键（`zh`/`zh-CN`/`en`，大小写不敏感）时 naming 预填跟随该值，其他自由文本（如 Spanish）不影响 naming 预填（语言指令照旧走 context 通道）。

### 7. spec delta

- MODIFIED `change-creation`「Change Name Validation」——在变更 1（allow-chinese-change-names）归档后的最新主规格基础上整块替换，写入 configurable 语义（映射表、动态正则、可选参数）与两级 precedence；场景按语言限定（默认 zh-CN 语义 + en 语义 + 配置 precedence 场景）。
- ADDED `config-loading`——naming 节显式解析 requirement（宽松解析、未知值 warn 列支持清单、回退默认）。
- ADDED `global-config`——全局 naming fallback requirement（machine-level fallback、项目永不 override、config get/set/unset 语义、set 值域校验）。

## Impact

- 影响的能力：`change-creation`（MODIFIED）、`config-loading`（ADDED）、`global-config`（ADDED）。
- 源文件：`src/core/naming-grammar.ts`（新增：映射表 + 动态正则 + 缓存）、`src/utils/change-utils.ts`（配置驱动 + 可选 language 参数）、`src/commands/workflow/new-change.ts`（调用方接线）、`src/core/project-config.ts`（naming 节 zod + 显式解析 + 未知值 warn）、`src/core/global-config.ts`（naming 字段）、`src/core/config-schema.ts`（KNOWN_TOP_LEVEL_KEYS + naming 嵌套分支 + set 值域校验）、`src/core/config-prompts.ts` 与 `src/core/init.ts`（预填 zh-CN）。
- 测试：naming-grammar 正则构建（zh-CN/en 双语言、未知键、缓存）；validateChangeName 双语言行为与字节边界（全语言统一 220 字节）；`resolveNamingLanguage` precedence 三层；`config get/set/unset naming.changeNameLanguage`；init 预填与「已有 config 不覆盖」守卫。
- 不改动：模板源与生成物（引导层纪律文案的语言感知升级登记为后续候选——当前「优先中文」措辞与默认 zh-CN 一致，本批再生成三命令不适用）；`commands/schema.ts` schema 名校验（schema 名是模板/目录/registry 键，与 change 名映射表不统一）；store/initiative/workset 内部 id kebab 语法；capability 名校验（第二阶段扩展位 `naming.capabilityNameLanguage` 预留共享映射表，校验挂点需先对 spec id 引用面单独侦察，本批只留结构不实现）。
- 依赖：allow-chinese-change-names 先实施并**归档**——本变更的 MODIFIED delta 基于其归档后的主规格文本（实施顺序：变更 1 → 2 → 3 → 4）。

## 需求溯源

- 来源文档：`openspec命名语言可配置方案-图片还原稿.md`「第二阶段：命名语言可配置（新方案）」——**仅大纲 4 条入镜，正文未拍到，本变更正文为设计补全（非原文）**：
  - 大纲 1「config 加 naming 配置」→ What Changes 1。
  - 大纲 2「字符集映射表」→ What Changes 4（CHARSET_MAP）。
  - 大纲 3「动态正则构建」→ What Changes 4（buildChangeNamePattern + 缓存）。
  - 大纲 4「config 预填默认值」→ What Changes 6。
- 用户口头需求（还原稿「两阶段关系」节正文未拍到的语境）：两级配置——项目没配用全局、配了以项目为准 → What Changes 2 precedence。
- 探索文档第 4 节（自身标注「设计补全，非原文」）：4.1 naming 节 schema 与宽松解析下的显式校验；4.2 precedence 与「全局是 JSON 不是 YAML」事实；4.3 映射表结构（extraCharClass 增量，并集与分段结构固化在构建函数）；4.4 动态正则与缓存；4.5 init 预填与 `--language` 先例复用（不覆盖守卫）。
- 探索裁定 5a：`config set` 需在 `config-schema.ts` 登记 `KNOWN_TOP_LEVEL_KEYS` 白名单与嵌套键分支**两处**（recon「get/set 读写现成」的说法经实核修正——get 现成、set 不现成）→ What Changes 3。
- 探索裁定 5b：`validateChangeName` 加可选 language 参数，两个调用方都握有 projectRoot → What Changes 5。
- 偏差说明：还原稿大纲未提 config set/get 登记、precedence 方向、init 不覆盖守卫、可选参数签名、值域与未知值文案；以上均为探索文档按代码实核补全（设计补全），实施评审时应知悉其非原文属性；若后续拍到还原稿原第二阶段正文，以原文与本设计的差异清单重新校对。
