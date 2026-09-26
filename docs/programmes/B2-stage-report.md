# PAIR B — B2 REVISION REPORT (B2-R1)

## TASK / STATUS

**B2 修订实现与本地计算验证：PASS；等待 Operator 修订审核。** 三个复现场景先建立失败回归测试，再修复。最终 110 项通过、0 失败、0 跳过；严格 TypeScript 与 ES6 兼容检查通过。这不是活动运营审批，也不表示下一阶段已获授权。

**B0 继续保持 PARTIAL。** Git 基线未验证，源码副本无 `.git`，未执行初始化、提交、推送、合并或切换分支。原始 Excel 在 B1 的 Builder 导入记录与本轮 JSON 校验是不同证据；本轮没有重新核验原工作簿，也没有将它写成 Operator 独立复验完成。

范围为现有 TypeScript 纯核心及测试／文档；没有 B3、API、前端或规格扩展。没有增加依赖、修改 package.json / pnpm-lock.yaml，亦未启动服务、操作数据库或改动 Stage 1。

## INPUT SOURCE

- 当前经审核的 B2 独立源码副本，沿用 Main Work Package＋完整累计版 Addendum v1.2，副标题 Programme Twin: Judge-Proof Feasibility Rules（13 节、Section 12 的 14 个验收案例）。
- B1 原 JSON 保留；workbook 来源 SHA-256：`10810eb3e4ed3fa3a2cb94c828fa7965fbe4a03370157bc5b4a7ab9a705b5d4e`。manifest 所列 6 个数据文件本轮再次按字节核对一致。
- Operator 本次给出的 3 个 synthetic 复现场景；fixture 中库存、人员、场地、批准、预约证据均为 synthetic，未写入官方目录或默认演示数据。
- 历史验证范围保持：Operator 独立通过 B1 的 19 项合成测试及 6 个哈希；其 8 项工作簿测试因无 Excel 跳过。Builder 上轮 27 项记录保留，本轮不冒充重新复现。
- 本轮前 B2 包 SHA-256：`d1f22d0787414c329567f29accf929176576fe6f9ef2ed38e24d28f110aebc05`。已保留该包、原报告、原日志及源码快照哈希，便于审核前后差异。

## FIXES / 实际结果

| 问题与条件 | 修复后结果 | 保留的边界 |
| --- | --- | --- |
| Indoor 目录 + sheltered_outdoor，venueReady=true | NOT FEASIBLE | 场地准备批准不能改写目录限制 |
| 缺失／Unknown／N/A／待验证／含义不清的目录场地 | NEEDS VERIFICATION | 不以子串匹配猜测兼容性 |
| Indoor or sheltered outdoor + sheltered_outdoor | VERIFIED FEASIBLE（synthetic） | 具体场地、安全等检查仍独立执行 |
| 两活动各 30 人、同池 30 件、reuseApproved=false | NOT FEASIBLE | 即使时段不重叠，仍需 60 件全新器材 |
| 上述器材重用许可未知、仅 30 件 | NEEDS VERIFICATION | 不把未知变成许可；仍保留完整 reset 检查 |
| 上述禁止重用、60 件全新器材 | VERIFIED FEASIBLE（synthetic） | 足够全新器材无需重用 |
| 上述 30 件、重用与 reset 均验证 | VERIFIED FEASIBLE（synthetic） | reset 保留在时间表及资源占用区间 |
| ACT-901 并行无上限证据 + ACT-902 已验证一条 lane；90 人／80 分钟 | NOT FEASIBLE | ACT-902 的 99 分钟独立下界保留，ACT-901 未知项也保留 |
| 同组合窗口 136／137／138 分钟 | NOT FEASIBLE／NEEDS VERIFICATION／NEEDS VERIFICATION | programme 乐观下界为 35+3+99=137；达到下界不代表并行能力已确认 |

