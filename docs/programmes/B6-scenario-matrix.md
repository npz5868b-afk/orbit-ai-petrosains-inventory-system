# B6 — 五场景输入 / 输出及验收矩阵

完整输入是 `tests/programmes/scenarios.json`；每条记录含原始 brief、显式测试设定、优先级、证据政策及实际 POST payload。完整实际输出见交付中的 `PAIR_B_B6_SCENARIOS_HTTP.json`：包含来源、所有 checks、材料逐行、storyline、journey、Plan B、trade-offs 与搜索边界。`PAIR_B_B6_SCENARIOS_LOCAL.json` 是相同输入的本地核心运行；HTTP 模式以每次响应的显式评估时间重新调用核心，核对完整 programme/Plan B/checks/materials/search/trade-offs/understanding 一致。

## A 类：未获批准的真实运行证据

原 B1 目录不变；实际 HTTP 读取本机既有库存后端，只读，不初始化数据库。成功读取不证明实物盘点，不提供 mapping、人员、房间、安全或未来预约批准。所有选中材料均 Unknown；无选中方案时材料列表为零行，不是零库存。年龄不从 secondary/primary/public/preschool 推导；没有活动日期时保持未知。

| 场景变体 | 年龄 / 人数 / 时长 | 整体 | 选中正式 ID | 主方案材料 | Plan B | 关键检查 | 搜索计数 |
|---|---|---|---|---|---|---|---|---|
| S1-original | Unknown / 200 / 180 min | NOT FEASIBLE | 无；保留拒绝诊断 | 0 Unknown | 无 | RULE-012 / RULE-005 | 100/100 |
| S1-age-and-judge | 12-14 / 200 / 180 min | NOT FEASIBLE | ACT-001 + ACT-019 | 7 Unknown | 无 | RULE-005 | 100/100 |
| S2-original | Unknown / 40 / 90 min | NEEDS VERIFICATION | ACT-003 | 8 Unknown | 无 | 无已知硬失败；运营证据待验证 | 100/100 |
| S2-age | 7-11 / 40 / 90 min | NEEDS VERIFICATION | ACT-003 | 8 Unknown | 无 | 无已知硬失败；运营证据待验证 | 100/100 |
| S3-original | Unknown / 500 / Unknown min | NEEDS VERIFICATION | ACT-021 | 13 Unknown | 无 | 无已知硬失败；运营证据待验证 | 60/60 |
| S3-30-min | Unknown / 500 / 30 min | NOT FEASIBLE | ACT-017 | 73 Unknown | 无 | RULE-005 | 60/60 |
| S4-original | Unknown / Unknown / Unknown min | NEEDS VERIFICATION | ACT-011 | 5 Unknown | ACT-011 + ACT-014 | 无已知硬失败；运营证据待验证 | 100/100 |
| S4-age | 3-5 / 20 / 300 min | NOT FEASIBLE | ACT-011 | 5 Unknown | 无 | RULE-001 | 100/100 |
| S5-unapproved | 14-16 / 30 / 600 min | NEEDS VERIFICATION | ACT-001 + ACT-019 | 7 Unknown | ACT-009 + ACT-019 | 无已知硬失败；运营证据待验证 | 100/100 |

所有 A 类 Plan B 仍为 NEEDS VERIFICATION，绝非运营批准。全部最多搜索两个活动，均达到预算而未穷尽；诊断/指定方案另计。不把未找到方案说成数学上不存在。

### 输入区别与预期不变量

