# B4 Programme API 契约与复现

三个 Next App Router handler 使用 Node runtime、动态执行与 `Cache-Control: no-store`。没有 Programme 前端或 LLM；Stage 1 FastAPI 不修改。`lib/programmes/server/` 负责 HTTP／配置／JSON 加载，原 B2/B3 仍为独立共享核心。调用流程为 JSON → adaptCatalogue → 请求校验 → 服务端库存/审阅加载 → adaptResources → evaluatePlan/recommend → materialFeasibility。

## 端点

### GET /api/programmes/offerings

返回 sourceSha256 和 21 条 offerings。每条包括正式 Offering_ID、officialName、identity、原始 fields/单元格来源、Notes、Data_Confidence。`operationalVerification: pending` 明确目录身份与执行可行性不同；不会因 High 或非空字段而批准活动。此端点不读库存。

### GET /api/programmes/themes

从 Master Suitable_Themes 提取完整主题标签，保留对应 offering 与单元格来源；主题含义保持 pending，不宣称学习成效已验证。supportingMappings 保留 B1 Theme_Objective_Mapping 原记录，verification=pending，role 明确是辅助依据而非固定答案表。此端点不读库存。

### POST /api/programmes/consult

Content-Type 必须为 application/json。最小输入为 `{}` 或 `{"request":{}}`：这是信息缺失而不是 JSON 格式错误，会返回追问与待验证状态。

```json
{
  "request": {
    "themes": [{"text":"Robotics","priority":"critical"}],
    "objectives": [],
    "ages": "12-14",
    "participants": 30,
    "durationMin": 240,
    "eventStart": "2026-10-01T09:00:00Z",
    "venue": "indoor",
    "internet": "stable",
    "electricity": "yes",
    "water": "yes",
    "budgetBand": "Medium",
    "accessibility": []
  },
  "plan": {"offeringIds":["ACT-001"]},
  "search": {"maxActivities":1,"maxEvaluations":21}
}
```

日期和人数是调用示例，不是运营默认值。request 接受 B2 的 brief、themes、objectives、audienceType、ages、participants、durationMin、eventStart、venue、internet、electricity、water、budgetBand、budgetIsHardLimit、accessibility、format、participantLed、assumptions。继续区分 Unknown、null、空白、Optional/No 等适用语义；年龄可传 `n+`、范围字符串、单年龄或闭区间 `{min,max}`。日期必须为有效、带时区的 ISO。brief 仅保留文字，不作 LLM 解析。

顶层仅允许 request、plan、search；request 和其 goals/assumptions/ages、plan、search 也有字段白名单。plan 可省略；提供时须为 1–3 个不同的正式 ID，及可选 boolean setupBeforeArrival。不存在的 ID 返回 400，不伪装成官方 offering。

**不接受** evidence、verified、confirmedBy、ResourcePool、PlanResult、库存 URL、namespace 或旧可行性结果等客户端权威数据。客户端 operational assumption 只保留待确认，不成为 staff/stock 证据。没有独立 What-if 协议：重新提交改变后的 request 和原 plan 即会重新评估；不会读取客户端旧状态，亦不另建 What-if API。

## 搜索与工作量边界

- 请求体最多 65,536 bytes，逐块读取，即使伪造 Content-Length 仍检查实际字节；读 body 最长 5 秒。
- 最多 1,000 participants、1,440 分钟 attendance；超过属于 API 限额错误，不等于活动在数学上不可行。
- themes/objectives/assumptions 各最多 8 项、文字每项 200 字符；brief 最多 4,000 字符；accessibility 最多 12 项。
- maxActivities 为 1–3（默认 2）；maxEvaluations 为 1–200。默认取 100 与剩余工作量预算允许值的较小者。未提供／null 搜索字段采用默认。
- `max(1,participants ?? 100) × maxActivities × maxEvaluations ≤ 60,000`；显式请求超出则 400，不静默截掉后称全局无解。
- search 返回实际 evaluated、limit、maxActivities、exhaustedWithinBounds、scope 和 conclusion，保留原 B2 串行活动块及搜索预算限制。
- 请求指定 plan 时另外重算 plan 及其搜索 reference；无方案时最多重算 3 个失败诊断。evaluationCounts 将 search/reference/requestedPlan/diagnostics 次数分别列出，避免把 search.evaluated 当作整个响应所有计算次数。

## 响应与状态

200 响应包含 evaluatedAt、status、outcome、requestUnderstanding、missingInformation、assumptions、programme、themeCoverage、storyline、participantJourney、checks、materials、planB、planBMaterials、tradeOffs、proposedEnhancements、search、rejected、rejectedDetails、evaluationCounts、inventory、limits 和 sources。

programme 与 planB 是原核心生成的完整 PlanResult。指定 plan 时 programme 始终保留其重新评估结果，即使有硬失败；Plan B 经同一核心重验。材料 Sufficient 不等于整场 VERIFIED FEASIBLE。没有找到方案时 programme=null、outcome=no_plan_within_search；status=NOT FEASIBLE 仅指本次已搜索候选均失败，结论明确限定搜索范围，不是全局无解。

