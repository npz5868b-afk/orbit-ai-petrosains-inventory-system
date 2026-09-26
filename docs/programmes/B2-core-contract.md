# B2 共享确定性核心与 B3 接口契约

此文档描述实际实现。B1 原始 JSON 与导入器不变；这里没有网络、数据库、浏览器全局对象、LLM、Next API 或真实库存适配。核心入口是 `lib/programmes/index.ts`，完整类型见 `lib/programmes/types.ts`。

## 调用与依赖边界

```ts
const catalogue = adaptCatalogue(bundle); // B1Bundle 由调用方读取并传入
const context = { evaluatedAt: "2026-09-26T02:00:00Z" };
const plan = evaluatePlan(catalogue, request, evidence, context, {
  offeringIds: ["ACT-019"],
});
const choices = recommend(catalogue, request, evidence, context, {
  maxActivities: 3,
  maxEvaluations: 1000,
});
const changed = whatIf(catalogue, plan, revisedRequest, revisedEvidence, context);
```

示意中的日期与 ID 仅说明调用形式，不构成默认活动或运营确认。运行示例位于 `B2-examples.json`；其中 synthetic 目录、库存、人员、预约和批准只用于审计／测试，不能加载为演示或生产默认值。

`adaptCatalogue` 读取传入对象，不访问文件系统。Bundle 包含 manifest、offerings、mapping、constraints、dictionary、materials、audit，分别对应 B1 的 7 个 JSON 文件。适配器检查 schema/source_sha256 一致、21 个唯一 offering、12 条 Rule_ID、字典特殊值定义及 ACT／映射关联。它不在浏览器内部计算文件哈希；调用方必须保证传入的是经审阅的 B1 文件。本阶段 Node 测试重新验证了 manifest 所列 6 个数据文件的实际字节哈希。

`evaluatePlan`、`recommend`、`whatIf`、`normalizeRequest`、`balancedGroups`、`checkIntervals` 都为同步纯计算。相同输入和显式评估时间产生相同输出；不读取当前系统时间，不产生随机数，不修改输入。结果携带 `evaluatedAt`，日期须为有时区的合法 ISO 时间。浮点资源比较仅容忍机器舍入误差，不做商业数量舍入或默认包装转换。

## 三种含义分别表达

1. **目录身份**：只有目录中存在的 Offering_ID 才产生官方卡片；名称保持原文，包括 Fabolous Fizzy。未存在的 ID 对应 RULE-010 硬失败。
2. **相关性**：`coverage` 提供 Master／辅助映射的来源与推理。所有相关性结论都标 `provisional: true`，不宣称已验证学习成效。
3. **本次可行性**：来自要求、排程和事件范围内的证据，不能从目录身份、非空数值或 Data_Confidence 推导。

全部目录运营字段默认待验证。这是保守的字段策略，不是将整个目录排除。每个派生字段保留 `raw`、单元格来源、Notes、Data_Confidence 与对应 audit issues。Mini Drone、Microbit、Solar Fan 等原文中的草稿／规划假设不会因 High 标签而变成确认数据。可用原值做条件计算，但字段证据检查仍为 NEEDS VERIFICATION。

通过独立 `OfferingEvidence.fields` 可验证某字段用于本次事件。已给定的官方值不能被直接更改；不同的验证值触发 RULE-010 并保留原标准值。源值确实未知时，当前有效的独立证据可以补充派生计算值，原 JSON 不变。缩短标准时长或改变条件必须作为单独 Proposed Enhancement，核心不会把它作为已批准的替代标准活动执行。

## 请求标准化

请求字段包括 `brief`、`themes`、`objectives`、`audienceType`、`ages`、`participants`、`durationMin`、`eventStart`、`venue`、`internet`、`electricity`、`water`、`budgetBand`、`budgetIsHardLimit`、`accessibility`、`format`、`participantLed`、`assumptions`。

