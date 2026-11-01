# change 名允许中文（校验层）

## Why

上游 OpenSpec 的 change 名（提案目录名）固定英文 kebab-case（如 `fix-session-timeout`），命名纪律要求纯中文（如「修复会话过期」）。名称不自解释：项目积累几百个 spec 后，光看目录名无法知道每条 spec 管什么——`修复会话过期` 一眼即知，`fix-session-timeout` 需要翻译。本变更是「spec 命名中文」三层防护（校验层 → 引导层 → 检查层）的第一层：放宽 change 名校验允许中文，让后续提案可以合法创建中文目录名。三层顺序不可倒置：先放开校验，再教 AI 用中文（naming-discipline-injection），最后治理存量（检查层另行处理，未随本仓库交付）——否则出现「AI 用中文但创建被拦」或「拦了创建但没人教」的中间态。

边界（本变更不动）：store / initiative / workset id 是系统内部 id，继续走 `src/core/id.ts` 的共享 kebab 语法（`KEBAB_ID_REGEX` / `isKebabId`），其余 4 个 `isKebabId` 消费方（`change-metadata/schema.ts`、`root-selection.ts`、`worksets.ts`、`store/foundation.ts`）天然不受影响；共享文案 `KEBAB_ID_DESCRIPTION` / `KEBAB_ID_FIX`（`src/core/id.ts:28-33`）服务 store/workset 报错，不动；workflow schema 名的独立校验（`src/commands/schema.ts`，首段必须字母开头）管的是 schema 名不是 change 名，不碰（防误改证据见 design.md）。

## What Changes

### 1. validateChangeName 改 change 名专用正则（脱离共享 isKebabId）

`src/utils/change-utils.ts` 的 `validateChangeName` 不再复用 `isKebabId`，改用专用正则：字符集取汉字与小写字母、数字的**并集** `[\p{Script=Han}a-z0-9]`，连字符分段（`/^[\p{Script=Han}a-z0-9]+(?:-[\p{Script=Han}a-z0-9]+)*$/u`；`u` 标志必须加，`\p` 属性转义依赖它）。取并集而非替换：`100-add-feature` 这类编号前缀名是已测行为（#850、#1169），归档名 `2026-01-02-修复会话过期` 的形态也依赖「任意段 + 连字符」结构，替换式（`[\p{Script=Han}-]`）会同时杀掉两者。非法字符兜底分支 `/[^a-z0-9-]/` 同步放宽为 `/[^\p{Script=Han}a-z0-9-]/u`；错误文案改写为说明允许中文/小写字母/数字/连字符（现状 `/[A-Z]/`、`/\s/`、`/_/` 等 ASCII 假设分支对纯中文名永远 false，全部掉进误导性兜底文案）。

### 2. 长度校验从字符数改字节

现状 `name.length > 200` 按字符数，但同函数注释自己写明文件系统目录组件上限是 255 **字节**；中文 UTF-8 每字 3 字节，字符数校验在中文下失真（放行长中文名会在 mkdir 时以 ENAMETOOLONG 裸崩，绕过友好报错）。改为 `Buffer.byteLength(name, 'utf8') <= 220`：255 − 11（归档日期前缀 `YYYY-MM-DD-`，`src/core/archive.ts` 拼接）= 244，再留 24 字节余量防深嵌套路径层叠（Windows 260 总长约束下更敏感）；220 字节 ≈ 73 个汉字（73×3=219）或 220 个 ASCII 字符。错误文案说明字节语义（中文每字占 3 字节）。字节化校验是本变更的必须连带项，不可拆分后续补。

### 3. 既有测试改造与新增用例

`test/utils/change-utils.test.ts` 的 `'a'.repeat(200)`（合法）/ `'a'.repeat(201)`（非法）用例在字节语义下反转（201 字符 = 201 字节 ≤ 220 变合法），重写为字节边界；既有数字前缀用例（`100-add-feature`、`00001-add-auth`、`101-01-fix-auth`、`100`）必须继续通过。新增用例：「修复会话过期」通过；`Fix_Session` 失败；`100-修复登录`（数字前缀）通过；`2026-01-02-修复会话过期`（归档日期前缀形态）通过；68 汉字（204 字节）通过；73 汉字（219 字节，边界内）通过 / 74 汉字（222 字节，边界外）失败；220 ASCII 通过 / 221 ASCII 失败；全角字符 `ＡＢＣ`（`Script=Common`，正确拒绝）失败。

