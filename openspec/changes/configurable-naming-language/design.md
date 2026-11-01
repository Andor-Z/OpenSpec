# 设计：命名语言映射表、两级 precedence 与配置登记

## Context

第一阶段把 change 名字符集写死为 `[\p{Script=Han}a-z0-9]`（allow-chinese-change-names）。第二阶段抽配置：`naming.changeNameLanguage` 键（项目 config.yaml > 全局 config.json > 默认 zh-CN）、`CHARSET_MAP` 映射表、`buildChangeNamePattern(language)` 动态正则。本 design 记录签名、precedence、config set 登记与 init 预填四个取舍点。前置事实（recon 实核）：`readProjectConfig` 手工逐字段解析、顶层未知键**静默忽略**（naming 必须显式解析）；全局配置是 `~/.config/openspec/config.json`（JSON，非 YAML）；`config get` 走 `getNestedValue` 点分键现成，`config set` 被 `KNOWN_TOP_LEVEL_KEYS` 白名单拒绝未知顶层键且嵌套键需显式分支。

## Decisions

### 1. 映射表只贡献「字符类增量」，结构固化在构建函数

```ts
// src/core/naming-grammar.ts（示意）
interface NamingCharset {
  extraCharClass: string; // 插入字符类，与 [a-z0-9] 取并集；空串 = 纯 kebab（上游行为）
  label: string;          // 错误文案中的语言描述（如「中文汉字」）
}
const NAMING_CHARSETS: Record<string, NamingCharset> = {
  'zh-CN': { extraCharClass: '\\p{Script=Han}', label: '中文汉字' },
  'en':    { extraCharClass: '',                label: '' },
};
```

- 并集规则（`[<extraCharClass>a-z0-9]`）与连字符分段结构（`(?:-…)*`，禁止首尾/连续连字符）、`u` 标志在 `buildChangeNamePattern(language)` 内固化——保证任何语言下编号前缀（`100-add-feature`）与归档日期前缀形态（`2026-01-02-中文`）合法，第二阶段不再讨论这两个不变量。
- 结构预留：新语言 = 加一个映射键（如 `ja` → `'\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Han}'`），消费方零改动。
- 缓存：语言键 → RegExp 的进程级 Map（正则是语言键的纯函数，无 config 对象身份问题；每次构建成本低，缓存是顺手不是必需）。
- 未知键：config 解析层已拦（值域校验），构建函数对未知键 throw 兜底（防代码直调绕过 config）。
- `commands/schema.ts:253` 的 schema 名独立正则不参与映射（schema 名是模板/目录/registry 键），`id.ts` 内部 id 语法不参与。

### 2. 签名：validateChangeName 加可选 options.language（不动纯函数默认行为）

`validateChangeName(name, options?: { language?: string })`——不传 = 默认语言（zh-CN），既有 32 用例结构与既有 2 个调用方的默认行为不破坏。语言解析独立为 `resolveNamingLanguage(projectRoot)`（项目 readProjectConfig → 全局 getGlobalConfig → `'zh-CN'`），由调用方（`new-change.ts:129` 与 `createChange` 内部，两处都握有 projectRoot）resolve 后传入。不把 readProjectConfig 塞进 validateChangeName 内部：保持校验函数无 IO、可测。

### 3. precedence：项目 > 全局 > 默认，全局永不 override

- 方向依据：全局 `defaultStore` 注释「Machine-level fallback store id」、项目 `store:` 标注「a fallback, never an override」——仓库无「全局覆盖项目」先例；用户口头预期「项目没配用全局、配了以项目为准」。
- `GlobalConfig` 加 `naming?: { changeNameLanguage?: string }`：`getGlobalConfig` 的 spread 合并天然透传未知键，读取侧零改动；全局 JSON 键 `naming` 非 yaml（文档/spec 不得写「全局 config.yaml」）。
- 失效安全：项目 config 不可解析（readProjectConfig 返回 null）→ 看全局；全局不可解析 → 默认 zh-CN。两级各自独立降级，不互相污染。

### 4. config set 登记：白名单 + 嵌套键分支两处（探索裁定 5a）

- `KNOWN_TOP_LEVEL_KEYS` 加 `'naming'`——否则 `openspec config set naming.changeNameLanguage …` 直接被「Unknown top-level key」拒绝。
- 仿 `telemetry` 分支（`TELEMETRY_SETTABLE_KEYS` 先例）加 `NAMING_SETTABLE_KEYS = new Set(['changeNameLanguage'])`：允许且仅允许 `naming.changeNameLanguage` 一个嵌套键，防止任意嵌套键直写全局 config.json。
- set 时即校验值域（未知值拒绝并列出 `Supported: zh-CN, en`）——比「写进文件、下次读取再 warn」更早拦截；`--allow-unknown` 逃生口语义保持（跳过值域校验但不跳过 UNSAFE_KEY_SEGMENTS 原型链防护）。`unset` 同步登记。
- 项目级 config.yaml 的 naming 编辑不做 CLI 面：项目 config 归项目文件（手工/init 预填），`openspec config` 只管全局（与现状 `config` 命令只读写全局 config.json 一致）。

### 5. init 预填：复用 --language 不覆盖守卫精神

- `config-prompts.ts:serializeConfig` 加 naming 分支：输出 `naming:\n  changeNameLanguage: <zh-CN|跟随 --language 映射>`。
- `init.ts:createConfig`（:1150 附近）：serializeConfig 入参加 `naming`；既有「config 已存在返回 'exists' 不覆盖」守卫（:1156-1158）天然满足「已有用户配置不覆盖」——不做静默迁移，缺 naming 节的存量项目靠默认值兜底（resolveNamingLanguage 对缺键项目返回默认）。
- `--language` 映射：`zh`/`zh-CN`（大小写不敏感）→ `zh-CN`，`en` → `en`；其他自由文本（Spanish 等）不影响 naming 预填（语言指令照旧走 context 通道，`formatLanguageContext` 不动）。

### 6. 范围外登记（本批不做，防范围蔓延）

- 引导层纪律文案的语言感知升级：NAMING_DISCIPLINE 常量当前措辞「优先中文」与默认 zh-CN 一致；多语言文案升级登记为后续候选（届时 5 模板共享 1 常量的形态直接受益）。
- `naming.capabilityNameLanguage`：结构预留（共享 CHARSET_MAP），校验挂点（specs-apply/sync 新建 spec 目录时校验）落地前需对 spec id 引用面（references 解析、`--spec` 参数、tasks 生成）单独侦察，本批不实现、不进 schema。

## Risks / Trade-offs

- **宽松解析与显式校验的张力**：config-loading 语义是坏字段 warn 后丢弃、不硬失败——naming 未知值也走 warn + 回退默认（与 githubCopilot 段、operations 节同型）；代价是配置错误「静默降级为默认」，靠 warn 文案列出支持值缓解。
- **缓存键与语言别名**：`zh` 是否等价 `zh-CN`？——解析层归一化（init `--language` 映射同款）后再进映射表，缓存键只存映射表键，杜绝别名多缓存副本。
- **en 回退=上游行为**：`en` 的正则等价 `KEBAB_ID_REGEX`（纯 `[a-z0-9]` kebab），上游 fork 回去时把默认值改回 `en`（或不预填）即可恢复上游语义——映射表结构不需要删改。
- **两个 MODIFIED 变更的顺序耦合**：本变更的 change-creation delta 基于变更 1 归档后的主规格；若变更 1 未归档先实施本变更，MODIFIED 整块替换会丢变更 1 的场景——tasks 校验步骤加入「确认变更 1 已归档」前置检查。
