# 设计：检查层参考件契约

## Context

检查层是骨架铺设流程的一部分：公司骨架仓的 `skeleton/scripts/skeleton-check.ps1` 收录 ①-⑥ 各门（本仓库不可见，编号 ⑦ 从还原稿得知），`skeleton/log1-init.ps1` 在 Merge 模式下把 OpenSpec 约定合并进既有项目。本仓库（openspec-andor fork）无 `skeleton/` 目录，也无任何运行时挂点，故本变更以参考件形态交付两份 `.ps1` + 本契约，落地骨架仓后以骨架仓为准。本 design 是参考件与骨架仓真实版本之间防漂移的锚：骨架仓实现 MUST 满足本契约语义。

## Decisions

### 1. 参考件形态（形态 A），不做 fork 侧等价物（形态 B）

- 形态 B（fork 内 `openspec validate`/`doctor` 加目录名规则）会创造第二个政策源：骨架仓 ①-⑥ 门与本规则各说各话；`validate` 每次全量扫历史目录慢且吵；偏离还原稿的执行点设计。
- 若日后确需 fork 侧执法，`openspec doctor` 是自然归宿，登记为后续候选，本批不做。

### 2. 三档语义（⑦ 门的唯一判定契约）

| 档 | 条件 | 动作 |
|---|---|---|
| FAIL（新违规） | 目录名非纯中文 **且** 不在 `.legacy-dirs.json` 豁免标记内 | 拦：骨架铺设失败，输出违规目录清单与修复提示 |
| WARN（存量豁免） | 目录名非纯中文 **但** 在 `.legacy-dirs.json` 标记内 | 放行 + 提示 owner 待治理（含标记文件路径） |
| PASS | 扫描范围内目录名全部纯中文 | 放行 |

- 退出码约定：0 = PASS（允许含 WARN）；1 = 存在任一 FAIL。
- 扫描范围：`openspec/changes/*`（**不含** `archive/`——历史归档由治理流程处理，可用 `-IncludeArchive` 开关纳入）与 `openspec/specs/*`。

### 3. `.legacy-dirs.json` 契约

- 路径：`openspec/.legacy-dirs.json`（项目内、OpenSpec 目录树下）。
- 由 `log1-init.ps1` Merge 模式探测既有英文 kebab 目录时写入；`skeleton-check.ps1` ⑦ 门只读。
- 字段：

```json
{
  "version": 1,
  "generatedAt": "2026-11-02",
  "note": "以下目录为 Merge 探测发现的存量英文命名目录，owner 治理（改中文名）后从清单消失；清单为空或文件删除后 ⑦ 门恢复严格。",
  "dirs": [
    { "path": "openspec/changes/fix-session-timeout", "name": "fix-session-timeout" },
    { "path": "openspec/specs/user-auth", "name": "user-auth" }
  ]
}
```

- 写入语义（log1-init Merge 段）：每次 Merge 运行**重新探测并整体重写**清单——治理完（改名/删除）的目录下次探测自然消失；探测为零且存在旧清单时**删除清单文件**，门恢复严格。不做增量合并、不做手工编辑保留（豁免状态必须与探测结果一致，防清单变永久白名单）。
- owner 治理完删标记（或改完后重跑 Merge 自动清除）→ 门恢复严格，即还原稿「豁免标记可撤销」语义。

### 4. 纯中文判定口径（门比校验层更严，边界明示）

- 门是**公司纪律层**：剥离归档日期前缀 `YYYY-MM-DD-`（archive 生成的结构前缀，非用户命名）后，目录名有效部分必须全为汉字，允许连字符作分段分隔（沿用 kebab 分段习惯）——ASCII 字母与数字视为非纯中文。
- 与校验层的关系：校验层（allow-chinese-change-names）管**合法性下限**（并集 `[\p{Script=Han}a-z0-9]`，编号前缀 `100-修复登录`、中英混合 `修复-session` 合法可创建）；检查层管**公司纪律**（纯中文），对此类名称照样报警治理。两层互补：创建不拦（校验层放行即合法），铺设自检时提示收敛（纪律层收紧）。此边界写进两份参考件头注释，防「为什么 `100-修复登录` 能创建但门报警」的误判。
- **字符集单一来源声明**：目录名汉字判定以 OpenSpec naming 配置映射表（configurable-naming-language 提案的 `CHARSET_MAP`，zh-CN → `\p{Script=Han}`）为准；.NET 正则以 CJK 统一表意文字区段近似（`\u3400-\u9FFF`，覆盖 URO + 扩展 A）。OpenSpec 映射表如扩容（如日文假名键），骨架仓门判定需同步评估。

### 5. 交付形态与验证边界

- 参考件在本仓库**不可运行验收**（无 skeleton/ 目录、无 Windows CI 门），语法级检查可用（如本机有 pwsh；本批实施环境无 pwsh，首跑验证在骨架仓落地时进行，见 tasks 交接清单）。
- 参考件头部 MUST 保留声明：「参考件——属公司骨架仓，随 allow-chinese 系列提案分发，落地到骨架仓后以骨架仓为准」。

## Risks / Trade-offs

- **参考件与骨架仓真实版本漂移**：本仓库内参考件是「死代码」，无人维护会腐烂。
  → 缓解：design.md 契约 + 脚本头注释双锚定；tasks 交接清单要求骨架仓验收后**删除本目录参考件**（契约文本保留作历史锚），消除双源。
- **`.legacy-dirs.json` 被滥用为永久白名单**：手工编辑清单可让新违规混入豁免。
  → 缓解：清单只能由 log1-init Merge 段整体重写（探测为准）；skeleton-check 对标记内目录仍输出 WARN 提示，治理可见。
- **Windows 编码**：`.legacy-dirs.json` 与控制台输出涉及中文，PowerShell 5.1 默认编码差异可能导致乱码。
  → 缓解：参考件内统一 `utf8` 读写与 `[Console]::OutputEncoding` 设置，骨架仓落地时在目标环境实测。
