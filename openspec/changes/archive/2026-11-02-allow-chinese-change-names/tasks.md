# change 名允许中文实施清单

## 1. 校验函数改造（src/utils/change-utils.ts）

- [x] 1.1 `validateChangeName` 脱离共享 `isKebabId`：模块级新增 change 名专用正则 `/^[\p{Script=Han}a-z0-9]+(?:-[\p{Script=Han}a-z0-9]+)*$/u`（`u` 标志必须带），替换 `:79` 的 `isKebabId(name)` 调用；`src/core/id.ts` 的 `KEBAB_ID_REGEX`/`isKebabId` 及其余 4 个消费方零改动
- [x] 1.2 长度校验字节化：`name.length > 200` → `Buffer.byteLength(name, 'utf8') > 220`；注释与错误文案更新为字节语义（255 目录组件上限 − 11 归档日期前缀 − 余量；中文每字 3 字节）
- [x] 1.3 非法字符分支重写：大写/空格/下划线/首尾连字符/连续连字符判定与文案保留；兜底 `/[^a-z0-9-]/` 放宽为 `/[^\p{Script=Han}a-z0-9-]/u`；总结文案改述允许字符集（中文、小写字母、数字、连字符）；`KEBAB_ID_DESCRIPTION`/`KEBAB_ID_FIX` 共享文案不动
- [x] 1.4 `src/core/id.ts` 仅更新头注释：声明 change 名自 allow-chinese-change-names 起可脱离共享 kebab 语法（store/initiative/workset id 不变）；`src/commands/schema.ts` 与 `src/core/archive.ts` 确认零 diff

## 2. 测试改造与新增（test/utils/change-utils.test.ts）

- [x] 2.1 重写长度用例为字节语义：220 个 ASCII 字符通过 / 221 个失败（断言错误含字节说明）；删除/替换 `'a'.repeat(200)` 合法与 `'a'.repeat(201)` 非法两条旧用例
- [x] 2.2 新增中文合法组：「修复会话过期」、`100-修复登录`（数字前缀）、`修复-session-timeout`（中英混合段）、`2026-01-02-修复会话过期`（归档日期前缀形态）、68 汉字（204 字节）、73 汉字（219 字节，边界内）
- [x] 2.3 新增中文非法组：`Fix_Session`（大写+下划线）、全角 `ＡＢＣ`（Script=Common 拒绝）、`修复 会话过期`（空格）、`修复--会话`（连续连字符）、74 汉字（222 字节，边界外，断言错误说明字节语义）
- [x] 2.4 回归既有用例：`add-auth`、`refactor`、`add-feature-2`、`upgrade-to-v2`、`100-add-feature`、`00001-add-auth`、`101-01-fix-auth`、`100`、大写/空格/下划线/特殊字符/首尾与连续连字符拒绝组、`createChange` IO 集成组全部继续通过
- [x] 2.5 `corepack pnpm test -- change-utils` 跑至全绿

## 3. 回归与校验（模板再生成：不适用——本变更不触 `src/core/templates/` 与 `skills/` 生成物）

- [x] 3.1 parity 回归：`corepack pnpm test` 中 `test/core/templates/` 套件确认零影响（如红先排查是否误触模板源）
- [x] 3.2 运行 `node ./bin/openspec.js validate add-allow-chinese-change-names --strict --type change`
- [x] 3.3 git 提交检查点：本变更产物（src/utils/change-utils.ts、src/core/id.ts、test/utils/change-utils.test.ts、openspec/changes/allow-chinese-change-names/）以 `proposal: allow-chinese-change-names 校验层` 为提交信息前缀提交，单个 commit 可独立回退；注意 `.git/info/exclude` 已排除 `openspec/`，收录本目录产物需 `git add -f`（见 add-openspec-exclude-discipline）；实施阶段执行，提案阶段不提交
