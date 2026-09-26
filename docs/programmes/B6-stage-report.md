# PAIR B — B6 SCENARIO TESTS REPORT

## TASK / STATUS

**B6 已完成，待阶段审核；B0 继续 PARTIAL。** 五场景以9个官方目录输入变体、隔离synthetic资源全流程、实际HTTP和页面操作交叉核验。修复两个场景暴露的问题及已授权participant-led文案。没有进入B7、Git初始化/提交/推送/合并、部署或LLM。

## INPUT SOURCE / 审核边界

- 继续使用Main Work Package、完整累计版Addendum v1.2（Judge-Proof Feasibility Rules，13节，Section12含14项案例）、B2-R1/B3/B4/B5契约。未扩展规格。
- B5审核：Operator核对代码/哈希/桌面移动截图并复跑210项检查（209运行+客户端依赖图）。TypeScript源码检查、构建、backend、HTTP、浏览器记录各保留Builder来源。本轮下列新增执行记录同样是Builder来源，不称Operator独立复验。
- B5交付包SHA-256：`128997053d50dfdd4c8c9ab84bbedfc749a5aa4f92d33bb946ec136f38f733a1`。本轮开始保存308个源码文件baseline与before副本；无.git，不能由ZIP确认branch/HEAD/clean/remote状态。
- B1运行JSON：21正式offering、12约束、25待验证主题映射、275材料行及21歧义行保持原样；6个manifest产物哈希再次吻合。Excel源SHA-256 `10810eb3e4ed3fa3a2cb94c828fa7965fbe4a03370157bc5b4a7ab9a705b5d4e`，本轮未重新读取Excel，不伪称新做原始工作簿审计。

## SCENARIOS / DATA AUDIT

完整矩阵在 `B6-scenario-matrix.md`，14项规则覆盖在 `B6-acceptance-map.md`。完整输入和全部结果在交付JSON，含每个检查、材料、源位置、时间、下一步与trade-offs。A类真实运行未获批准的运营证据始终Unknown；B类资源/人员/审批都是测试台账，仅供计算验证。

| 五场景 | 核心结果 |
|---|---|
| 200 secondary，Sustainability+Robotics、teamwork、180分钟 | 未补年龄；bounded搜索无合适方案。补12–14/电力yes指定001+019仍硬超时，270分钟下界；7组不自动等于7并行站 |
| 40 primary，Water+Creative Science，无电90分钟 | ACT-003 NEEDS VERIFICATION；原始年龄Unknown，显式7–11后可保留方案，材料8行Unknown |
| 500 public，Spectacular Chemistry，短窗口 | 窗口Unknown时ACT-021相关但critical覆盖待确认；不输出同样supporting-only Plan B。显式30分钟ACT-017下界120，NOT FEASIBLE |
| preschool/young，Arduino300类目标 | 原始缺失仍待验证；显式3–5岁触发14+硬失败；无满足关键IoT目标的替代 |
| 多主题，资源不可用 | A类未批准声明仍Unknown；隔离B类确认Solar Fan资源0后原方案失败，001+018替代重新检查且保留两critical主题，trade-off明确 |

页面所有主要场景与API正式ID/状态/理解/材料/Plan B一致。S2原方案保留、S4硬失败无替代、旧结果OUT OF DATE、库存不可达与Programme API停机、停API后的已加载页面P41本地计算均实际操作验证。原始S1无方案时也显示拒绝诊断及未知，不用空目录掩盖失败。详细源和截图见附件。

## DEFECTS / 最小修复

1. **关键主题缺乏充分依据仍进入Plan B**：S3的Spectacular Chemistry仅pending辅助映射，原recommend与hard-failure whatIf会给同样supporting-only替代。先写两个失败回归（RED日志），再要求替代保留每个critical目标的Master依据；相关pending主候选不被删除。原所有回归仍通过。
2. **无Plan B但What-if摘要让人查看Plan B**：实际S4页面发现。先增加失败回归（单独RED日志），再传入实际alternative生成提示；有替代与无替代两边都覆盖。最终真实页面截图 `S4-age-hard-fixed` 已核对，原错误截图保留作修复前证据。
3. **已授权文案修正**：Require participant-led delivery / Required (hard constraint)，保持原硬约束。

## CHANGED FILES

共13文件：修改4、新增9，均Programme专属；没有修改新的共享文件。AppShell、package.json、pnpm-lock.yaml保持B5字节不变。