- themes/objectives 是 `{text, priority: "critical" | "preference"}[]`；相同文字去重，critical 优先，不因重复输入加分。
- ages 可为 `{min, max}`、单年龄、`n+`、`4-8` 等区间。`n+` 的上界为 null，不代表无限年龄已符合有上限的活动。Secondary school 不能代替年龄证据。
- internet 明确为 `stable / unstable / none / unknown`；electricity/water 为 `yes / no / unknown`。
- venue 为 `indoor / outdoor / sheltered_outdoor / unknown`。逐一检查目录类型与请求类型；Indoor 对 outdoor 和 sheltered_outdoor 均为硬失败。`Indoor or sheltered outdoor` 支持室内和有遮蔽室外，不支持无遮挡室外。缺字段、特殊未知值或无法完整解释的文字为 NEEDS VERIFICATION，不能因包含 Indoor 子串而通过。一般 Outdoor 描述是否支持遮蔽场地仍需验证（可能影响光照或飞行条件）；不自动把两种请求枚举等同。兼容检查支持当前 B1 六种完整场地描述；未识别的新描述保持待确认。Indoor 不自动证明电、水、通风、强光或批准；另查事件级 venueReady 与具体 Key_Constraints。venueReady=true 不能覆盖目录类型限制。
- budgetBand 为 `Low / Medium / High / unknown`；不产生 RM 价格。硬预算上限不满足会失败；非硬限制需要确认。
- accessibility 的 null 表示未询问；空数组表示明确没有额外要求；非空数组需要对应批准证据。
- 数字非法、NaN、负人数、零人数、错误枚举等产生输入失败，不静默改成可用值。Unknown、缺失、No、Optional、N/A 与零不是同义值。
- assumptions 只有 `reflection_topic` 可作为不影响运营的措辞假设，且不增加时间或资源；`operational` 假设只能留下待核验项，完全不参与提供 staff/stock 等数量。

本阶段不从 brief 自由文本猜测请求；结构化值具有明确的计算语义。无外部 LLM 时这些入口均可使用。

## 证据与状态

`Fact<T>` 必须包含 value、verification、sources。要成为当前有效的验证证据，还必须满足：

- 来源非空、有 ref，kind 为 verified_record 或 synthetic；catalogue/user_report 本身不能验证运营。
- observedAt 不晚于显式 evaluatedAt；validUntil 不早于 evaluatedAt。
- 事件证据 eventStart 与本次请求相同，且有效期覆盖实际 setup、delivery、reset 的完整运营窗口。
- B3 增加可选 `availableFrom`：资源可用区间的起点，与 observedAt 分开；如果提供，必须不晚于实际占用起点（包括提前 setup）。旧 Fact 未提供时保持原 B2 行为；B3 的事件库存必须有明确可用区间，不能靠 observation 日期推导预约范围。详见 B3-resource-contract.md。
- 数量、布尔值及材料枚举通过各自类型／范围校验。

synthetic 可以使计算测试得到 VERIFIED FEASIBLE，但输出始终携带 `evidenceMode: synthetic`，不能作为真实活动确认。B3 的适配器负责验证记录出处、签署权限、源系统时间语义和证据真实性；核心验证结构和时间范围，并不认证签名，也不能仅凭调用方填写 verified 验真。

每项 Check 含 id、Rule_ID、status、reason、sources、evidenceTimes、nextAction，并附原始 Constraint_Rules 的工作簿／行定位。总体采用：

`NOT FEASIBLE → NEEDS VERIFICATION → FEASIBLE WITH ASSUMPTIONS → VERIFIED FEASIBLE`

独立结果保留，硬失败不会删除预约未知项，未知项也不会掩盖硬失败。missingInformation 从待验证检查生成有针对性的行动清单。

