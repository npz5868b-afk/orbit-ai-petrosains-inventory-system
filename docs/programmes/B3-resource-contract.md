# B3 Resource Feasibility 契约

B3 只增加库存只读适配、材料证据转换与报告。没有 Programme API、前端、LLM、库存写入、交易变更或数据库初始化。核心继续使用原 evaluatePlan / recommend / whatIf。

## 数据流与入口

```ts
import { readInventory, adaptInventory, inventorySnapshot } from './inventory-adapter';
import { adaptResources, materialFeasibility } from './resources';
import { adaptCatalogue } from './catalogue';
import { evaluatePlan, recommend, whatIf } from './engine';

// transport 由运行环境提供，签名见 ReadTransport；仅发出 GET。
const snapshot = await readInventory(transport, explicitApiBase, {
  namespace: stableInventoryInstallationId,
  retrievedAt: explicitReadTime,
});
const adapted = adaptResources(bundle, snapshot, stockReviews, materialReviews,
  operationalEvidence, context, request.eventStart);
const catalogue = adaptCatalogue(bundle);
const plan = evaluatePlan(catalogue, request, adapted.evidence, context, spec);
const materials = materialFeasibility(adapted, plan);
const alternatives = recommend(catalogue, request, adapted.evidence, context);
const revised = whatIf(catalogue, plan, revisedRequest, revisedEvidence, context);
```

上例是接口示意，不提供默认运行时证据。日期／资源改变时先重新 adaptResources，再使用生成的 Evidence；报告必须对应相同的事件和 evaluatedAt。调用者必须传入对应这份 Evidence 计算的 PlanResult，不能将其他计划的检查拼接到报告。

`readInventory` 是唯一异步 I/O 边界；接收结构化的只读 transport，核心不导入 fetch、Node、DOM、数据库或环境变量。网络超时／身份认证由调用方负责，审计脚本使用 5 秒 timeout。不会自动回退到种子数据或缓存。`inventorySnapshot` 接收已读取的文件或保存快照，显式标识 origin，不实施浏览器存储或断网冷启动。

## 已核对的 Stage 1 契约

`backend/app/database.py` 的 inventory_items 以 id 主键、sku 唯一；含 item_type、base_unit、issue_unit、conversion_to_base、available_quantity、total_quantity、store_id、rack、updated_at。没有未来 booking、facilitator 或 room 数据模型。

`backend/app/main.py` 的 `GET /api/inventory` 支持 limit 1–250 与 offset。`backend/app/domain.py` 的 `_item_payload/list_inventory` 返回 items、total、limit、offset；记录使用 display_unit（数据库 issue_unit），并将 checked_out_quantity 算为 max(0,total−available)。available_quantity 已是可用数，B3 不再减一次借出量。字段不证明实物已盘点，差值也不是独立的实物借出审计。

原 `lib/api-client.ts` 的 UI 映射会丢失单位／转换等字段，因此 B3 独立接收原始 JSON；该共享文件不修改。种子文件的 source_available_quantity、description、所有其他原值都保留；种子脚本赋值的 updated_at 不作为盘点时间。

只读分页会拒绝重复 ID/SKU、无进展页、总数变化、不一致数量和缺失基础单位；最多 100 页。接口无 revision token，不能保证多页是原子快照；即使完整读取也不提升任何数量的验证级别。

## 库存的三层证据

1. **raw record**：原始 available/total/checked_out、位置、单位、转换、updated_at，连同 sourceRef、origin、retrievedAt 保留。retrievedAt 表示读取／审计时间；不是 observedAt，也不是官方更新日期。
2. **currentQuantity**：独立 StockReview 的 current attestation，须绑定该 id 与 sku、单位匹配、方法为 physical_count/reconciled_inventory（或仅测试 synthetic）、有 confirmedBy、来源和有效日期。数值须与原始 available_quantity 一致，否则留下需对账项；不自动覆盖差异。
3. **eventQuantity**：另一个独立 event attestation，方法为 event_availability（或测试 synthetic），须有本次 eventStart 和 windowStart/windowEnd。绝不从 currentQuantity 复制或从库存差值推导。

没有 attestation 时 Fact.value 为 null、verification=pending。过期／错误单位／未知来源同样保留原 review 并输出 Unknown，不以零填充。现有 API 不提供这些 attestation；B3 没有制造预约系统或安全审批。

签署人、来源引用、事实是否真实必须经授权的数据提供方审阅；本代码检查结构、身份绑定和时间范围，不认证签名，也不能通过把标签写成 verified 验真。源文件／API 来源本身被记为 user_report，不能自动成为验证来源。synthetic 来源只在测试显式提供，运行映射文件没有任何 synthetic 批准。

## 可用时间与 B2 的最小兼容变更

`Fact<T>` 新增可选 `availableFrom`，仅用于表达资源可用区间起点，与过去的 observedAt 独立。B3 将 event attestation 的 windowStart 映射到 availableFrom，validUntil 取证据到期与 windowEnd 的较早者；原 Fact 若已有更晚 availableFrom，保留更严格的边界。

