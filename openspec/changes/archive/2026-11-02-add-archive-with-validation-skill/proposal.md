# 验证式归档技能（opsx-archive-with-validation）

## Why

上游归档流程不验证就归档：`/opsx:archive` 的前置只有可选的 `/opsx:verify` 与 `/opsx:sync`，AI 可以凭「看起来对了」直接 `openspec archive`，没有任何强制验收关卡。需要「归档前必须跑验收、验收不过不准归档」的标准路径技能。

该技能在 fork-status 核查中确认完全不存在（`skills/` 下 12 个技能全为 `openspec-*` 前缀；全仓库 grep `not_verified`、`gap_type`、`Rulings` 零命中）。其载体是约 650 行的手工技能 `skills/opsx-archive-with-validation/SKILL.md`，依赖 add-manual-skill-whitelist 落地的 `MANUAL_SKILL_DIRS` 白名单保护，不进模板生成管线。

## What Changes

### 1. 新增手工技能文件

直接编辑 `skills/opsx-archive-with-validation/SKILL.md`（白名单保护，再生成时保留）。技能开头声明「本技能是归档的标准路径」——涉及归档的请求默认走本技能，而非上游 `openspec-archive-change`。

### 2. 四阶段流程

- Phase 1 验收：对每个检查项跑真实命令，报告附实际命令与输出摘要；不可执行的检查项记 `not_verified` 并附原因
- Phase 2 修复：根据验收 finding 修复，修完进入 Phase 3
- Phase 3 复验：重跑 Phase 1 验收，确认修复生效
- Phase 4 归档：全部检查项 pass 才执行归档

### 3. verdict 三态与归档拦截

检查项 verdict 只有 `pass` / `fail` / `not_verified` 三态；任一检查项为 `not_verified` 时整体不得判 pass、不得进入归档。`not_verified` 与 `fail` 同样拦截归档，杜绝「没验过就算过」。

### 4. finding 双字段

每条验收 finding 必填 `gap_type`（missing / wrong / extra / unrequested 四值）与 `source_ref`（代码 ↔ spec 双向证据锚点，同时给出代码位置与 spec 条目位置）。

### 5. 报告尾强制未决清单

验收报告末尾强制输出未决清单：`not_verified` / `blocked` / `paused` 条目全部入列并标注来源轮次；同一事项连续 3 轮未决 → 升级人工裁决，第 3 轮起技能不再自动重试该事项。

## Impact

- 影响的能力：新增 `opsx-archive-with-validation-skill` 能力规格（全新能力，全部为 ADDED）。
- 手工技能文件：`skills/opsx-archive-with-validation/SKILL.md`（约 650 行，直接编辑，白名单保护）。
- 不改模板源：本变更不触碰 `src/core/templates/` 任何文件，无再生成产物变化；依赖 add-manual-skill-whitelist 先落地，否则该文件会被 `generate:skills` 清掉。
- 测试：parity 测试不覆盖手工技能（白名单机制保证）；运行 `test/core/templates/skillssh-generator-guards.test.ts` 回归确认白名单保留行为。
- 与 add-stalled-change-triage 的关系：后者将对本技能做七处增强并对其能力规格追加 requirement；本变更先建立主规格。

## 需求溯源

- 来源文档：`spec建议清单-图片还原.md`「验证式归档技能」全节（图1+图2）。
  - 「解决的问题」→ Why。
  - 「改哪些文件」`skills/opsx-archive-with-validation/SKILL.md`（手工技能、约 650 行、白名单保护）→ What Changes 1 / Impact。
  - 「怎么改」四阶段 → What Changes 2。
  - 「关键机制」四条：verdict 三态、finding 双字段、报告尾未决清单 + 3 轮升级、开头声明标准路径 → What Changes 1/3/4/5。
- 「纪律」节第 3 条（白名单保护、不进生成管线）→ Impact 与 design.md。
- 偏差说明：需求稿称「开头声明标准路径」，本 proposal 统一表述为「归档的标准路径」（同一机制，语义不变）。