| 官方规则 | 实现位置／行为 |
| --- | --- |
| RULE-001 Age | 年龄下界、上界、部分人群不符合、未知年龄 |
| RULE-002 Capacity | min/max 均衡分组、并行上限、人员／房间／设备限制 |
| RULE-003 Electricity | 区分 required、optional、not_required、unknown；缺必需电力失败 |
| RULE-004 Internet | 不稳定、无网、未知分开；Optional 不等于必需，离线前置条件另验 |
| RULE-005 Duration | 标准时长、setup/reset/transition、参加窗口与运营窗口 |
| RULE-006 Venue | 室内外／遮蔽不匹配、条件批准、用水、早／晚场地访问 |
| RULE-007 Safety | 训练／安全批准、facilitator-only 与 participant-led 冲突 |
| RULE-008 Budget | 仅相对 cost band，未知／超出限制与精确价格缺失说明 |
| RULE-009 Missing_Data | 缺失输入、字段验证、未知假设、辅助证据不足 |
| RULE-010 Unsupported_Offering | 未存在 ID、改变标准字段、改编方案分离 |
| RULE-011 Accessibility | 区分未问、明确无额外需求、已提出且待批准 |
| RULE-012 Feasibility | 组合目标、整体资源、预约、完整性与冲突 |

## 组合相关性与搜索边界

直接依据来自 Suitable_Themes、Suitable_Objectives、Learning_Outcomes，辅以 Key_Concepts、STEM_Domain、Short_Description。不按词出现次数加分。

主题概念推理另外包含少量明确、可审查的通用关系，如可再生能源／资源循环支持 Sustainability，生态关系支持 Biodiversity。它不是官方主题表，也不包含活动 ID 或固定组合。推理需要至少两个不同 Master 字段佐证，输出明确标 `Planner inference` 并引用原句。重复同一字段的词不能制造佐证。未覆盖的语义和同义改写可能需要用户重新表述或人工确认；不声称通用语言理解。

Theme_Objective_Mapping 仅作辅助，完整文字和来源保留。辅助证据不能单独证明关键目标已满足；此时 NEEDS VERIFICATION。缺少任何支持的 critical 目标使该组合不合格；缺偏好会降低覆盖而不会自动硬失败。

评分按去重目标覆盖、关键性和交付形式多样性计算；候选须经过完整同一套可行性校验。优先证据状态，再比较覆盖、时长和确定性 ID 顺序。不会因为 Availability_Status 全部待确认而清空目录。

默认搜索最多 3 个不同活动、1,000 次评估；显式可设 1–5 个活动及 1–10,000 次评估。搜索有序组合，采用**活动块串行、每个活动内部并行轮换**；所有参与者都参加每个选中活动。它没有穷尽任意跨活动交错、所有分组分配、临时改编或任意资源调度。自动搜索 setup 在参加窗口内；手动 `evaluatePlan` 的 setupBeforeArrival 可验证有证据支持的提前 setup。

返回 evaluated、limit、maxActivities、exhaustedWithinBounds、scope 和 conclusion。预算或搜索空间内没找到方案，只报告未找到，不声称数学上不存在。`checkIntervals` 可独立验证外部提出的共享资源／参与者时间表；它检查占用冲突，不替代整个 evaluatePlan 的目标、安全和材料完整性检查。

## 排程和资源计算

最少组数为 ceil(participants/max)，但用均衡组大小同时检查 min 与 max，避免过小尾组。200 人／max 30 得到 7 组；并行度受已给定并行能力、事件人员数／每站人员需求、房间和可复用设备共同限制。

并行批准未知时，显示明确的条件方案。若已验证资源给出并行上限，采用该上限作为乐观时间边界；即使如此还超时，也保留硬失败。连上限都未知时展示一条暂定 lane，并禁止用它证明“无法安排”或“已可行”。未知 reset／transition 不写成已验证的零，显示时间标为 provisional/lower bound。

B2 修订分别输出每个 ActivitySchedule 的 `minimumRounds`、`attendanceLowerBoundMin` 和 `operationalLowerBoundMin`。有已知并行上限时，minimumRounds = ceil(groups/upperBound)；连上限都未知时只保留至少一轮的乐观下界，不把展示的一条 lane 当成真实上限。attendanceLowerBoundMin = setup + minimumRounds × delivery + (minimumRounds−1) × 已知 reset；第一个活动获请求提前 setup 时扣除其 setup。operationalLowerBoundMin 始终包含 setup，并加已知 finalReset。未知时间在下界中不贡献数值，但仍产生待验证检查。

