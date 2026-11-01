# 命名语言可配置实施清单

## 1. 映射表与动态正则（src/core/naming-grammar.ts 新增 + change-utils 配置驱动）

- [x] 1.1 新增 `src/core/naming-grammar.ts`：`CHARSET_MAP`（zh-CN → `\p{Script=Han}`；en → 空增量即纯 `[a-z0-9]`；扩展键结构注释）+ `buildChangeNamePattern(language)` 纯函数（并集 + 连字符分段 + `u` 标志在函数内固化；Map 缓存；未知键 throw 兜底）+ `SUPPORTED_NAMING_LANGUAGES` 值域清单
- [x] 1.2 `src/utils/change-utils.ts`：`validateChangeName(name, options?: { language?: string })`——正则换 `buildChangeNamePattern`；兜底分支与总结文案按字符集拼装（label）；字节校验 `Buffer.byteLength ≤ 220` 全语言统一；不传 language 按默认 zh-CN
- [x] 1.3 调用方接线：`src/commands/workflow/new-change.ts:129` 与 `createChange` 内部二次校验，经 `resolveNamingLanguage(projectRoot)` 解析后传入（projectRoot 就地取用，不给 validateChangeName 加 IO）

## 2. 配置解析与两级 precedence

- [x] 2.1 `src/core/project-config.ts`：`ProjectConfigSchema` 加 `naming` 节（`z.object({ changeNameLanguage: z.string().min(1) }).optional()`）；`readProjectConfig` 仿 `githubCopilot` 段显式解析 naming——对象形态校验、字段类型校验、未知值 `console.warn` 文案列出支持值清单（`Supported: zh-CN, en`）后丢弃回退默认；其他字段不受影响
- [x] 2.2 `src/core/global-config.ts`：`GlobalConfig` 接口加 `naming?: { changeNameLanguage?: string }`（注释标明 machine-level fallback，项目永不 override）
- [x] 2.3 新增 `resolveNamingLanguage(projectRoot)`：项目 config.yaml → 全局 config.json → `'zh-CN'`；两级各自独立降级（项目不可解析看全局，全局不可解析用默认）；语言别名归一化（`zh`/`zh-CN` 大小写不敏感 → `zh-CN`）后进映射表
- [x] 2.4 `src/core/config-schema.ts`：`KNOWN_TOP_LEVEL_KEYS` 加 `'naming'`；仿 `TELEMETRY_SETTABLE_KEYS` 加 `NAMING_SETTABLE_KEYS`（仅 `changeNameLanguage`）；`validateConfigKeyPath` 加 naming 嵌套键分支 + set 值域校验（未知值拒绝并列支持清单）；`unset` 同步登记；`--allow-unknown` 与 `UNSAFE_KEY_SEGMENTS` 语义不变
- [x] 2.5 `src/commands/config.ts`：确认 `config get naming.changeNameLanguage` 经 `getNestedValue` 可用；set/unset 帮助文案补 naming 键说明

## 3. init 预填默认值

- [x] 3.1 `src/core/config-prompts.ts:serializeConfig` 加 naming 分支：输出 `naming:` + `changeNameLanguage: <默认 zh-CN 或 --language 映射值>`
- [x] 3.2 `src/core/init.ts:createConfig`：serializeConfig 入参加 `naming`；`--language` 能映射到映射表键（`zh`/`zh-CN`/`en` 大小写不敏感）时预填跟随，其他自由文本不影响；已有 config 返回 `'exists'` 不覆盖的守卫保持（不做静默迁移）

## 4. 测试

- [x] 4.1 `buildChangeNamePattern`/`CHARSET_MAP`：zh-CN（`修复会话过期` 通过、`Fix_Session` 拒绝）、en（`add-user-auth` 通过、`修复会话过期` 拒绝）、数字前缀与归档日期前缀形态双语言均通过、未知键 throw、同语言重复构建命中缓存
- [x] 4.2 `validateChangeName`：language 参数语义（不传 = zh-CN 默认）；en 模式下既有 ASCII 用例全绿；字节边界 73/74 汉字与 220/221 ASCII 双语言一致；错误文案按语言字符集描述
- [x] 4.3 `resolveNamingLanguage` precedence 三层：项目 zh-CN + 全局 en → zh-CN（项目覆盖）；项目缺 naming + 全局 en → en（全局 fallback）；两者皆无 → 默认 zh-CN；项目 config 不可解析 → 回退全局；未知值回退默认
- [x] 4.4 `openspec config` 面：`set naming.changeNameLanguage en` 写入全局 config.json；`set naming.changeNameLanguage xx` 拒绝并列支持清单且不写文件；`get naming.changeNameLanguage` 输出当前值；`unset` 清除；`--allow-unknown` 行为不回归
- [x] 4.5 init 预填：全新 init 的 config.yaml 含 `naming: changeNameLanguage: zh-CN`；`--language zh-CN`/`--language en` 映射预填；已有 config 再跑 init 返回 exists 且文件零改动（不覆盖守卫）；`readProjectConfig` 对 naming 各非法形态（非对象/非字符串/未知值/缺失）的 warn 与回退断言
- [x] 4.6 `corepack pnpm test` 全量回归（本变更不触模板源，parity 套件应零影响）

## 5. 校验与提交检查点（模板再生成：不适用——本变更不触 `src/core/templates/` 与 `skills/` 生成物）

- [x] 5.1 前置检查：确认 allow-chinese-change-names 已归档（本变更 change-creation MODIFIED 基于其归档后的主规格；未归档则先归档再实施，防整块替换丢场景）
- [x] 5.2 运行 `node ./bin/openspec.js validate add-configurable-naming-language --strict --type change`
- [x] 5.3 批量 `node ./bin/openspec.js validate --changes`，记录结果（上游存量 `add-global-install-scope` 预期仍失败，与本批无关）
- [x] 5.4 git 提交检查点：本变更产物（src + test + 本目录）以 `proposal: configurable-naming-language 第二阶段` 提交，单个 commit 可独立回退；注意 `.git/info/exclude` 已排除 `openspec/`，收录本目录产物需 `git add -f`；实施阶段执行，提案阶段不提交