| 相对路径 | 用途 |
|---|---|
| `lib/programmes/engine.ts` | 修改：Plan B / hard-failure What-if 要求保留所有 critical 目标的 Master 依据；相关待验证 primary 仍可展示 |
| `lib/programmes/local.ts` | 修改：comparePlans 接收可选 alternative，缺少 Plan B 时不声称已有替代 |
| `components/programmes/consultant.tsx` | 修改：Require participant-led delivery；向结果提示传递真实 Plan B |
| `components/programmes/results.tsx` | 修改：Request Understanding 明确 Required (hard constraint) |
| `tests/programmes/scenarios.json` | 新增：五场景九个 A 类输入、明确测试设定及优先级 |
| `tests/programmes/scenario-evidence.cjs` | 新增：隔离 B 类合成运营台账；原始官方目录和材料行不改 |
| `tests/programmes/run-scenarios.cjs` | 新增：九个场景 HTTP/核心一致性及资源全流程不变量 |
| `tests/programmes/scenario-regression.test.cjs` | 新增：三个实际缺口回归，含 Plan B 正向措辞边界 |
| `tests/programmes/run-b6-tests.cjs` | 新增：沿用现有编译器和 Node test，运行 B2/B3/B4/B5 与 B6 回归 |
| `docs/programmes/B6-stage-report.md` | 新增：阶段报告、限制和文件范围 |
| `docs/programmes/B6-scenario-matrix.md` | 新增：五场景输入/输出索引、证据、不变量与实际矩阵 |
| `docs/programmes/B6-acceptance-map.md` | 新增：累计 v1.2 的 14 项规则与既有测试对应 |
| `docs/programmes/B6-demo-and-contract.md` | 新增：最小契约修正、命令、页面复现和现场离线补测 |

完整before/after哈希及字节数在 `PAIR_B_B6_DIFF.json`；4个已有文件补丁在 `PAIR_B_B6_EXISTING_FILE_DIFF.patch`；代码包是相对B5的增量，不是假造新仓库。304个既有B5源码文件字节不变。原ZIP除前阶段获批AppShell导航外的245文件继续字节不变。Stage1交易/扫描/库存/原API/CV和B1数据未修改。

## TESTS / 实际执行

| 类别 | 结果与边界 |
|---|---|
| 完整B2/B3/B4/B5/B6回归 | **214项检查通过 = 212运行测试 + 2源码检查**（纯核心平台依赖/AST检查、客户端依赖图）；0失败/跳过。B6新增3个实际缺口回归，其余沿用 |
| 严格core/API TypeScript编译 | runner内两套tsconfig通过，TS5.7.3 |
| 项目typecheck / 核心ES6 | `tsc --noEmit`及指定target ES6均exit0；无输出日志为成功 |
| Webpack生产构建 | 最终修改后exit0，Programme页面/API路由生成；默认Turbopack仍保留旧限制 |
| 官方场景 | 9个直接本地集成 + 9个真实HTTP均通过，HTTP每例200，完整核心输出比对一致 |
| B类资源全流程 | 原方案足量/短缺/关键目标保留替代/保留原方案/共享SKU重用/并行能力/无等价替代/synthetic handler拒绝全部通过；没有把这些另计为214个Node测试里的条目 |
| 真实HTTP smoke | 10项通过；故障注入是不可达库存依赖；不是物理断网 |
| 真实IAB页面 | 五主要场景及上述变体、最新输入、模式切换、错误降级/本地重算、修复后提示均记录；全部为Builder操作 |
| 14条验收 | 映射已有回归，仅补关键覆盖与误导摘要缺口；不堆14个重复测试 |

准确命令、启动/复现与现场补测见 `B6-demo-and-contract.md`、`PAIR_B_B6_COMMANDS.md`。RED日志故意exit1，GREEN最终日志214通过；不能把修复前失败混称未解决失败。本轮未重新运行backend20测试，因为Stage1无变更；其前阶段Builder记录仍独立保留。

## RISKS / UNRESOLVED

- Git基线未验证，B0 PARTIAL；后续由Pair A在真实checkout对齐基线和审阅补丁。
- 真实盘点、材料alias/规格/单位/usage basis/重用/reset、人手/场地/日期预约、安全批准仍未获得。updated_at、成功HTTP、种子标签均不能代替证据。
- 所有主题映射To be validated；Data_Confidence=High不批准Notes中的草稿数值。Plan B的Master支持也只是目录相关性依据，不等于活动已获运营确认。
- 场景仅bounded搜索，序列活动块/平衡组/受约束通道；无解不等于所有排程形式不可行，未擅自缩短官方活动。
- 浏览器能力未提供网络离线模拟；offline/online事件分支、物理断网待现场补测。只验证页面已加载后计算，不支持断网冷启动/刷新恢复；本地不保留已批准运营证据。
- 默认Turbopack既有问题未修；本轮仅Webpack。未重复B5完整移动设备/辅助技术矩阵；截图为本机IAB桌面。

## NEXT

**停在B6审核。** 审阅增量包、两类场景证据、14项映射及最小修复。未开始B7、提交、部署或合并。
