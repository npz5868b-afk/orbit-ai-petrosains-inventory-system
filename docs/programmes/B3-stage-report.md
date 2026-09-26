# PAIR B — B3 RESOURCE FEASIBILITY REPORT

## TASK / STATUS

**B3 工程与读取链路验证：PASS；实际资源可行性仍 NEEDS VERIFICATION。** 本轮完成独立资源适配模块、材料候选及审阅契约、原 B2 联通、测试和审计。已停在 B3 审核，没有进入 B4 API、B5 前端或 LLM。

**B0 保持 PARTIAL。** 继续使用无 `.git` 的源码副本，不能确认分支、HEAD 或远程同步。本轮未 Git 初始化、提交、推送、合并，也未启动／重启后端、迁移或操作数据库。没有升级依赖或修改 Stage 1 交易／扫描／CV／API 合约。

## INPUT SOURCE / 审核边界

- Main Work Package＋累计版 Addendum v1.2（Programme Twin: Judge-Proof Feasibility Rules）及 B2-R1 契约。
- 当前 B2-R1 基线包 SHA-256：`182021a6822db185b373ff52db9ff333ee2f818f7a9b81eb18377102abf221d1`，本轮前另保存了 293 个文件的哈希。
- B1 Programme workbook SHA-256：`10810eb3e4ed3fa3a2cb94c828fa7965fbe4a03370157bc5b4a7ab9a705b5d4e`。本轮实际使用生成的 B1 JSON，未重新跑原 Excel 导入；6 个 manifest 产物哈希核对一致。
- 项目库存源文件 `backend/data/inventory_catalog.json`：109 条，SHA-256 `c8b0fa49a42116bbae54f341f023441e8fa3522976001b95b3a2280ce5708639`。保留为种子／源码记录，不称现场盘点。
- 读取 `backend/app/database.py`、`main.py`、`domain.py`、`seed.py`、`lib/api-client.ts` 与 `official-catalog.ts` 核对数据结构；没有导入或运行会初始化数据库的 Python 应用。
- Operator 对 B2-R1 独立复跑的是 **109 项运行测试**、8 个修改文件 before/after 哈希，以及 11 组示例逐字节一致。Operator 未独立完成 AST 源码检查／严格 TypeScript／ES6；Builder 上轮 110 项及编译记录保留，两者不合并称独立全量复验。本轮 Builder 自己运行 152 项，不代表 Operator 已审核 B3。

## REAL READ / 真实读取结果

默认本地后端确实已运行。通过本轮 `readInventory` 模块的实际 transport 调用：

`GET http://127.0.0.1:8000/api/inventory?limit=250&offset=0 → HTTP 200`

读取完成时间 `2026-09-26T03:04:31.845Z`，返回 109 条、total=109，一页完整读取。原始响应经 schema 校验、资源适配、B1 材料候选匹配，再传入原 evaluatePlan，生成真实读取审计文件。**这证明本机只读适配链路可运行，不证明生产部署、现场实物、库存已盘点或未来预约可用。** 没有声称当前进程的 Git 基线与本 ZIP 相同。

按 id 比对 sku/name/base_unit/available_quantity/total_quantity/store_id，当前真实响应与项目种子文件差异记录数为 **0**。一致也不能证明已完成现场盘点；来源身份和是否仍为 seed 状态需 Operator 确认。available_quantity 已扣除 Stage 1 借出操作，B3 不再减 checked_out_quantity；updated_at 原值保留，不用于填写 observedAt。

## IMPLEMENTATION / 证据与核心联通