### 4. spec delta：MODIFIED change-creation「Change Name Validation」

整块替换该 requirement（全部既有 10 个 scenario 语义保留、表述重写为并集字符集语义），把并集字符集与 220 字节上限写进 requirement 正文与新 scenario。不新增 requirement、不 REMOVED。

## Impact

- 影响的能力：`change-creation`「Change Name Validation」requirement（MODIFIED，整块替换）；「Change Creation」requirement（含 Invalid change name rejected scenario）不受影响。
- 源文件：`src/utils/change-utils.ts`（专用正则 + 字节化长度 + 错误文案组）、`src/core/id.ts`（仅头注释更新：声明 change 名自本变更起可脱离共享 kebab 语法；`KEBAB_ID_REGEX`/`isKebabId` 及共享文案行为零变化）。
- 测试：`test/utils/change-utils.test.ts`（长度用例重写 + 中文用例新增；32 个既有用例中除长度 2 条外全部继续通过）。
- 不改动：`src/commands/schema.ts`（schema 名独立校验，证据见 design.md 决策 4）；`src/core/archive.ts`（日期前缀拼接对中文目录名无 ASCII 假设，中文名 → `2026-01-02-修复会话过期` 自然成立，无需修改）；模板源与 `skills/` 生成物（本变更不触模板，再生成三命令不适用，parity 套件仅作回归）；`list`/`view` 的列宽显示（`.length` 计宽对中文的视觉错位为纯视觉问题，登记不修，后续候选 East-Asian-width 计宽）。
- 调用面：`validateChangeName` 全仓库真实调用仅 2 处（`src/commands/workflow/new-change.ts:129` 入口校验、`src/utils/change-utils.ts:137` `createChange` 内部二次校验），单点改语法源即覆盖全部创建入口；`instructions`/`status`/`archive`/`show`/`list` 均不校验 change 名。

## 需求溯源

- 来源文档：`openspec命名语言可配置方案-图片还原稿.md`「第一阶段：spec 命名改成中文」→「校验层：change 名允许中文」全节（img-4）。
  - 「解决的问题」（kebab-only vs 纯中文纪律、store/initiative/workset id 保持 kebab 不动）→ Why。
  - 「改哪些文件」`src/utils/change-utils.ts`、`test/utils/change-utils.test.ts` → Impact。
  - 「怎么改」validateChangeName 脱离 isKebabId 改专用正则、正则放宽为 `/^[\p{Script=Han}a-z0-9]+(?:-[\p{Script=Han}a-z0-9]+)*$/u`、`/[^a-z0-9-]/` 分支同步放宽、错误文案说明允许中文/小写字母/数字/连字符、`commands/schema.ts` 是 schema 名校验不改 → What Changes 1 + design.md 决策 4。
  - 「关键机制」`\p{Script=Han}` 匹配汉字、`u` 标志必须加、汉字+小写字母+数字+连字符、不允许大写/下划线/空格、内部 id 仍走 isKebabId → spec delta requirement 正文。
  - 「还原要点」测试覆盖「修复会话过期」通过、「Fix_Session」失败 → What Changes 3。
- 原文未展开、由探索文档补全的部分（`openspec/explorations/spec-naming-language-config.md` 3a 节 + 风险表 #1/#2/#7/#11）：
  - 长度校验字节化（还原稿未提及；裁定 `Buffer.byteLength ≤ 220`，推导与余量见 design.md 决策 2）→ What Changes 2。
  - 既有 200/201 字符用例在字节语义下必须重写（否则假绿）→ What Changes 3。
  - 并集不能写成替换式的论证（编号前缀 + 归档形态双保住）。
  - `id.ts:1-4` 注释「change ids share it」在放宽后失真，顺手修正（非行为改动）。
  - list/view 中文列宽登记不修；git `core.quotepath` 显示问题登记为环境配置。
- 偏差说明：无。还原稿的正则、文案方向、「不碰 schema.ts」均逐条落实；220 字节上限为探索文档数值裁定（还原稿未给数）。
