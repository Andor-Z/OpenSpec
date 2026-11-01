## ADDED Requirements

### Requirement: 模板源优先纪律

本仓库 SHALL 把工作流行为的魔改入口限定为模板源 `src/core/templates/`（含 `workflows/*.ts` 与共享段落模块），生成物 `skills/<name>/SKILL.md` MUST NOT 直接手改——生成物由模板渲染重生成即被覆盖；已登记白名单的手工技能目录除外（见「手工技能白名单登记纪律」）。

#### Scenario: 行为魔改落在模板源

- **GIVEN** 需要修改 propose 或 apply 技能的步骤流（如新增提交检查点）
- **WHEN** 执行者实施该修改
- **THEN** 改动落在 `src/core/templates/workflows/` 下对应模板源文件
- **AND** 不直接编辑 `skills/openspec-propose/SKILL.md` 等生成物

#### Scenario: 手改生成物被 parity 拦截

- **GIVEN** 执行者直接编辑了某个未豁免的 `skills/openspec-*/SKILL.md`
- **WHEN** 运行 parity 测试套件
- **THEN** 「生成内容 == 磁盘内容」断言失败并提示重新生成
- **AND** 唯一合规路径是回到模板源修改后重跑再生成三命令

### Requirement: 再生成三命令纪律

模板源改动后 SHALL 按固定顺序执行再生成三命令：`corepack pnpm build` → `corepack pnpm regen:parity-hashes` → `corepack pnpm generate:skills`；MUST NOT 跳过 build 直接运行 generate（generate 从 `dist/` 导入模板函数，跳过 build 会以旧编译产物覆盖生成物）。

#### Scenario: 完整顺序执行后生成物与模板一致

- **GIVEN** 模板源已修改
- **WHEN** 按顺序运行 `corepack pnpm build && corepack pnpm regen:parity-hashes && corepack pnpm generate:skills`
- **THEN** `skills/` 下生成技能内容与最新模板一致
- **AND** parity 测试套件全部通过

#### Scenario: 跳过 build 直接 generate 被视为违规

- **GIVEN** 模板源已修改但未运行 `corepack pnpm build`
- **WHEN** 执行者直接运行 `corepack pnpm generate:skills`
- **THEN** 生成物由旧的 `dist/` 编译产物渲染，与模板源不一致
- **AND** parity 测试失败，纠正方式是按完整三命令顺序重跑而非手改生成物

### Requirement: 手工技能白名单登记纪律

手工技能（直接编辑 `skills/` 下文件、不进模板生成管线的技能）SHALL 通过 `MANUAL_SKILL_DIRS` 白名单登记保护，登记方式为向该数组追加目录名；MUST NOT 在未登记的情况下把手工技能放入 `skills/`——未登记目录会在下一次 `generate:skills` 清理时被静默删除。

#### Scenario: 登记后的手工技能在再生成后保留

- **GIVEN** 一个手工技能目录已登记进 `MANUAL_SKILL_DIRS`
- **WHEN** 运行完整再生成三命令
- **THEN** 该目录及其内容原样保留
- **AND** skillssh-parity 的精确目录集断言因白名单豁免而保持通过

#### Scenario: 未登记的手工目录被清理

- **GIVEN** 一个手工技能目录存在于 `skills/` 下但未登记白名单
- **WHEN** 运行 `corepack pnpm generate:skills`
- **THEN** 该目录被清理删除
- **AND** 恢复方式是重新登记白名单后重放该手工技能内容，而非关闭清理

### Requirement: openspec/ 提案产物本地排除纪律

遵循本纪律的仓库 SHALL 在 `.git/info/exclude` 追加 `openspec/`，使新提案产物本地不入库；排除只影响未跟踪新文件，已 tracked 的历史提案 MUST 不受影响；被排除路径的 `git add` 会被静默跳过，入库 MUST 使用 `git add -f` 强制；需入库的变更目录 SHALL 在 exclude 生效前创建（如本变更自身目录），生效后入库时以 `-f` 补救。

#### Scenario: exclude 后新提案产物不入库

- **GIVEN** `.git/info/exclude` 已含 `openspec/`
- **WHEN** propose 流程在 `openspec/changes/<新提案>/` 创建产物
- **THEN** `git status` 不再显示这些未跟踪文件
- **AND** 普通 `git add openspec/` 不会把它们收入暂存区

#### Scenario: 已 tracked 的历史提案不受影响

- **GIVEN** `openspec/specs/` 与历史归档提案已被 git 跟踪，且 `.git/info/exclude` 含 `openspec/`
- **WHEN** 修改任一已跟踪文件并查看 `git status`
- **THEN** 该修改照常显示为已跟踪文件的变更
- **AND** 其提交无需 `-f`，排除规则对已跟踪文件不生效

#### Scenario: 被排除路径需 -f 强制入库

- **GIVEN** 本变更自身目录创建于 exclude 生效之前、但产物在 exclude 生效时仍未 `git add`
- **WHEN** 实施者需要把本变更产物入库
- **THEN** 使用 `git add -f openspec/changes/add-openspec-exclude-discipline/` 显式强制
- **AND** 提交后这些文件成为已跟踪状态，后续修改不再受排除规则影响
