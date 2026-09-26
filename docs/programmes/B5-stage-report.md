# PAIR B — B5 PROGRAMME CONSULTANT FRONTEND REPORT

## TASK / STATUS

**B5 实现与下列工程验证通过，交付待审核；B0 保持 PARTIAL。** 页面、真实 B4 API、已加载页面本地计算、What-if 与过期响应保护已完成。211 项检查、20 项现有 backend 测试、项目 typecheck、严格 core/API 编译、核心 ES6 与 **Webpack** 生产构建通过。10 项真实 HTTP 通过，并完成 IAB 桌面/移动视口实际操作。

本轮没有进入 B6、部署、合并或 LLM；没有创建预约/审批系统。物理整机断网、真实移动设备和完整辅助技术审核尚未验证，具体边界见下文，不能表述为所有环境均通过。

## INPUT SOURCE / 审核依据

- Main Work Package、完整累计版 Addendum v1.2（Programme Twin: Judge-Proof Feasibility Rules，13 节/14 个新增案例）、审核通过的 B2-R1 / B3 / B4 契约，以及本轮 B5 授权。
- 使用现有独立源码副本。B5 开始前保存 297 个源文件哈希；无真实 .git，无法由 ZIP 确认分支、HEAD 或远程同步。未 git init / commit / push / merge。
- B4 交付 ZIP SHA-256：`368d68f03856c059db08e4ca7a86cea5276e88f288864cf584df8f43ff24e399`。
- B1 workbook 溯源 SHA-256：`10810eb3e4ed3fa3a2cb94c828fa7965fbe4a03370157bc5b4a7ab9a705b5d4e`。运行时仍读 JSON，本轮未重读/重新解释 Excel；6 个 manifest 产物哈希再次一致。
- Operator 对 B4 核对 14 个文件哈希并复跑 187 项运行测试（含 36 项 API）。此前 TypeScript 源码、编译、20 backend、10 HTTP 各保留 Builder 来源；默认 Turbopack 未通过，仅 Webpack 通过。不得称为 Operator 独立全量验证。
- 本报告中的 211/20/10、浏览器和构建是本轮 Builder 验证，不是新一次 Operator 审核，也不是现场运营批准。

## CHANGED FILES

共 **13 个文件：11 新增、2 修改**。package.json、pnpm-lock.yaml 无变化，未添加依赖。

| 相对路径 | 用途与范围 |
|---|---|
| `app/programme/page.tsx` | 新增；AppShell 内 Programme 路由 |
| `components/app-shell.tsx` | 修改共享文件；仅 Compass import 与 Programme NAV 项，已获本阶段明确授权 |
| `components/programmes/consultant.tsx` | 新增；结构化输入、理解确认、加载/错误/重试、在线/本地与请求代次 |
| `components/programmes/results.tsx` | 新增；状态/失败/未知、正式来源、覆盖/排程/材料、Plan B 和 Enhancements |
| `lib/programmes/protocol.ts` | 新增；提取 B4 原有纯输入校验与限额，在线/本地共用 |
| `lib/programmes/consultation.ts` | 新增；B2/B3 共用结果组装，不另写评分或资源计算 |
| `lib/programmes/local.ts` | 新增；无网络本地入口、空资源证据、历史读取时间和代次门控 |
| `lib/programmes/server/handlers.ts` | 修改 Programme 专属文件；调用共用层并提供 opt-in 公开目录加载契约 |
| `tests/programmes/frontend.test.cjs` | 新增；23 项 B5 协议/本地/代次/边界检查，其中 1 项源码依赖图检查 |
| `tests/programmes/run-frontend-tests.cjs` | 新增；严格编译并运行全部 211 项检查 |
| `docs/programmes/B5-frontend-contract.md` | 新增；页面、最小 API 扩展、状态和离线契约 |
| `docs/programmes/B5-demo-and-validation.md` | 新增；启动、演示、真实验证与未验证边界 |
| `docs/programmes/B5-stage-report.md` | 新增；B5 阶段交付报告 |

完整 before/after SHA-256 在 `PAIR_B_B5_DIFF.json`；两个已有文件的文本差异在 `PAIR_B_B5_EXISTING_FILE_DIFF.patch`；只含上述文件的包为 `PAIR_B_B5_CHANGES.zip`。审阅包另附日志、截图和 HTTP 示例。

