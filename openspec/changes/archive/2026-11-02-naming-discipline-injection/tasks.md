# 命名纪律注入实施清单

## 1. 共享常量与模板注入（只改 `src/core/templates/`，不改生成物）

- [x] 1.1 新增 `src/core/templates/workflows/naming-discipline.ts`：单导出 `NAMING_DISCIPLINE` 模板字符串常量（仿 `store-selection.ts`），内容含：change 目录名纯中文、capability（spec）目录名引导用中文、动机说明（名称自解释，几百个 spec 时直接可读）、合法示例 `修复会话过期`、非法示例 `Fix_Session`、「优先中文非禁止英文」措辞（并集字符集下英文 kebab 名仍合法）、spec 正文中文但 `SHALL`/`MUST` 等规范关键词保留英文（RFC 2119 不动）
- [x] 1.2 `propose.ts`：`getOpsxProposeSkillTemplate()` 注入 `${NAMING_DISCIPLINE}`（紧邻 `${STORE_SELECTION_GUIDANCE}`/`${PROJECT_ROOT_GUARD}` 注入位）；重写 skill 面 2 处 kebab 措辞（`**Input**` 的 `(kebab-case)`、`derive a kebab-case name (e.g., "add user authentication" → add-user-auth)`）为遵循纪律的表述与中文示例；`getOpsxProposeCommandTemplate()` 一字不改
- [x] 1.3 `new-change.ts`：skill 面注入并重写 3 处（`**Input**`、`derive a kebab-case name`、guardrail「not kebab-case, ask for a valid name」）；command 面（`getOpsxNewCommandTemplate`）含其 guardrail 一字不改
- [x] 1.4 `ff-change.ts`：skill 面注入并重写 2 处；command 面 2 处一字不改
- [x] 1.5 `onboard.ts`：skill 面注入并重写 1 处（「Create the change with a derived kebab-case name」→ 按项目命名纪律派生目录名，优先中文）；onboard 无 command 面
- [x] 1.6 `apply-change.ts`：在共享正文 `getApplyInstructions()` 注入一次（`getApplyChangeSkillTemplate` 与 `getOpsxApplyCommandTemplate` 两表面同步携带）；不触碰 `SKILL_APPLY_HANDOFF`/`COMMAND_APPLY_HANDOFF`（optionalWorkflow 机制与命名纪律无关）
- [x] 1.7 措辞一致性自检：对 5 个模板源 grep 确认 skill 面无残留「derive a kebab-case name」/「(kebab-case)」措辞，command 面与上游逐字节零 diff

## 2. 再生成三命令

- [x] 2.1 `corepack pnpm build`（generate 从 `dist/` 导入，必须先编译）
- [x] 2.2 `corepack pnpm regen:parity-hashes` 重钉 parity 哈希
- [x] 2.3 `corepack pnpm generate:skills`：确认 5 个目标 SKILL.md 出现纪律段与中文示例；`/opsx:propose`、`/opsx:new`、`/opsx:ff` command 生成内容与上游零 diff；其余生成技能（explore/continue/archive/bulk-archive/sync-specs/update/verify）不受影响

## 3. 测试

- [x] 3.1 新增 `test/core/templates/naming-discipline.test.ts`（仿 `project-root-guard.test.ts`）：常量内容锚点断言（两条纪律、动机、合法/非法示例、「优先中文」措辞）；`getSkillTemplates()`/`getCommandContents()` 渲染结果断言——propose/new-change/ff-change/onboard 的 skill 面含纪律段，propose/new-change/ff-change 的 command 面不含纪律段，apply 两表面均含
- [x] 3.2 `test/core/templates/skill-templates-parity.test.ts`：模板函数 payload 逐字节断言按 `regen:parity-hashes` 流程重钉后跑绿
- [x] 3.3 `test/core/templates/skillssh-parity.test.ts`：skills.sh 通道再生成-对比通过
- [x] 3.4 回归 `test/core/templates/` 全部测试与 `test/utils/command-references.test.ts`；`corepack pnpm test` 全量确认无其他破坏

## 4. 校验与提交检查点

- [x] 4.1 运行 `node ./bin/openspec.js validate add-naming-discipline-injection --strict --type change`
- [x] 4.2 git 提交检查点：模板源 + 再生成产物（skills/）+ 测试 + 本目录以 `proposal: naming-discipline-injection 引导层` 提交，单个 commit 可独立回退；注意 `.git/info/exclude` 已排除 `openspec/`，收录本目录产物需 `git add -f`；实施阶段执行，提案阶段不提交