场地检查覆盖 indoor、outdoor、sheltered_outdoor、unknown。当前 B1 六种完整描述均被检查；一般 Outdoor 能否改为有遮蔽室外仍待验证，避免擅自放宽光照、空间或飞行条件。未知的新场地描述不会自动放行或当成已知不兼容。

器材检查在同一 pool 的所有 delivery 之间分配数量：先用已释放且允许重用的数量，再占用全新数量。重用链两端均需有效许可，前项 reset 必须完成；明确 false 禁止链接。分别计算“只用已确认重用/reset”及“未知条件获确认后的乐观情况”所需全新数量，和事件库存比较。任何乐观情况也不足则硬失败；只有依赖未知条件才足够则待验证。当前库存与未来事件数量仍为不同证据。半开占用区间检查继续独立验证人员、场地、设备及参与者冲突。

时间检查移除原全局并行未知开关。各活动先算 minimumRounds 和自己的 setup/delivery/reset 下界，再加前序活动释放与 transition，得到当前串行活动块方案下界。ACT-902 为 5+3×30+2×2=99；ACT-901 在完全未知并行时只证明至少一轮，不把展示的一条暂定 lane 用于判定无解。

## CHANGED FILES

相对上一版 B2：**修改 8 个交付文件，新增 0，删除 0**。均在已授权 Programme 路径；Pair A 共用入口／Stage 1 文件无修改。

| 相对源码根目录路径 | 本轮用途 |
| --- | --- |
| `lib/programmes/constraints.ts` | 覆盖所有请求场地枚举；明确不兼容与未知语义分别处理 |
| `lib/programmes/scheduling.ts` | programme 级器材分配／重用／reset；逐活动及整体时间下界 |
| `lib/programmes/types.ts` | ActivitySchedule 增加 minimumRounds 和两个时间下界字段 |
| `tests/programmes/core.test.cjs` | 保留原 54 项，新增 56 项 synthetic 回归／正向边界 |
| `tests/programmes/generate-examples.cjs` | 保留原 5 组并生成新增 6 组修订示例 |
| `docs/programmes/B2-core-contract.md` | 更新场地、跨活动重用、下界及验证契约 |
| `docs/programmes/B2-examples.json` | 当前核心实际生成的 11 组完整输入／输出 |
| `docs/programmes/B2-stage-report.md` | 本修订报告，保留全部验证边界 |

相对 B1：累计仍为 17 个新增 B2 文件，B1 既有文件修改 0、删除 0。B1 基线 267 个文件（含既有本地中间文件）全部哈希相同；原始 ZIP 246 个文件全部相同。被编译器更新的忽略目录 `.test-tmp/programmes-core/` 单独列在差异清单，不打包为应用源文件。

`PAIR_B_B2_REVISION_CHANGES.zip` 只包含本轮 8 个修改文件；`PAIR_B_B2_CHANGES.zip` 是相对 B1 的更新后完整 17 文件 B2 包。应用修订前应核对差异清单的 before 哈希，保留接收方已有改动；本轮没有自动覆盖任何别人的 checkout。

## CONTRACT / 受影响接口与示例

- `Request`、`Evidence`、`MaterialDemand` 输入形状不变；重用事实在 programme 层面被正确消费，不再只检查 rounds > 1。
- `ActivitySchedule` 增加三个数值输出：`minimumRounds`、`attendanceLowerBoundMin`、`operationalLowerBoundMin`。前者与未知并行时展示的 rounds 区分；参加下界可扣首项提前 setup，运营下界始终含 setup 与已知最终释放。它们是下界，不是已确认的可执行排程。
- 新检查 `equipment.<poolId>.allocation` 保留 Rule_ID=RULE-012、原因、来源、证据时间和行动；原 `checkIntervals` 仅检查同时占用，不能单独证明重用许可。
- 原 5 组示例（官方待验证、硬失败、Plan B、保留方案的 What-if、保留待验证状态）继续存在，新增 6 组修订示例，共 11 组。所有新增案例均 synthetic，完整输入、输出、来源保存在 `B2-examples.json`。