## IMPLEMENTATION / DATA CONTRACT

页面复用现有 AppShell、GlassCard、StatusPill、Button 与暗色主题。既有 NAV 同时服务桌面和移动端，本轮只加入 Programme。未重设计 Stage 1 页面或改变其离线队列逻辑。

结构化表单支持多主题、目标/关键性、年龄范围、人数、窗口、UTC+08 日期时间、场地、稳定/不稳定/无/未知网络、utilities、预算、无障碍和偏好。所有未知运营条件为空或 Unknown。Brief 明确不自动解析；先展示当前 draft 的 Request Understanding，再由用户确认评估。

正式结果依次显示自身的理解、整体状态、全部已知硬失败及关键未知，然后展示正式 offering/条件/Notes/来源、主题依据、storyline/journey、组数/并行/轮次/时间下界和暂定排程、材料、Plan B 取舍与独立 Proposed Enhancements。材料展开后保留原始材料名、行 ID、字段/单位/数量语境、来源和特殊值；原始 Quantity needed 不当作库存或每人用量。

B4 校验提取到 protocol.ts、结果组装提取到 consultation.ts，继续使用 B2/B3 原核心。HTTP body/依赖超时和服务端信任边界仍留在 handler/runtime。前端不提交 evidence、verified、confirmedBy、ResourcePool、PlanResult 或库存 URL。B1 未修改。

仅扩展 `GET /api/programmes/offerings?include=offline`：公开 B1Bundle、manifest 白名单和 schema。普通 offerings/themes/consult 合约兼容；此 GET 不读库存或服务端审阅，不返回端点/namespace 配置、凭据或审阅文件。客户端源码依赖图检查确认无 server/runtime、Node fs、process.env 或 server/data 导入。

What-if 默认只提交原方案合法 ID，重新验证；原方案可以保留，硬失败则另外展示重新检查的 Plan B。编辑、重算、模式/在线变化都会使旧请求失效，AbortController 和代次检查阻止旧响应覆盖；失败后旧结果仍标 OUT OF DATE。

## OFFLINE / 故障边界

已加载目录存在内存时，本地入口运行同一 B2/B3 规则。本轮选择保守边界：**浏览器不保存/复用库存原始快照或运营审阅批准**，每次本地计算使用显式 Unknown 资源证据。仅上次库存 HTTP 读取时间作为历史提示，绝不作盘点/同步确认或事件可用量。

没有目录时不能计算并提供重试；没有资源证据时目录检查可继续，但状态/材料/下一步保留 Unknown。设备网络状态与后端可达性分别显示。服务端库存失败仍有目录推荐；整个 Programme API 失败则显示错误，用户可重试或选择已加载页面本地计算。

没有 service worker / 持久化目录缓存，不承诺完全断网冷启动、关闭后恢复或刷新恢复。实际测试停掉了本轮自有 Next 服务后，在保留的页面修改人数并本地重算成功；没有物理切断电脑网络。navigator 离线事件的自动分支尚需现场人工复查，不能把本地服务失联测试写成物理断网测试。

## TESTS / 准确命令与结果

以下命令在源码根目录执行。所有列出的最终检查 exit code 为 0；空 typecheck/ES6 日志表示没有诊断，退出码另见汇总日志。

| 命令 | 实际结果 | 证据类型 |
|---|---|---|
| `node tests/programmes/run-frontend-tests.cjs` | **211 passed / 0 failed / 0 skipped** | 209 运行测试 + 原核心源码检查和新客户端依赖图检查；含原 36 API、42 B3、全部 B2-R1 回归及 23 新 B5 检查 |
| `node node_modules/typescript/lib/tsc.js --noEmit` | 通过 | 项目 strict 配置，直接等效 typecheck |
| `node node_modules/typescript/lib/tsc.js -p tests/programmes/tsconfig.core.json --target ES6 --noEmit` | 通过 | 核心 ES6；最后修改仅 JSX 展示，不改变核心 |
| `node node_modules/next/dist/bin/next build --webpack` | 通过，包含 `/programme` 与三条 Programme API | 生产构建；未通过/未修复默认 Turbopack |
| `<backend-python> -m pytest backend/tests -q --basetemp=.test-tmp/b5-backend-full` | **20 passed**，1 条既有 anyio/Starlette deprecated warning | 临时数据库、MockDetector，不写正式库存 |
| `node tests/programmes/http-programme-smoke.cjs --base=http://127.0.0.1:3306/api/programmes --degraded=http://127.0.0.1:3307/api/programmes --output=../../../outputs/PAIR_B_B5_HTTP_EXAMPLES.json` | **10 passed** | 真实 Next HTTP；库存成功/失败、非法证据/ID、未知/硬失败/无方案等 |