programme 下界按现有串行活动块策略累计各活动参加下界、前序活动最终释放、已知 transition。它与显示用的暂定排程分别计算。一个活动并行未知不影响另一个活动的独立超时证明。例如 90 人、每场 30、已验证一条 lane：5 + 3×30 + 2×2 = 99 分钟；另一个活动的最乐观下界 35 分钟、transition 3 分钟，合计 137。80 分钟必定失败，137 分钟只是尚未排除，未知并行仍为 NEEDS VERIFICATION。这是当前活动块方案的下界，不是任意交错排程的全局无解证明。

每个物理站首次 setup 一次，随后每轮 delivery 及所需 reset；最后释放时间另算 finalResetMin。半开区间 `[startMin,endMin)` 允许前项结束时后一项开始。setup/reset 同样占用 staff、room 和设备。参与者采用稳定 ID，在不同活动重新分组但不重复占用。材料需求共用同一 poolId 才能正确累计，多个来源材料行落同一 pool 会先合计每站需求。

输出 participantDurationMin、operationalStartMin、operationalEndMin、groups、rounds、parallelCapacity、intervals 和逐组 journey。提前 setup 需要 earlyAccessMin，结束后 reset 超出参加窗口需要 lateAccessMin；对应人员／设备证据也须覆盖这些时段。每个具体源约束不能因排程便利而删除。

当前参与者展开上限为 10,000；超过会明确 NEEDS VERIFICATION，不制造完整时间表。设备占用采用保守的站点需求，可能拒绝某些需要更精细资源调配才能安排的方案；搜索范围声明保留这一限制。

## B3 需要接入的接口

### ResourcePool

`id / kind / unit / currentQuantity / eventQuantity`。kind 为 facilitator、room、equipment 或 consumable。

currentQuantity 代表带真实观测／同步语义的当前数量；eventQuantity 代表本次完整时间窗口的可用量。两者独立检查。updated_at 不是 observedAt；当前库存不能填充未来预约。source ref、观测时间、有效期和事件范围缺失时保持未知。

同一资源或可互换池必须在所有活动中使用同一个全局 poolId，不能按活动复制“另一个可用池”。B3 应确认池身份、成员集合、互斥范围以及资格；本核心不能发现调用方把同一人员／实物伪装为不同的池 ID，也不会假定两个名字不同的池天然互不重叠。

### MaterialDemand

每条需 id、sourceRowIds、sources、poolId、mapping、specificationCompatible、quantity、unit、basis、kind、conversionToPoolUnit、reuseApproved、resetMin。

- mapping 为 exact 或 alias 的明确验证事实；alias 额外必须有 confirmedBy 和带时间的来源。核心不产生 alias。
- specificationCompatible 的 verified false 拒绝该匹配；未知则需要验证。
- basis 为 per_participant、per_group、per_station 或 per_session，必须有来源。per_session 表示一组的一次 delivery；per_station 表示每个物理站在该活动的一次需求。不能用原 Excel 的 80 packs 自动推导。
- consumable 依依据累计所有人／组／站／session，并跨活动累加。reusable 既检查 setup/delivery/reset 同时峰值，也按整个 programme 的每次 delivery 分配同一 pool 内的器材数量；跨活动与跨轮次采用同一规则。每次分配先使用已释放且可重用的数量，剩余需求占用此前未使用的全新数量，不会把非重叠自动当成许可。
- `reuseApproved=false` 禁止该使用节点接收已用器材或将它转给后续使用节点；两端均需有效 true、前序 reset 完成才属于已确认的重用链。未知许可/重置只进入乐观计算，不能成为验证证据。`equipment.<poolId>.allocation` 输出两种情况下所需的全新数量：已确认重用/reset，以及未知条件将来获确认的乐观下界。即使乐观情况也超库存为 NOT FEASIBLE；仅依赖未知许可才足够为 NEEDS VERIFICATION；有足够全新器材时无需假定重用。材料的 reset 以及其他所有检查仍独立保留。
- 例如两个 30 人活动各需每人一件，共用 30 件且禁止重用：需要 60 件全新器材，因此失败；60 件则可通过数量检查。允许重用但未验证则保持待确认；允许且 reset 已验证并计入区间时可以复用 30 件。这些都是 synthetic 计算示例，不是目录库存事实。
- conversionToPoolUnit 将需求单位换算到 pool.unit，必须显式验证，不默认 1。例如 25 件、每箱 10 件、可用 3 箱，可用有来源的系数 0.1 将需求转换为 2.5 箱比较；等价于比较 25 件与 30 件。无系数不能通过。
- B1 的所有 materialRowIds 必须有映射，或在 materialRowDispositions 提供 `classification: Fact<'not_material'>`、人工 confirmedBy 及明确 reason。仅经复核的分节标题可如此处理；未确认歧义行不能删除或直接忽略。
- materialsComplete 是有来源的全量需求审阅声明，不能替代逐行覆盖检查。