## TESTS / 准确命令与结果

在源码根目录运行，使用本机既有 Node v24.15.0 与 TypeScript 5.7.3；未安装或升级依赖。

```powershell
$env:ORBIT_TYPESCRIPT_PATH='C:\Users\User\Documents\Codex\2026-09-10\du-y\orbit-ai-petrosains-inventory-system\node_modules\.pnpm\typescript@5.7.3\node_modules\typescript\lib\tsc.js'
node tests/programmes/run-core-tests.cjs
node $env:ORBIT_TYPESCRIPT_PATH -p tests/programmes/tsconfig.core.json --target ES6 --module ESNext --moduleResolution Bundler --noEmit
node tests/programmes/generate-examples.cjs
```

| 执行 | 实际结果 |
| --- | --- |
| 首先增加 50 项回归／边界，尚未修复核心；运行 runner | exit 1；104 项中 74 通过、30 失败；三个 Operator 原场景均失败 |
| 修复后首次运行 | exit 0；104/104 通过 |
| 补充 6 项跨活动分配、reset、数量、下界输出及真实目录描述边界后的最终 runner | exit 0；110/110 通过、0 失败、0 跳过；原 54 项未改写 |
| runner 内 `tsc -p tests/programmes/tsconfig.core.json` | strict、noUnusedLocals、noUnusedParameters、仅 ES 库编译通过 |
| ES6 / ESNext / Bundler / noEmit 命令 | exit 0，无诊断；继承上述严格配置 |
| generate-examples 连续两次运行 | 均 exit 0；11 组结果符合断言、文件字节一致 |

最终示例 SHA-256：`c3b2d3f1a60ca5a6db1b8d753f3da3908952b49426a79c1c07e9cc8656ca3784`。

日志为 `PAIR_B_B2_REVISION_RED_TESTS.txt`、`PAIR_B_B2_REVISION_TESTS.txt`、`PAIR_B_B2_REVISION_COMPATIBILITY.txt`、`PAIR_B_B2_REVISION_EXAMPLE_GENERATION.txt`。字节审计和交付包校验由以下本地命令完成：

```powershell
# 从本任务外层工作目录运行；只装配交付与核对哈希，不访问数据库。
& 'C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' work/build_b2_revision_delivery.py
```

它核对所有 B1/原 ZIP 文件、6 个 manifest 哈希、原 54 项测试原文、仅 8 个授权源文件变化，以及 ZIP 解包字节一致。详细 before/after 哈希见修订差异清单；完整文本差异见 `PAIR_B_B2_REVISION_SOURCE_DIFF.patch`。

## UNRESOLVED DATA / RISKS

- Git 分支、HEAD、工作区与远程同步状态仍不能从本副本确认，B0 保持 PARTIAL。
- 未重新运行 B1 Excel/Python 测试、Stage 1 全量回归、服务／数据库、Next 构建或浏览器验证；Stage 1 未改变依据是逐文件字节核对，不能写成已做现场回归。
- 目录草稿、全部待确认可提供状态、辅助主题映射及材料歧义不因本轮修复变成已验证。synthetic 测试通过不代表真实库存、预约、人员、场地或安全获得批准。
- 排程仍为活动块串行、活动内并行轮换；器材分配在已生成时间表内计算。不穷尽任意交错、所有分组方式或额外调度策略；下界及失败结论限于此方案范围。
- 资源池身份、可互换性、重用批准适用范围、reset、规格和换算必须由后续证据适配确认。本轮未拉取真实库存，也未自动批准 alias。未知 reset/并行仍保留；展示的暂定时间表不能用作运营承诺。
- 离线目标仍限已加载页面的本地计算，没有验证断网冷启动或刷新恢复。

## NEXT

**停在 B2 修订审核，等待 Operator 检查修订包、红绿日志与示例。** 后续 B3 仍需获准后再接 ResourcePool / MaterialDemand / OfferingEvidence 的真实、有时间范围的证据；本轮没有开始 B3、API 或前端。