原 B2 的 current() 在验证事件占用时同时检查 availableFrom ≤ 实际 start（包括负数的提前 setup），现有 validUntil 检查覆盖 delivery/reset 结束。旧 Fact 不传该字段时原行为不变。没有放宽 B2 任何规则，没有新增 Stage 1 API 字段。B3 缺 booking 区间时直接保持未知。

## 共享资源身份

资源池 ID 为 `orbit:<encoded namespace>:sku:<encoded sku>`，与活动名称无关；同一 SKU 跨活动始终同一池，位置／名称变化不创建额外库存。namespace 是调用方固定的库存安装身份，不能为每个活动随机生成。

不会按同名合并不同 SKU；不会建立未经核验的可互换池。Stage 1 本身保证单个 SKU 唯一；重复 ID/SKU 输入被拒绝。operationalEvidence 只接受独立人员／房间池，不能额外夹带 equipment/consumable 池绕过本适配器重复计算。非目录材料来源仍 unresolved，需另获证据接入方案；不会通过虚构池补足物资。

## MaterialReview 与材料映射

每条审阅以 B1 `material_row_id`、库存 itemId 和 sku 绑定；重复／不存在的标识会报错。原整行字段、合并上下文、原始需求与工作簿/sheet/row 定位保留在 MaterialMapping.raw。

- 只做去首尾空白、折叠连续空白和小写的完整名称比较，产生 exact_candidate。没有模糊匹配、去颜色／电压／浓度等处理。
- verified_exact 要有有效且具名的明确 mapping 事实，并确实属于名称候选。verified_alias 必须有人工作出的 alias 事实、日期和来源；代码不生成 alias。
- mappingStatus 只表示身份映射，不表示需求／数量／可互换性全部通过。规格确认是独立的 specificationCompatible；已确认 false 留下 rejected，并送入 B2 的硬失败检查。
- quantity、需求 unit、inventoryUnit、basis、kind、conversionToPoolUnit 都需独立有效来源及审阅人；unit/inventoryUnit 的时间界限和来源合并进派生 conversion Fact，避免适配时通过后在排程中丢失证据到期限制。
- `conversionToPoolUnit` 的方向是“需求单位 → 库存基础单位”。10 units/box 的示例系数为 0.1 box/unit，不是自动读 conversion_to_base=1。没有系数就不计算可用需求。
- basis 支持 per_participant/per_group/per_station/per_session，沿用 B2 定义。ACT 的 80 packs、Number per pack 或 Quantity needed 仍是原文，不被自动解读为每人用量、库存或倍率。
- kind 不从库存 consumable/reusable 标签自动批准；不一致则待核验。reuseApproved 与 resetMin 仍独立验证；库存 reusable 标签不等于活动允许重用。
- 没有映射／需求证据也生成 pending MaterialDemand，保留在 B2 检查中，不删除材料行来让结果通过。
- 只有 B1 已标 `material_or_section_needs_review` 的行，经具名、有日期、有理由的 not_material disposition 才可排除需求；原行仍在报告中。普通 material 行不能以这种方式静默删除。
- materialsComplete 仍由外部完整审阅事实提供，不因所有名称都能找到而自动设为 true。

## 材料报告的状态与范围

`materialFeasibility` 消费原 B2 的 pool 累计需求、重用分配、占用冲突、来源与逐行检查，不另写一套资源数量算法。

| 状态 | scope=event_programme 的含义 |
| --- | --- |
| Sufficient | 对这个已计算计划，具备映射和 B2 资源计算结果，相关检查通过；不代表活动安全或总体目标全部通过 |
| Insufficient | 有已知不兼容规格或 B2 资源短缺／重用冲突，仍保留其他未知项；原因区分不兼容和数量不足 |
| Unknown | 缺少映射、时间表、规格／单位／basis／证据，或当前数量／未来可用量未验证；不等于库存为零 |

输出同时保留 rawAvailable、currentQuantity、eventQuantity、checks、sources、evidenceTimes、reason 与 nextAction。全 programme 共用同一 pool 的短缺会反映到相关材料行。Unknown reuse 但有足够全新器材时沿用 B2-R1，不强迫方案依赖重用；材料审阅报告仍显示未确认的重用事实。

## 验证和未覆盖边界

运行 `node tests/programmes/run-resource-tests.cjs`；使用现有 TypeScript 5.7.3 和 Node 内建测试，无新依赖。B2 的 AST 约束、严格类型以及 ES6/ESNext/Bundler 检查继续执行。

`audit-resources.cjs --evaluated-at=<ISO>` 生成确定性的静态候选审计 JSON；`--live-api=<base> --output=<file>` 才执行显式 GET 并记录实际完成时间。审计脚本不会给任何材料批准 mapping、stock、booking 或 safety；生成 JSON 是 review artifact，不能冒充确认映射默认值。

目前没有认证第三方批准权限、现场盘点、真实未来预约验证、生产部署、API/前端接入或离线冷启动验证。必须保留这些限制以及 B0 PARTIAL。
