# 骨架仓纯中文门参考件实施清单

## 1. 参考件编写（交付物在本变更目录内）

- [x] 1.1 `artifacts/skeleton-check.ps1`：⑦ 纯中文门——参数（`-ProjectRoot`/`-IncludeArchive`）、三档判定（FAIL/WARN/PASS）、归档日期前缀剥离、`.legacy-dirs.json` 只读读取、退出码约定（0 = PASS 允许含 WARN，1 = FAIL）、头部「参考件——属公司骨架仓」声明与字符集单一来源声明
- [x] 1.2 `artifacts/log1-init.ps1`：Merge 模式探测段——非纯中文目录探测（changes 不含 archive + specs）、清单整体重写/清零删除语义、判定正则与 ⑦ 门同源、骨架仓插入点说明、头部参考件声明
- [x] 1.3 `design.md` 契约固化：三档语义表、`.legacy-dirs.json` 字段契约（version/generatedAt/note/dirs）与整体重写语义、纯中文判定口径（与校验层并集字符集的边界：创建合法 ≠ 纪律合规）、字符集单一来源声明
- [x] 1.4 语法自检：实施环境无 pwsh 时记录「骨架仓落地时首跑验证」（见 2.3）；有 pwsh 环境时跑 `pwsh -NoProfile -Command "[scriptblock]::Create((Get-Content -Raw artifacts/skeleton-check.ps1)) > $null"` 类解析检查

## 2. 交接清单（复制到骨架仓后执行；骨架仓验收前本目录参考件保留）

- [ ] 2.1 将 `artifacts/skeleton-check.ps1` 并入公司骨架仓 `skeleton/scripts/skeleton-check.ps1`（作为 ⑦ 门，编号与 ①-⑥ 门清单对齐），落地后以骨架仓版本为准；确认头注释「参考件」声明按骨架仓规范调整
- [ ] 2.2 将 `artifacts/log1-init.ps1` 的探测段（`Update-LegacyDirsManifest` 函数与判定正则）并入骨架仓 `skeleton/log1-init.ps1` Merge 分支（插入点见文件尾「骨架仓并入说明」），日志函数按骨架仓实际函数名替换
- [ ] 2.3 在骨架仓跑通三档验证：构造新违规英文目录 → ⑦ FAIL（退出码 1）；构造含标记的 `.legacy-dirs.json` → WARN 豁免；全中文目录 → PASS（退出码 0）；验证 Merge 重跑后治理完的目录从清单消失、清零时清单文件被删除
- [ ] 2.4 骨架仓验收通过后**删除本变更目录内 `artifacts/` 参考件**（design.md 契约保留作历史锚），在本条勾选并注明落地日期与骨架仓提交号；确认 OpenSpec 侧无任何文件残留引用 artifacts/ 路径
- [ ] 2.5 随参考件使用说明交付环境配置：公司环境统一 `git config core.quotepath false`（中文路径在 git 输出中显示原文而非八进制转义；纯显示层配置，非代码改动）

## 3. 校验与提交检查点（本变更零 src/、零模板、零 spec delta——再生成三命令不适用）

- [x] 3.1 运行 `node ./bin/openspec.js validate add-skeleton-chinese-gate-reference --strict --type change`（确认 `skip_specs: true` 生效：零 spec delta 校验通过）
- [x] 3.2 批量 `node ./bin/openspec.js validate --changes`，记录结果（上游存量 `add-global-install-scope` 预期仍失败，与本批无关）
- [x] 3.3 git 提交检查点：本变更产物（.openspec.yaml、proposal.md、design.md、tasks.md、artifacts/）以 `proposal: skeleton-chinese-gate-reference 检查层参考件` 提交，单个 commit 可独立回退；注意 `.git/info/exclude` 已排除 `openspec/`，收录本目录产物需 `git add -f`；实施阶段执行，提案阶段不提交
