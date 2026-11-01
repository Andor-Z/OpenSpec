# git 提交检查点（proposal: / apply: 前缀）

## Why

上游 OpenSpec 的提案工作流（propose → apply → archive）没有任何 git 提交纪律：`src/core/templates/workflows/propose.ts` 的 Output 段只要求总结产物并提示运行 `/opsx:apply`，`apply-change.ts` 止于 step 7 完成汇报，全模板无一处 `git commit` / `git add`（fork-status 核查：生成物 grep `git add|git commit|proposal:|apply:` 零命中）。结果是 AI 实施完可能不提交，或一次提交卷入多个提案的内容，「一个提案一个 commit、能独立回退」的纪律被破坏。

需要在每个关键产物节点插入显式的提交检查点：由 AI 询问用户、用户决定是否提交、提交信息带可识别前缀，且永不自动提交。

## What Changes

### 1. propose 技能新增 proposal 产物提交检查点

`src/core/templates/workflows/propose.ts` 的 **skill 模板变体**（`getOpsxProposeSkillTemplate`）在 step 7（展示最终状态）与 Output 交接语之间插入一步：询问用户是否将本次 proposal 产物 git 提交，同意则以 `proposal:` 前缀提交（仅含 `openspec/changes/<提案名>/` 下产物），拒绝则记录并继续交接。**propose 的 command 模板变体（`getOpsxProposeCommandTemplate`）保持上游原文不动**（纪律不对称、最小改动）。

### 2. apply 技能新增实施完成提交检查点

`src/core/templates/workflows/apply-change.ts` 在 step 7（完成/暂停汇报）之后新增 **step 8**：询问用户是否 git 提交，同意则以 `apply:` 前缀提交本轮实施产物，拒绝则按用户指示收尾。apply 模板是 skill 与 command 共享同一 instruction 文本（同文件渲染两个表面），因此 `/opsx:apply` command 面自动同步携带该步骤，无需单独改动，parity 机制保证两表面一致。

### 3. 永不自动提交纪律

两个检查点都是「询问—等待答复—执行」结构：用户未答复或拒绝时，技能 MUST NOT 执行任何 `git commit`；提交内容与提交信息前缀在执行前呈现给用户确认。

## Impact

- 影响的能力：
  - 新增 `opsx-propose-skill` 能力规格——specs/ 现有 44 个能力中只有 apply/archive/bulk-archive/onboard/update/verify 六个 `opsx-*-skill` 规格，propose 技能尚无对应能力规格，本变更以 ADDED 新建该能力（偏差说明见需求溯源）。
  - `opsx-apply-skill`：ADDED 一条提交检查点 requirement（不 MODIFIED 既有 requirement）。
- 模板源文件：`src/core/templates/workflows/propose.ts`（仅 skill 变体）、`src/core/templates/workflows/apply-change.ts`（skill/command 共享正文）。
- 生成物：`skills/openspec-propose/SKILL.md`、`skills/openspec-apply-change/SKILL.md`、命令面 `/opsx:apply`（由共享文本自动携带）；`/opsx:propose`、`/opsx:new` command 模板保持上游原文。
- 测试：`test/core/templates/skill-templates-parity.test.ts`（内容逐字节重钉）、`test/core/templates/skillssh-parity.test.ts` + `regen:parity-hashes` 哈希重钉；模板单元测试若有步骤计数断言需同步。
- 依赖说明：本变更引入的 step 8 是 add-apply-precise-staging 的挂载点；add-stalled-change-triage 又在其上扩展分诊逻辑。三者建议按本变更 → 精确暂存 → 滞留分诊的顺序实施。

## 需求溯源

- 来源文档：`spec建议清单-图片还原.md`「git 提交检查点」全节（图1）。
  - 「解决的问题」→ 本 proposal Why。
  - 「改哪些文件」`src/core/templates/workflows/propose.ts`、`apply-change.ts` → Impact 模板源清单。
  - 「怎么改」四条：propose 步骤（`proposal:` 前缀）、apply 步骤（`apply:` 前缀）、每步询问不自动提交、apply skill/command 共享核心同步携带且 propose/new command 保持上游原文 → What Changes 1/2/3。
- 顶部「关键前提」引用块（改模板源不改生成物 + 再生成三命令）→ tasks.md 实施路径。
- 偏差说明：需求稿未指定 propose 侧能力规格名；因 propose 技能无既有能力规格，本变更新建 `opsx-propose-skill`（命名对齐既有 `opsx-apply-skill` 族），而非把 propose 行为挂进 `change-creation`（该能力只覆盖 `createChange` 程序化工具，不管技能步骤流）。
