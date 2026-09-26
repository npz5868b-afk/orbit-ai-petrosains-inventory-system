# B6 — 累计版 v1.2 的 14 项验收覆盖映射

依据实际读取的完整累计版 `AIIC_Finals_PAIR_B_Operator_Addendum_v1_2 (1).md`，副标题 **Programme Twin: Judge-Proof Feasibility Rules**，Section 12 的 `Additional v1.2 acceptance tests`。下表编号为该表顺序，不是新增 Rule_ID；官方仍是原来的 12 个 Rule_ID。

下列测试均在本轮 214 项检查中运行通过。沿用已有测试，只补三个场景发现的缺口；不把 14 个表项另算 14 项新测试。除明确的原始目录断言外，运营事实为隔离 synthetic，不表示现场批准。

| # | 累计版验收案例 | 预期不变量 | 实际测试位置与名称 | 场景 / 补充说明 |
|---|---|---|---|---|
| 1 | 已知超时 + 未知未来预约 | NOT FEASIBLE，同时保留预约未知 | `tests/programmes/core.test.cjs:192` — Known duration failure wins over critical unknown and retains both check results | A1 指定组合 / A3 30 分钟；hard failure 与未知共存 |
| 2 | 未知必需 facilitator + 假设足够人员 | NEEDS VERIFICATION；假设不能批准 | `tests/programmes/core.test.cjs:196` — Missing staff is not supplied by an assumption; noncritical reflection can remain conditional | A 类不填人员 |
| 3 | 仅非关键规划假设剩余 | FEASIBLE WITH ASSUMPTIONS，假设可见 | `tests/programmes/core.test.cjs:196` — Missing staff is not supplied by an assumption; noncritical reflection can remain conditional | 既有同一测试后半部分；不重复增加测试 |
| 4 | 所有关键证据当前且通过 | VERIFIED FEASIBLE，仅限已标 synthetic 的测试证据 | `tests/programmes/core.test.cjs:202` — All explicit synthetic evidence passes; result never hides the synthetic label | B 类完整台账 lifecycle baseline |
| 5 | 同名规格不兼容 / 规格缺失 | 确认不兼容硬失败；缺失未知 | `tests/programmes/resources.test.cjs:45` — B3 same name with verified incompatible specification hard fails<br>`tests/programmes/resources.test.cjs:49` — B3 unknown specification remains unknown | 正式页面不自动批准 exact candidate |
| 6 | 未确认 alias / 未知箱内单位数 | 映射或数量保持 unresolved | `tests/programmes/resources.test.cjs:50` — B3 alias needs current human confirmation and retains reviewer<br>`tests/programmes/resources.test.cjs:58` — B3 conversion_to_base 1 never fills an unknown package conversion | A 类全部 selected materials Unknown |
| 7 | 10 units/box × 3 boxes，对需求 25 units | 30 units，数量通过且来源保留 | `tests/programmes/resources.test.cjs:59` — B3 verified 10 units per box / 3 boxes / 25 units passes quantity check | 隔离既有合成测试；非官方库存 |
| 8 | ACT 80 packs 但使用基准未知 | 不按 200 人倍率推算；NEEDS VERIFICATION | `tests/programmes/resources.test.cjs:67` — B3 unknown usage basis never scales 80 packs to participant count | B 类 quantity=1 是显式新合成事实，不从 ACT packs 推导 |
| 9 | 2×30 人顺序/并行；耗材与工具 | 顺序 60 耗材/30 工具；并行 60 工具 | `tests/programmes/core.test.cjs:111` — Consumables sum across sequential groups; verified reusable tools use peak demand<br>`tests/programmes/core.test.cjs:121` — Limited reusable equipment reduces parallelism and recalculates rounds | B 类同一官方活动 P60、工具30→60、1→2通道、287→165分钟 |
| 10 | 两活动各2 facilitator，共享仅3 | 重叠硬失败；顺序重新检查 | `tests/programmes/core.test.cjs:160` — Shared facilitators, rooms, equipment and participants cannot overlap illegally<br>`tests/programmes/core.test.cjs:168` — Generated full journeys never overlap a participant, including transitions | B 类跨活动共享 SKU：确认重用通过，禁止重用失败 |
| 11 | setup 只能提前完成 | 提前 access+资源通过；未知待验证；不足失败 | `tests/programmes/core.test.cjs:179` — Early setup requires access plus event-scoped resources; cannot remove setup silently<br>`tests/programmes/resources.test.cjs:128` — B3 booking interval is separate from observedAt and guards early setup | 既有完整正反边界；A 类不默认提前 access |
| 12 | 一次 setup + 轮次间 reset | 每站初始 setup 一次，轮次间 reset 不漏算 | `tests/programmes/core.test.cjs:173` — Setup is once per station, reset between rounds; unknown timing is not a verified zero<br>`tests/programmes/core.test.cjs:467` — R2 reset before the next activity is included in exact timing boundaries | B 类已审阅 reset=2 是 synthetic，完整排程保存 |
| 13 | 无网络但已验证离线条件仍满足 | 保留原方案且解释受影响检查 | `tests/programmes/core.test.cjs:256` — What-if can retain an offline-compatible plan and explain affected checks<br>`tests/programmes/core.test.cjs:262` — Unrelated What-if cannot upgrade existing unknown evidence | 页面 S2 补年龄保留 pending；API停机后 P41 本地保留 pending |
| 14 | 无网络且依赖互联网 | 硬失败，替代重查；无关键目标等价替代时明确无方案 | `tests/programmes/core.test.cjs:243` — Plan B is reevaluated and reports preserved, lost, improved and unresolved<br>`tests/programmes/core.test.cjs:251` — No suitable alternative and bounded search failure do not claim global impossibility<br>`tests/programmes/scenario-regression.test.cjs:21` — B6 What-if hard-failed plan cannot switch to a supporting-only critical alternative | 补足关键覆盖缺口；S4 年龄硬失败无等价替代；B 类短缺替换且保留两 critical theme |

第 14 项由互联网失败/替代测试、无替代测试和 B6 critical-coverage 回归共同覆盖，并不声称用同一个真实活动现场断网验证过所有分支。浏览器 offline/online 事件未模拟，见演示步骤的现场补测清单。