`<backend-python>` 本机实际为 `C:/Users/User/Documents/Codex/2026-09-10/du-y/orbit-ai-petrosains-inventory-system/.venv/Scripts/python.exe`。Node v24.15.0、TypeScript 5.7.3；没有安装依赖。本机复用现有 node_modules junction，默认 Turbopack 的外部目录链接问题保留 B4 失败记录；本轮未重复该已知失败命令，也未称其通过。

## BROWSER / 实际操作

使用本机 IAB 和真实生产页面，非静态图稿。规划输入为测试情景，不是官方示例默认答案。

| 检查 | 观察结果 |
|---|---|
| 多主题 / 信息缺失 | 正式 API 响应 NEEDS VERIFICATION；待确认目录、Notes、材料 Unknown 和搜索边界可见 |
| What-if 保留 | 30→31 人，原方案 ID 保留、重新检查，未知不升级 |
| What-if 硬失败及 Plan B | Solar Fan 年龄改为 4–8，NOT FEASIBLE 与未知并存；Colour Play Plan B 重新检查，仍 NEEDS VERIFICATION |
| 快速连续提交 | 40 人请求后修改/提交 42 人，最终结果理解是 42；受控逆序 promise 另由 Node 测试覆盖 |
| 输入错误 / 无方案 | 14-4 年龄有校验提示；1 分钟窗口+重新搜索显示 bounded no plan 和失败诊断 |
| 日期 / 键盘 | 原生日期键盘操作后，结果含 `2026-11-01T10:00:00+08:00`；Tab 从 Audience 到 Age，焦点可见 |
| 后端不可达 | 单独实例指向不可达库存端口，设备在线但库存失败，仍推荐并保留 Unknown，无 seed/cache 替代 |
| Programme 服务失联 | 停本轮自有 Next 后提交报错，旧结果 OUT OF DATE；切本地并改 31 人成功，历史读取时间不作证据 |
| 响应式 | 1440×1000、390×844、320×740；表单控件/导航无检测到的横向越界，Programme 位于桌面与移动 NAV |

截图、DOM 记录、HTTP 请求/响应与命令日志另附。日期自动 fill 在此浏览器工具中未触发 React 更新时，未按外观宣称通过，改用原生键盘后核对 Request Understanding 才记为通过。没有浏览器网络限速强制逆序测试；快速提交为真实操作，严格逆序为隔离测试。

## DATA AUDIT / RISKS / UNRESOLVED

- 原 ZIP 的 246 个文件中，除已授权 AppShell NAV 外，**245 个字节不变**。B1 baseline 同样仅 AppShell 例外；6 个数据哈希吻合。Stage 1 交易、扫描、CV、库存数据、原 API、package/lock 都不变。
- 官方 21 offerings、12 rules、25 待验证主题映射、275 材料行继续保留；Notes 中草稿/假设与 High confidence 不自动成为批准。
- 真实盘点、材料 alias/规格/单位换算/usage basis/重用/reset 批准、活动时段库存、人员、房间、预约、安全仍待运营证据。HTTP 读取不核实这些事实。
- B0 Git 基线仍未知。本轮没有真实分支或 commit 可交付，后续集成必须由 Pair A 在真实 checkout 对齐基线和审阅差异。
- 浏览器端目前保守舍弃运营证据，离线不能继承在线可行状态；这是明确边界，不是完成真实库存离线快照联通。
- 未完成物理断网、真实手机/多浏览器/完整屏幕阅读器矩阵、部署环境与默认 Turbopack 验证。截图为本机 IAB 视口，不是实际手机拍摄。
- 基础 AppShell 的在线灯及 Stage 1 sync 行为保持既有实现；Programme 自身状态单独解释 API/本地及资源依赖，不把在线灯等同于库存已核实。

## NEXT

**停止于 B5 审核。** 请审核代码包、两个已有文件的 before/after、客户端边界和真实浏览器记录。未开始 B6、部署、合并或新增规格。后续待批准后再进行 B6；现场需补物理断网与运营证据验证。