1. 200 secondary：Sustainability、Robotics 都是 **critical**；Teamwork 是 **preference**，不可声称已覆盖。原始年龄未知；补充的 12–14、电力 yes 明确为场景/judge 变体。室内、unstable 网络、Medium 预算、180 分钟。指定 ACT-001+ACT-019 只用于诊断：各至少 7 组，不默认有 7 并行站。串行活动块下界 270 分钟已经超出180；暂定单通道总时长1440不被包装成确认排程。Mini Drone 等 Notes 草稿条件保留待验证。
2. 40 primary：Water **critical**，Creative Science **preference**；无电90分钟；原始年龄未知，7–11仅为补充测试年龄。Bottle Aquarium 可作为相关待验证候选；Creative Science 仅辅助映射，不能当已确认结论。暂定145分钟不等于有证据支持的最低时长；并行未知时保持待验证。页面补年龄后保留 ACT-003，Unknown 不升级。
3. 500 public：Spectacular Chemistry 原文为 **critical**，不静默改为 Chemistry；短窗口先 Unknown。原始 ACT-021 仅相关待验证、关键覆盖未确认；不得把另一个同样 supporting-only 候选当等价 Plan B。30分钟为显式压力设定，指定 ACT-017 的下界120分钟，硬失败与未知同存。
4. preschool/young：不由文字补年龄。Internet of Things 为 **preference**；`Introduce IoT architecture` 是参照 ACT-011 Master 明确指定的 **critical** 学习目标，不是对 free-text 自动解析。原始人数/年龄/时间均未知；补充3–5岁、20人、300分钟是场景设定。14+条件与3–5硬冲突；不替换成丢失关键IoT目标的幼儿活动。原始年龄未知时 ACT-011+ACT-014 可能成为待验证 Plan B，但不称其适合幼儿。
5. 多主题：Robotics、Sustainability 都 **critical**；14–16岁、30人、600分钟为显式测试设定。A 类 brief 的不可用声明不能当服务端批准；材料仍Unknown。A 类 ACT-009+ACT-019 Plan B 保留主题，但失去 Mini Drone 的直接体验，仍需验证且不称等价学习深度。确认短缺的情况用下列隔离 B 类证据表达。

## B 类：官方目录 + 隔离 synthetic 运营台账

`tests/programmes/scenario-evidence.cjs` 明确标注 synthetic。只为 ACT-001/003/018/019 注入测试审批；原始官方名称/数值/材料行没有改动或删除。每个保留材料行的 `1 unit per participant`、材料类型、换算、reset、重用和供应全部是显式虚构测试事实，不从80 packs或库存标签推导。台账、完整原始快照、审阅记录、请求和评估时间保存在输出 classB.inputs。真实 Next 服务和页面从未加载这些审阅记录。

| 完整流程 | 预期及实际结果 |
|---|---|
| ACT-001+ACT-019，全部必需 synthetic 证据 | VERIFIED FEASIBLE，evidenceMode=synthetic；7材料行Sufficient，仅证明计算 |
| Solar Fan 一条选中材料的 eventQuantity 改为已确认0 | 原方案 NOT FEASIBLE，Insufficient，具体SKU/行/时段来源保留 |
| 同请求重查 Plan B | ACT-001+ACT-018 VERIFIED FEASIBLE（synthetic），保留 Robotics + Sustainability；失去Solar Fan组装/光强测试等；消除该供应失败；未声称学习体验完全相同 |
| P30→29，原方案仍满足 | retained，仍使用001+019；不是强制换方案 |
| 001+003，同一已审阅实物SKU，Robotics+Water为critical | 重用/reset批准时通过；明确禁止时 NOT FEASIBLE，非重叠时间不豁免新器材需求 |
| ACT-001，60人，两站批准，共享工具30→60 | 30工具只允一通道，287分钟；60工具允许两通道，165分钟；均重新排程/检查，不复制库存 |
| 同时增加critical IoT architecture | no_alternative；不为产生结果放松原来的两个critical主题 |
| synthetic 审阅送入生产 handler 边界 | 503，明确拒绝；这是注入依赖的handler测试，不是把fixture装进真实HTTP服务 |

## 实际页面证据

页面记录见 `PAIR_B_B6_BROWSER_RESULTS.json` 与各 `PAIR_B_B6_BROWSER_*.txt`。走通原始S1及指定组合、S2原始/补年龄、S3未知/30分钟、S4未知/年龄硬失败、S5未批准状态。核对理解、正式ID、状态、关键checks、材料与Plan B一致。S2编辑前的旧结果标 OUT OF DATE，评估后显示7–11；API停止后本地结果对应最新41人。

`S4-age-hard` 是发现修复前错误摘要的证据；最终核验请看 `S4-age-hard-fixed`。没有用合成库存驱动正式页面展示 VERIFIED FEASIBLE。
