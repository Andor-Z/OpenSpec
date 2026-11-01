# 滞留改动分诊实施清单

## 1. apply 模板源（step 1 扫描 + step 8 分诊）

- [ ] 1.1 修改 `src/core/templates/workflows/apply-change.ts` step 1：增加滞留登记扫描——`openspec/changes/<提案名>/滞留改动登记.md` 存在则读取并向用户呈现遗留滞留项，不存在则静默跳过
- [ ] 1.2 同文件 step 8：在精确暂存前用 `git status --porcelain` 对脏路径分类——本提案相关 → 精确暂存；无关改动 → 不暂存且逐条登记入 `openspec/changes/<提案名>/滞留改动登记.md`
- [ ] 1.3 同文件 step 8：用户拒提交时把本提案自身改动也登记为滞留（原因注明「用户拒绝提交」）
- [ ] 1.4 同文件定义登记册记录结构与追加式纪律：日期/路径/归属/滞留原因/建议处置/状态六字段；只追加不删行，状态变化以新记录回指旧记录
- [ ] 1.5 同文件 Guardrails 增补：技能永不代用户处置无关改动（只登记不动手删/改/提交/还原）

## 2. 归档手工技能七处增强

- [ ] 2.1 `skills/opsx-archive-with-validation/SKILL.md` frontmatter 版本号 bump（如 1.0 → 1.1），正文变更记录注明本轮增强与提案名
- [ ] 2.2 Phase 1 开头：先读 `滞留改动登记.md`（若存在）把滞留项呈现给验收员，作为验收输入
- [ ] 2.3 Phase 3：用户拒修 finding 时登记入册（标拒修原因并引用 `gap_type`/`source_ref`），被拒 finding 不得从报告消失
- [ ] 2.4 Phase 4：用户拒归档时登记拒归档原因并终止归档；未决条目（not_verified/blocked/paused）从报告正文搬入尾部 Rulings 清单统一管理
- [ ] 2.5 记录结构定义段：登记册六字段与追加式纪律，与 apply 侧定义保持一致
- [ ] 2.6 Orchestrator 增加第 10 条：滞留改动跨会话可见，新会话进入流程先读登记册
- [ ] 2.7 Guardrails 红线：技能永不代用户处置无关改动（只登记，处置必须由用户显式发起）

## 3. 再生成三命令

- [ ] 3.1 运行 `corepack pnpm build`（generate 从 `dist/` 导入，必须先编译）
- [ ] 3.2 运行 `corepack pnpm regen:parity-hashes` 重钉 parity 哈希
- [ ] 3.3 运行 `corepack pnpm generate:skills`，确认 `skills/openspec-apply-change/SKILL.md` 含 step 1 扫描与 step 8 分诊，`skills/opsx-archive-with-validation/` 手工技能在再生成后原样保留（白名单）

## 4. parity 与相关测试

- [ ] 4.1 运行 `test/core/templates/skill-templates-parity.test.ts`，按流程重钉后跑至绿
- [ ] 4.2 运行 `test/core/templates/skillssh-parity.test.ts` 与 `skillssh-generator-guards.test.ts`，确认 skills.sh 通道一致且白名单保留行为正常
- [ ] 4.3 确认 `/opsx:apply` command 生成内容同步携带 step 1 扫描与 step 8 分诊（skill/command 共享文本）

## 5. 校验与提交检查点

- [ ] 5.1 运行 `openspec validate add-stalled-change-triage --strict`（仓库 CLI：`node ./bin/openspec.js`；注意本变更对 `opsx-archive-with-validation-skill` 的 delta 须在 add-archive-with-validation-skill 先归档产生主规格后归档，ADDED 区块不受影响）
- [ ] 5.2 git 提交检查点实战：以 `proposal: add-stalled-change-triage 滞留改动分诊` 提交本变更产物；实施后实际演练一次「脏工作区含无关改动 → step 8 分诊 → 无关改动入册 → 下个新会话 apply 时 step 1 呈现滞留项」的跨会话链路（若 `.git/info/exclude` 已生效需 `git add -f`，见 add-openspec-exclude-discipline）
