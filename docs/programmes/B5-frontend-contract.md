# B5 Frontend / loaded-page contract

## 页面与接入

`app/programme/page.tsx` 使用现有 AppShell；`components/programmes/consultant.tsx` 管理表单、加载、调用和请求代次；`results.tsx` 显示结果。AppShell 仅增加 Compass 图标和 Programme 导航项，沿用桌面和移动端共同 NAV。

结构化输入使用 B4 request / plan / search，不发送 verified、旧 PlanResult、库存 URL、namespace 或审阅记录。Brief 仅是上下文，不自动解析。年龄保留字符串范围或 n+；空数值为 null，枚举默认为 unknown。日期控件明确采用 Malaysia UTC+08，提交带时区 ISO 时间；其他地区的活动应先换算为该时间。无障碍分别为 Unknown / 无特别需求报告 / 逐行列出的需求。checkbox 表达偏好或约束，不表达运营批准。

多主题和目标各最多 8 条、每条 200 字；Brief 4000 字；无障碍最多 12 条；人数最多 1000；窗口最多 1440 分钟；选择最多 3 个正式 ID。共用 `lib/programmes/protocol.ts` 执行 B4 完整校验和搜索工作量上限。UI 的最大活动数 1–3；默认实际搜索限额由共用校验按人数计算，不另写评分规则。

## GET /api/programmes/offerings?include=offline

最小 opt-in 扩展。普通 GET offerings、themes 和 POST consult 的 B4 合约保持兼容。响应：

```ts
{ schema: 'orbit-programme-browser-v1', bundle: B1Bundle }
```

只包含已导入的公开目录、材料行、字典、约束和审计；manifest 白名单为 schema_version / source_sha256 / workbook_filename / sheet_names。不返回服务端审阅文件、库存端点、配置 namespace、环境变量或凭据。不加载库存、不读取审阅文件。Cache-Control 为 no-store。客户端使用 adaptCatalogue 验证同源哈希、规则和审计后才启用计算。此加载器不会在客户端包中静态导入 server/data 或 runtime。

B1 原始 JSON 没有修改。目录身份与本次可执行性独立；原始值/特殊值/正式名称/Notes/Data_Confidence/source 通过适配保留。主题映射始终 pending。

## 在线与本地计算

`lib/programmes/consultation.ts` 是 HTTP 与本地共用的结果组装层。继续调用 B2 evaluatePlan / recommend / tradeOffs 和 B3 adaptResources / materialFeasibility；没有新增评分、时间或数量规则。`protocol.ts` 从 B4 handler 提取原校验，handler 仍负责 HTTP/body 上限、超时和可信服务端依赖。

`local.ts: consultLocally(bundle, input, evaluatedAt, lastReadAt)` 使用相同计算层。目录仅保留在已加载页面内存；没有 service worker、localStorage 数据缓存、冷启动或刷新恢复承诺。浏览器不保存库存原始快照，也不导出/复用运营审批。因此每次本地运行使用显式空库存证据和空审阅记录，物料映射、当前数量、未来可用量、人员/场地/安全均继续 Unknown；空集合不代表零库存。仅保留上次成功读取时间作历史提示，它不是盘点或当前库存证据。

这种保守模式不会继承在线 VERIFIED FEASIBLE；联网后应重新调用 API，取得当前服务端证据。没有目录时禁用评估、显示重试；资源数据不可用时仍能计算目录约束，但明确缺失的资源证据。navigator.onLine=false 时自动使用本地计算；navigator.onLine=true 不证明 API 可达。API 失败显示重试/本地选择，不静默套用旧结果或种子数据。

显式 evaluation time 在浏览器边界由时钟传入，纯核心不读取时钟、网络或浏览器对象。相同输入和时间的本地结果确定一致。

## What-if 与并发

默认 What-if 只把上次方案的合法 offeringIds 作为下一次 plan 提交。后端重新检查原计划，并使用同一套规则检验 Plan B。取消“Recheck original plan”可重新搜索。相同 ID 能保留，仍然显示 remaining unknowns；硬失败并存 Unknown 时整体 NOT FEASIBLE，Plan B 独立显示状态及 preserved/lost/improved/unresolved。

每次编辑、计算模式变化、在线状态变化、提交以及组件卸载都会让旧请求代次失效；AbortController 中止请求，LatestEvaluation 还阻止晚到响应提交结果。开始重算即把旧结果标为过期；失败不会解除过期标志。只有当前代次成功才清除标志。用户看到“当前 draft”与“该结果的 Request Understanding”、结果时间和计算来源。

## 展示规则

整体状态、所有已知硬失败和关键未知优先显示；无方案时展示有限搜索中的诊断，不宣称全局无解。材料状态仅适用于 event_programme，不提升整场状态。Unknown 不显示为零；暂定排程和时间下界明确标识，未知 reset 的显示下界不等于已验证零分钟。材料和完整检查可折叠；Insufficient 行和硬失败默认展开。Plan B 详细取舍可展开，前四项及总数可见。Proposed Enhancements 独立于正式 offering。

没有预约、审批系统、LLM 或 Stage 1 业务变更。B0 仍 PARTIAL。