1. `inventory-adapter.ts` 将异步 GET 读取与纯数据转换分开，明确 endpoint、namespace、读取时间和 origin；读取失败不静默换成种子数据。原始字段保留。多页读取有完整性保护，但现有 API 没有快照 revision token，不能声称跨页原子一致。
2. `adaptInventory` 分离 raw record、currentQuantity 与 eventQuantity。库存 API 没有盘点、未来预约证据，因此实际读取生成的 109 个 currentQuantity 与 eventQuantity 全部为 pending/null。独立 StockReview 需要 id/SKU、单位、方法、具名来源和时间。
3. `adaptResources` 只输出 exact candidate，不因同名自动批准；人工 exact/alias 事实、规格、单位、包装换算、usage basis、kind、reuse/reset 分开检查。无法解释的量留空，不从 conversion_to_base=1 或 80 packs 推导。
4. 同一安装 namespace＋SKU 形成同一 poolId，跨活动共享；不按名称合并不同 SKU，拒绝重复身份与额外 inventory 池绕过。人员、房间、预约与安全不自动创建。
5. 生成现有 Evidence 输入，evaluatePlan / recommend / whatIf 继续使用原分组、库存数量、共享占用、重用与 Plan B 检查。B3 材料报告消费这些 Check，不复制一套可行性算法。
6. Fact 增加**可选 availableFrom**，将真实事件可用区间与 observedAt 分开，配合 validUntil 验证提前 setup 到最终 reset。单位证据的来源和到期时间也随转换 Fact 进入核心；不会在适配后丢失限制。这是既定资源时段规则的最小实现补充，Stage 1 合约和旧 Fact 行为不变。

完整接口和调用方式见 B3-resource-contract.md。新模块直接按其文件入口导入，无需修改共享 API client、Next 路由或导航。

## CHANGED FILES

相对审核通过的 B2-R1：**新增 9 个文件，修改 3 个，删除 0**，均属 Programme 独立路径。

| 相对源码根目录路径 | 类型 | 用途 |
| --- | --- | --- |
| `lib/programmes/types.ts` | 修改 | Fact 增加可选 availableFrom，不改变 Stage 1 DTO |
| `lib/programmes/evidence.ts` | 修改 | 资源事件占用检查可用起点，保护提前 setup |
| `docs/programmes/B2-core-contract.md` | 修改 | 记录兼容的可用区间起点语义与 B3 文档入口 |
| `lib/programmes/inventory-adapter.ts` | 新增 | 真实原始 API／文件快照校验、GET 分页及库存证据适配 |
| `lib/programmes/resources.ts` | 新增 | 材料候选／具名审阅转换、共享身份、B2 材料解释报告 |
| `backend/data/programmes/material_inventory_mappings.json` | 新增 | 275 行来源完整的静态候选／unresolved 审计，零自动批准 |
| `tests/programmes/resources.test.cjs` | 新增 | 42 项 B3 行为与读取测试，模拟证据均 synthetic |
| `tests/programmes/run-resource-tests.cjs` | 新增 | 严格编译后一起运行原 B2 与 B3 测试 |
| `tests/programmes/audit-resources.cjs` | 新增 | 静态可复现审计与显式实际 GET 审计工具 |
| `docs/programmes/B3-resource-contract.md` | 新增 | 入口、输入证据、单位／时段／身份与状态契约 |
| `docs/programmes/B3-material-mapping-audit.md` | 新增 | 22 条候选和全部 275 条待确认清单 |
| `docs/programmes/B3-stage-report.md` | 新增 | 本阶段报告与验证边界 |

没有修改 B1 的原始 7 个 JSON、导入器或 Python 测试；`material_inventory_mappings.json` 是新建审计文件，不在 B1 manifest 的原数据产物内。B1 基线 267 个文件和原 ZIP 246 个文件全部字节不变。`.test-tmp/programmes-core` 编译产物单独列出，不装入源码交付包。

## MATERIAL MAPPING / UNRESOLVED DATA

| 项目 | 数量／结论 |
| --- | --- |
| 库存记录 | 109 |
| 保留 ACT 材料行 | 275 |
| 同名 exact candidate 行／链接 | 22 / 22 |
| 已审阅 verified exact / verified alias | 0 / 0 |
| unresolved 行 | 275 |
| 保留歧义行 | 21 |
| 独立验证当前数量／未来数量 | 0 / 0 |
| 实际材料状态 Sufficient / Insufficient / Unknown | 0 / 0 / 275 |

名称候选包括 ACT-009:r12 与 ACT-010:r10 的 Breadboard → E004；它们尚未完成规格和用途确认，不能直接成为两个可用资源池。全部 22 个候选及 275 行清单见 B3-material-mapping-audit.md；完整原始字段和来源见 JSON。没有提供人工 alias，所以没有生成任何 alias 批准。

