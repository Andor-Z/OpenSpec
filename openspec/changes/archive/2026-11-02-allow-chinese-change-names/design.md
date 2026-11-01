# 设计：change 名专用正则与字节化长度校验

## Context

`validateChangeName`（`src/utils/change-utils.ts:67-107`）现状复用共享语法源 `isKebabId`（`src/core/id.ts:5` 的 `KEBAB_ID_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u`），长度按字符数（`name.length > 200`），错误分支全是 ASCII 假设。全仓库真实调用仅 2 处（`new-change.ts:129` 入口、`change-utils.ts:137` 内部二次校验），`instructions`/`status`/`archive`/`show`/`list` 按目录名直接查找不校验 change 名——改这一处语法源即覆盖全部创建入口。本 design 记录四个需要技术取舍的决策与一组防误改证据。

## Decisions

### 1. 专用正则取并集而非替换

- 若写成替换式 `[\p{Script=Han}-]+`，`100-add-feature` 这类编号前缀名立即非法——它们是已测行为（`100-add-feature`、`00001-add-auth`、`101-01-fix-auth`、`100` 四条既有用例）+ 常用排序习惯。
- 归档名 `2026-01-02-修复会话过期` 的形态依赖「任意段 + 连字符分段」结构（`src/core/archive.ts` 先测 `ARCHIVE_DATE_PREFIX_PATTERN` 再拼接，对中文目录名无 ASCII 假设）。
- 并集 `[\p{Script=Han}a-z0-9]` + 连字符分段结构（`(?:-…)*` 保留禁止首尾/连续连字符）同时保住两者，且英文 kebab 名依然合法（引导层「优先中文非禁止英文」的前提）。
- `u` 标志必须加：`\p{…}` Unicode 属性转义只在 `u` 模式下生效。

### 2. 长度上限 220 字节（Buffer.byteLength）

- 现状按字符数在中文下失真：85 汉字 = 255 字节即达文件系统目录组件上限，mkdir 抛 ENAMETOOLONG 裸崩，绕过校验层的友好报错。
- 推导：255（目录组件上限）− 11（归档日期前缀 `YYYY-MM-DD-`，校验的是 change 名本身，归档后实际目录为 `<name>` + 11 字节 ≤ 231）= 244；再留 24 字节余量防深嵌套路径层叠（Windows 260 总长约束下更敏感）。
- 220 字节 ≈ 73 个汉字（73×3=219，边界内）或 220 个 ASCII 字符；74 汉字 = 222 字节 > 220 拒绝。错误文案注明「UTF-8 字节数，中文每字占 3 字节」。

### 3. 错误分支按新字符集重写，共享文案不动

- 现状细分分支 `/[A-Z]/`、`/\s/`、`/_/` 对纯中文名永远 false，全部掉进兜底 `/[^a-z0-9-]/` → 兜底文案「only lowercase letters, numbers, and hyphens」对中文用户误导。
- 重写：大写/空格/下划线/首尾连字符/连续连字符的判定与文案保留（与语言无关，对中文名同样可能命中，如 `修复-Session`）；兜底分支正则放宽为 `/[^\p{Script=Han}a-z0-9-]/u`；总结文案改述并集字符集（允许中文、小写字母、数字、连字符）。
- `KEBAB_ID_DESCRIPTION` / `KEBAB_ID_FIX`（`src/core/id.ts:28-33`）服务 store/workset 报错——**不动**，避免污染内部 id 错误提示；change 名错误文案独立成套。

### 4. commands/schema.ts 不动的证据（防后人误改）

- `src/commands/schema.ts:253` 独立正则 `/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/`：**首段必须字母开头、不接受数字开头**，与 `KEBAB_ID_REGEX`（数字开头允许）不同，也与本变更的新正则不同。
- 它校验的是 workflow schema 名（模板/目录/registry 键），使用点 `schema.ts:770/774`、`:1026/1030` 的报错「Use kebab-case (e.g., my-workflow)」是 schema 名语境；`src/utils/change-metadata.ts:119-130` 的同名函数 `validateSchemaName` 是存在性校验，非格式校验。
- 结论：本变更与第二阶段映射表（configurable-naming-language）都不统一它——schema 名继续 kebab，中文 schema 名不被支持也不需要被支持。

### 5. 归档与排序无需修改（证据）

- 归档：`archive.ts:57` `ARCHIVE_DATE_PREFIX_PATTERN = /^\d{4}-\d{2}-\d{2}-/`、`:1662-1664` 先测后拼 `YYYY-MM-DD-<name>`，纯字符串拼接——中文自然成立。
- 排序：`list.ts:194`、`view.ts:136/145/147` 均为 `localeCompare`，中文正常参与。
- 路径拼接：`change-utils.ts:163` `path.join(...)`，无 ASCII 转换；`id.ts:40-56` `folderStyleNameProblem` 只拦路径分隔符与 `.`/`..`，不拦 Unicode。
- 不修项：`list.ts:229/235` 与 `view.ts:45-53` 的 `.length`+`padEnd` 列宽（UTF-16 length ≠ 显示宽度 2）——纯视觉、specs 列表同病、改则扩散面大，登记为后续候选（East-Asian-width 计宽）。

## Risks / Trade-offs

- **既有测试语义反转**：`'a'.repeat(200)`/`'a'.repeat(201)` 在字节语义下（201 字节 ≤ 220）由一绿一红变两绿——必须同步重写为字节边界用例，否则测试失去守护意义（见 tasks 2.1）。
- **git 中文路径显示为八进制转义**（`core.quotepath` 默认 true）：纯显示层，统一 `git config core.quotepath false` 一次性配置；非代码改动。
- **Windows 路径总长 260**：中文名 + 深嵌套更早触顶——字节上限 220 已按组件约束；总长问题与本改动正交，测试按仓库跨平台纪律用 `path.join` 构造期望路径。
- **APFS NFD 归一化**：常用 CJK 统一表意字不受影响；本正则不允许组合变音字符，无 NFC/NFD 双拼写问题。