checks 保留失败与未知；无方案时 rejectedDetails 提供最多三个完整失败诊断及其 missingInformation，而不是把未知都丢掉。conclusion 是核心搜索说明；指定方案自己的结论应读取 programme.status/checks。完整真实请求／响应见 B4-api-examples.json。

| HTTP | 含义 |
| --- | --- |
| 200 | 已执行评估；可为待验证、不可行、无方案或库存降级，不能用 HTTP 200 当可行证据 |
| 400 | JSON 值形状、字段、枚举、日期、人数、ID、搜索范围或权威字段非法 |
| 408 | 请求体读取超时 |
| 413 | 请求超过 64 KiB |
| 415 | 非 application/json |
| 405 | Next 拒绝不支持的方法 |
| 503 | 目录或服务端审阅配置不可用；没有产生可行性结论 |

错误响应仅返回固定 code/message，不返回异常 message、stack、配置路径或凭据。库存故障是可恢复依赖问题，返回 200 加 inventory.degraded，而不伪装成输入错误。

## 服务端配置与信任边界

| 环境变量 | 行为 |
| --- | --- |
| ORBIT_PROGRAMME_INVENTORY_API_URL | 默认 http://127.0.0.1:8000/api，仅由服务端设置；要求 http/https，无 URL userinfo/query/hash |
| ORBIT_PROGRAMME_INVENTORY_NAMESPACE | 默认 orbit-primary；应在部署中设为稳定的库存安装标识，不按活动变化 |
| ORBIT_PROGRAMME_REVIEW_FILE | 可选服务端只读 JSON 文件，最多 1 MiB；未配置时 stocks/materials/operational 均为空 |

审阅文件形状是 `{stocks: StockReview[], materials: MaterialReview[], operational: Evidence}`，字段语义完整继承 B3-resource-contract。只由授权运营方准备带来源、审阅人和有效期的记录。文件不通过 API 创建、更新或上传；配置路径绝不取自客户端。加载时拒绝 synthetic kind/method，避免误用测试证据。默认不加载测试 fixture、B3 同名候选审计或 seed 文件作为批准数据。

审阅文件属于受信服务端配置：授权、签署真实性和可公开的来源引用仍需运营方核验，代码不能认证签名。不要在来源引用中放凭据。格式或绑定错误会 fail closed 返回 503，不能通过目录放宽规则修复。

原始库存读使用 B3 GET 分页器，整体 AbortSignal 限时 1,500ms，handler 外层另有 1,550ms 兜底。读成功只表示原始记录读到；currentQuantity/eventQuantity 仍需独立审阅证据。超时／不可达时不使用种子或保存快照，生成空的未知库存输入，保留独立 operational 证据，暂不应用无法与 SKU 绑定的库存／材料审阅。响应解释失败、无缓存回退及 Unknown。字段 readAt 为成功读取完成时间，不是盘点／同步确认时间。

runtime JSON 通过静态 import 打包，运行不读取 Excel。`server/` 不从 core index 导出；纯核心配置排除 server，仍可供后续已加载页面本地计算。

## 启动与复现

在已安装项目 lockfile 对应依赖的源码根目录，现有标准脚本为 `pnpm typecheck`、`pnpm build`。本机为避免包装器自动整理共享依赖，实际使用等价直接命令：

```powershell
node node_modules/typescript/lib/tsc.js --noEmit
node node_modules/next/dist/bin/next build --webpack
$env:ORBIT_PROGRAMME_INVENTORY_API_URL='http://127.0.0.1:8000/api'
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3304
```

本机 node_modules 是既有同版本依赖的目录链接；默认 Turbopack 不允许其指向项目根外，因此默认 build 已尝试但失败。仓库原有 Webpack 构建方式通过。此环境限制不通过修改共享 next.config/package/lockfile 规避；在正常本地安装依赖的环境应另行验证默认 Turbopack 构建。

```powershell
node tests/programmes/run-api-tests.cjs
node node_modules/typescript/lib/tsc.js -p tests/programmes/tsconfig.core.json --target ES6 --module ESNext --moduleResolution Bundler --noEmit
# backend：使用可用 Python 环境，并只运行临时数据库 fixture。
python -m pytest backend/tests -q -p no:cacheprovider --basetemp .test-tmp/b4-backend
```

真实 HTTP smoke 另启动一个仅用于故障测试的 Next 实例，令其 ORBIT_PROGRAMME_INVENTORY_API_URL 指向无服务的 http://127.0.0.1:65530/api，端口 3305；再运行：

```powershell
node tests/programmes/http-programme-smoke.cjs --base=http://127.0.0.1:3304/api/programmes --degraded=http://127.0.0.1:3305/api/programmes --output=B4-http-results.json
```

本次 10 个 HTTP 案例针对已构建的 Next 生产服务器，不等同于 handler 注入依赖测试；库存悬挂 timeout 由 handler 测试覆盖，实际 HTTP 故障案例为连接不可达。验证结束后已停止两个临时 Next 实例，没有停止用户的 Stage 1 后端。