### OfferingEvidence 与全局证据

每个活动的 fields、available、safetyApproved、venueReady、accessibilityReady、offlineReady、unstableInternetReady、operationalRequirementsApproved、parallelStations、resetMin、finalResetMin、facilitatorPoolId、roomPoolId、materialsComplete、materials 与 materialRowDispositions；全局 transitionMin、earlyAccessMin、lateAccessMin。

布尔批准必须明确覆盖其 Check 所引用的全部具体要求，如化学浓度、HSE、强光、通风、合资格 facilitator、食物过敏控制、预加载软件；不是用户勾选“已满足”就产生真实批准。B3 若只有部分条件的证据应继续 pending，不填充笼统 true。

## Plan B、What-if 与输出解读

Plan B 与原方案使用同一 evaluatePlan。tradeOffs 分别列 preserved、lost、improved、unresolved，包括目标、目录明确学习结果、活动体验、交付形式、参与方法和时间变化。状态降低被列为损失，不描述为改善。

What-if 总是重算原方案，输出 changedInputs、changedChecks、previousRechecked。原方案没有已知硬失败时允许 retained，并保留未知状态；有硬失败时搜索替代。未找到则返回 no_alternative 和搜索边界。原检查因新条件不再适用时 after 为 null，不伪装成 VERIFIED FEASIBLE。

storyline／participant journey 使用正式名称、学习结果、目标依据与实际时间区间，不增加未经计时的“必有环节”。反思措辞与未批准的短版构想在 enhancements 中单列 PROPOSED ENHANCEMENT，既不冒充官方 offering，也不修复原计划的硬失败。

## 验证与复现

现有项目已声明 TypeScript 5.7.3。本次只读使用机器上已有的同版本编译器，无新依赖；package.json、pnpm-lock.yaml 均不修改。测试使用 Node 内建 runner，TypeScript 核心配置只提供 ES 库，不提供 DOM 或 Node 全局类型。

```powershell
# 从源码根目录运行。已安装现有 TS 依赖时无需设置该变量。
# 未安装时可将 ORBIT_TYPESCRIPT_PATH 指向本机既有 TypeScript 5.7.3 的 lib/tsc.js。
node tests/programmes/run-core-tests.cjs
node tests/programmes/generate-examples.cjs
```

runner 先输出编译器版本，再 strict 编译，最后运行 Node 行为测试。生成的 `.test-tmp/programmes-core/` 为已忽略的测试输出，不交付为运行时依赖。原始 Excel 并非 B2 测试依赖；官方目录测试直接核对 B1 JSON／manifest，不代表再次执行了 B1 的 8 项 Excel 测试。

B2 修订保留原 54 项测试并新增 56 项回归/边界测试。最初加入的 50 项先对修复前代码运行，共 104 项、74 通过、30 失败；修复及补充边界后共 110 项通过。兼容检查命令为 `node $env:ORBIT_TYPESCRIPT_PATH -p tests/programmes/tsconfig.core.json --target ES6 --module ESNext --moduleResolution Bundler --noEmit`，并继承配置内 strict 与 unused 检查。11 组审计示例保留原 Plan B/What-if 案例，另加入三个问题及相关待验证/正向边界。

本阶段没有前端加载、PWA、断网冷启动、Next/FastAPI、数据库或 Stage 1 全量回归的验证结论。纯核心不依赖网络，适用于后续已加载页面的本地计算；浏览器与 Next 的实际接入留待批准后的对应阶段。
