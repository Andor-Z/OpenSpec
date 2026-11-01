# 验证式归档技能实施清单

## 1. 前置确认

- [x] 1.1 确认 add-manual-skill-whitelist 已落地：`src/core/shared/skill-generation.ts` 导出 `MANUAL_SKILL_DIRS` 且含 `opsx-archive-with-validation`，`cleanSkillSubdirectories` 跳过白名单目录

## 2. 手工技能文件

- [x] 2.1 新建 `skills/opsx-archive-with-validation/SKILL.md`（约 650 行，直接编辑，不进模板管线）：frontmatter 含 `name: opsx-archive-with-validation`、description（触发词：归档、验收、验收不过不准归档）、`version: 1.0`
- [x] 2.2 正文开头写标准路径声明段：涉及归档的请求默认走本技能，未经验收直接归档视为绕过标准
- [x] 2.3 编写 Phase 1 验收：逐检查项跑真实命令、附实际命令与输出摘要；不可执行记 `not_verified` + 原因；finding 必填 `gap_type`（missing/wrong/extra/unrequested）+ `source_ref`（代码 ↔ spec 双向锚点），缺字段判无效
- [x] 2.4 编写 Phase 2 修复与 Phase 3 复验：依据有效 finding 修、复验重跑 Phase 1、新 fail 回 Phase 2
- [x] 2.5 编写 Phase 4 归档与 verdict 汇总：verdict 三态 pass/fail/not_verified；任一 `not_verified` 或 `fail` → 整体不得 pass、不得归档；全 pass 才归档并在输出附最终报告
- [x] 2.6 编写报告尾强制未决清单：`not_verified`/`blocked`/`paused` 全入、标注来源轮次、同一事项连续 3 轮未决升级人工且第 3 轮起不再自动重试

## 3. 白名单与测试回归

- [x] 3.1 运行 `corepack pnpm generate:skills`（无需改模板源时至少验证清理不误删），确认 `skills/opsx-archive-with-validation/` 在再生成后原样保留
- [x] 3.2 运行 `test/core/templates/skillssh-generator-guards.test.ts` 与 parity 套件，确认白名单保留行为与 12 个生成技能比对全部通过
- [x] 3.3 确认 `git status` 显示 `skills/openspec-*/` 无内容变化

## 4. 校验与提交检查点

- [x] 4.1 运行 `openspec validate add-archive-with-validation-skill --strict`（仓库 CLI：`node ./bin/openspec.js`）
- [x] 4.2 git 提交检查点实战：以 `proposal: add-archive-with-validation-skill 验证式归档` 提交本变更产物与手工技能文件，确认单个 commit 含白名单基建假设说明、可独立回退（若 `.git/info/exclude` 已生效需 `git add -f`，见 add-openspec-exclude-discipline）