材料报告 scope 明确为 `event_programme`：Sufficient 表示本计划相关材料/资源检查通过，不等于安全／整体目标通过；Insufficient 保留已知不兼容或短缺原因；Unknown 表示映射、规格、量、单位、时段或证据不足，**不是库存为零**。同时显示原始数值、当前验证 Fact、未来 Fact、来源、时间和下一步。

## TESTS / 准确命令与结果

从源码根目录运行：

```powershell
$env:ORBIT_TYPESCRIPT_PATH='C:\Users\User\Documents\Codex\2026-09-10\du-y\orbit-ai-petrosains-inventory-system\node_modules\.pnpm\typescript@5.7.3\node_modules\typescript\lib\tsc.js'
node tests/programmes/run-resource-tests.cjs
node $env:ORBIT_TYPESCRIPT_PATH -p tests/programmes/tsconfig.core.json --target ES6 --module ESNext --moduleResolution Bundler --noEmit
node tests/programmes/audit-resources.cjs --evaluated-at=2026-09-26T03:03:40.296Z
node tests/programmes/audit-resources.cjs --live-api=http://127.0.0.1:8000/api --output=..\..\..\outputs\PAIR_B_B3_LIVE_RESOURCE_AUDIT.json
```

| 执行 | 实际结果 |
| --- | --- |
| 原 B2 回归与 B3 一起运行 | exit 0；152 通过、0 失败、0 跳过（B2 110＋B3 42） |
| runner 内 TypeScript 5.7.3 strict/noUnusedLocals/noUnusedParameters、无 DOM/Node 全局 | exit 0 |
| ES6／ESNext／Bundler noEmit 兼容检查 | exit 0，无诊断 |
| 固定显式时间的静态审计连续生成两次 | exit 0；逐字节一致 |
| 新 readInventory 真实本地 GET＋适配＋核心评估 | exit 0，HTTP 200，109 记录，无量／映射／预约批准 |
| B1 6 个数据产物、267 个基线文件、246 个 ZIP 文件哈希 | 全部一致 |

测试覆盖：同名规格冲突／规格未知、alias 缺审阅人、精确名称不能冒充 alias、未知包装、已验证 10 units/box 的换算、未知 80 packs 基准、seed/API/updated_at 不提升证据、过期库存、当前有货未来未知、共享 SKU 禁止／未知／允许重用、耗材跨活动累计、不同 SKU 同名不合并、提前 setup 与最终 reset 的可用时段、单位证据过期、重复身份／分页错误、Plan B 改选另一个已验证 SKU、供应仍够时保持原方案、纯转换确定性与不修改输入。

静态审计时间是明确传入的可复现评估标记，不是官方更新／发布时间；真实读取日志单独记录实际完成时间。所有模拟库存、物资审阅、人员、房间和批准仅存在测试中，没有写入运行默认数据。

## RISKS / 尚未验证

- 109 条接口记录是否经过实际盘点、是否仍为 seed，无法从响应推断；当前记录与种子一致不代表验证完成。
- 275 条材料仍需人工确认，包括 21 条歧义行；22 条候选不能替代规格、包装、usage basis、分类与重用审批。
- 未来 availability、facilitator、room、安全批准来源仍缺；本轮不伪造这些数据，也不新建预约系统。
- 适配器验证证据结构、具名记录和时段，不认证人员签署权限或记录真实性；授权数据提供者仍须审核。不同 namespace 或不同 SKU 指向同批实物的上游数据错误也不能靠名字自动识别。
- 实际验证仅为当前本机只读链路；没有生产部署、现场运营、认证链路、Stage 1 全量运行回归、浏览器或 Next 构建验证。B1 工作簿测试本轮未重跑。
- 无 `.git`，不确认分支／HEAD／远程同步；B0 继续 PARTIAL。离线仍仅为后续已加载页面的本地计算，不声称冷启动或刷新恢复。

## NEXT / STOP

**完成 B3 后停止，等待本阶段审核。** 请以修订包、before/after 哈希、152 项测试日志、真实读取日志及完整未解决项清单审核。没有开始 B4、B5 或 LLM。待审核后再决定 API 接入；真实盘点／预约与材料审阅证据缺失继续可见，不能由代码替运营方批准。
