# apply 精确暂存

## Why

上游 apply 工作流止于 step 7，没有任何暂存纪律；fork 在 add-git-commit-checkpoints 中为其新增 step 8 提交检查点后，若沿用最常见的 `git add -A` / `git add .` 全量暂存，会把工作区所有脏文件——无关改动、其他提案的产物、临时实验——一并卷进本提案的 commit，直接破坏「一个提案一个 commit、能独立回退」的纪律（需求稿「apply 精确暂存」节）。

且本仓库的工程纪律是「openspec/ 提案产物本地 exclude 不入库」（`.git/info/exclude` 加 `openspec/`）：新提案产物是未跟踪文件，`git add` 会被 exclude 静默跳过。全量暂存既会卷入无关文件，又无法对 openspec/ 产物给出正确行为，必须改为显式两组路径的精确暂存。

## What Changes

### 1. apply step 8 改为 porcelain 预检 + 精确暂存

`src/core/templates/workflows/apply-change.ts` step 8（提交检查点步骤，由 add-git-commit-checkpoints 引入）在用户同意提交后，先跑 `git status --porcelain` 预检列出全部脏路径，然后只暂存两组路径：①本轮实施触及的实现文件（实施循环中实际编辑/新建的文件）；②`openspec/changes/<提案名>/` 产物目录。

### 2. 明文禁止全量暂存

模板 Guardrails 增补红线：step 8 禁止使用 `git add -A` 与 `git add .`，无论工作区多脏、用户如何催促，都不得以全量暂存替代路径枚举。

### 3. 仓库不跟踪 openspec/ 时降级

当仓库未跟踪 `openspec/`（未纳入版本管理或被 `.git/info/exclude` 排除）时，`openspec/changes/` 产物不可暂存，step 8 降级为只暂存实现文件，并在输出中说明产物未入库的事实。

### 4. 暂存清单留痕

每次精确暂存后，把实际暂存的路径清单写入提交信息正文（第二个 `-m`）或 `openspec/changes/<提案名>/tasks.md`，使「这个 commit 到底含哪些文件」可事后审计。

## Impact

- 影响的能力：`opsx-apply-skill`（ADDED 一条精确暂存 requirement，不触碰该能力既有 requirement）。
- 模板源文件：`src/core/templates/workflows/apply-change.ts`（step 8 与 Guardrails）。
- 生成物：`skills/openspec-apply-change/SKILL.md` 与 `/opsx:apply` command（共享文本自动同步）。
- 测试：`test/core/templates/skill-templates-parity.test.ts`、`skillssh-parity.test.ts`（重钉哈希）。
- 实施顺序依赖：step 8 挂载点由 add-git-commit-checkpoints 先落地；本变更只改 step 8 内部的暂存策略，不改检查点的询问-确认结构。add-stalled-change-triage 将在本变更基础上扩展无关改动的分诊登记。

## 需求溯源

- 来源文档：`spec建议清单-图片还原.md`「apply 精确暂存」全节（图2）。
  - 「解决的问题」→ Why 第一段。
  - 「改哪些文件」`apply-change.ts`（step 8）、同步生成物 `skills/openspec-apply-change/SKILL.md`、parity 金哈希测试 `test/core/templates/skill-templates-parity.test.ts` → Impact。
  - 「怎么改」四条：porcelain 预检 + 两组路径、明文禁止 `-A` 与 `.`、不跟踪 openspec/ 降级、暂存清单留痕（第二个 `-m` 或 tasks.md）→ What Changes 1–4。
- 「纪律」节最后一条（`.git/info/exclude` 排除 openspec/ 与降级分支的关系）→ Why 第二段与 What Changes 3。
