# PAIR B — B4 PROGRAMME API REPORT

## TASK / STATUS

**B4 实现、handler/HTTP 验证通过，停在 B4 审核。** 188 项核心／资源／API 测试、20 项现有 backend 测试、项目 typecheck、严格 API/core 编译及核心 ES6 检查通过。Next **Webpack 生产构建通过**；默认 Turbopack 构建因本机复用依赖的外部目录链接失败，不能写成默认构建已通过。

仅实现三个已批准 Next API：GET /api/programmes/offerings、GET /api/programmes/themes、POST /api/programmes/consult。没有 B5 前端、LLM 或 Stage 1 API／交易／扫描／库存／CV 修改。**B0 继续 PARTIAL**，没有从 ZIP 推断 Git 基线，未初始化、提交、推送或合并 Git。

## INPUT SOURCE / 审核证据边界

- 依据 Main Work Package、完整累计版 Addendum v1.2、B2-R1 与 B3 契约，沿用审核后的独立源码副本。
- B3 包 SHA-256：`9ea3dc792b40ca792eb926b06b46496e07f3cdc05c4b8d4c7ad4847d36ae40a7`；本轮前保存 304 个文件哈希。
- B1 workbook 来源 SHA-256：`10810eb3e4ed3fa3a2cb94c828fa7965fbe4a03370157bc5b4a7ab9a705b5d4e`；本轮读取 JSON 而非 Excel，6 个 manifest 产物字节哈希再次吻合。
- Operator 上轮核对 12 个 B3 交付文件与 3 个修改基线，并独立复跑 **151 项运行测试（含 42 项 B3）**。TypeScript/AST/严格/ES6 仍依据 Builder 记录，本机 HTTP 读取未由 Operator 独立复现。不得把它合并称为 Operator 独立通过 152 项及全部集成。
- 本轮的 188 项与真实 HTTP 都是本轮 Builder 验证，仍等待 Operator 的 B4 审核。盘点、mapping 批准、未来可用量仍未验证。

## IMPLEMENTATION

route 只导出 handler；没有重新实现评分、资源数量、状态优先级或排程。server/data.ts 打包 B1 JSON，handlers.ts 调用原 adaptCatalogue/normalizeRequest/adaptResources/evaluatePlan/recommend/materialFeasibility。独立 core 仍无 HTTP、Node/DOM 或 LLM 依赖。

客户端仅提交结构化 stakeholder request、合法 offering IDs、setup 参数与受限搜索选项。白名单在顶层和嵌套对象生效：verified、confirmedBy、evidence、ResourcePool、PlanResult、库存 URL、namespace 或旧结果均不能作为客户端权威输入。服务端 now 决定 evaluatedAt；库存 URL、安装 namespace 和只读审阅文件由环境变量控制，默认没有任何批准记录。

服务端审阅 JSON 有 1 MiB 上限，并拒绝 synthetic kind/method。B3 的审阅人、单位、来源、事件时段和规格规则继续执行；配置异常返回无内部详情的 503。代码不认证签名，授权记录真实性仍是运营审阅责任。

请求体上限 64 KiB，5 秒读取期限；人数最多 1,000，活动窗口最多 1,440 分钟。搜索最多 3 活动/200 次，另有限定 workload；返回实际搜索范围、截断情况与诊断额外计算次数。输入非法与依赖错误独立；信息缺失、硬失败、无方案以及库存降级都作为已执行评估的 200 响应保留真实状态，HTTP 200 不意味着可行。

库存 readInventory 有整体 1,500ms AbortSignal 与 1,550ms 外层保护。失败时没有 seed/cache 回退，不凭读取成功批准实物数量。用空未知库存输入保留目录与确定性检查，无法绑定 SKU 的库存／材料审阅暂不应用，独立 operational 证据仍参与检查。degraded/state/explanation 明确说明。

响应覆盖理解、缺失信息、假设、正式推荐、主题覆盖、storyline、journey、全部检查、材料范围状态、重验 Plan B、取舍、Proposed Enhancements、来源和搜索限制。指定的原 plan 总会重新算，不采信旧结论；本轮不扩展独立 What-if 协议，改条件后提交相同 ID 即可重新评估。无方案时保留有限失败诊断的未知项。

## CHANGED FILES

相对 B3：**新增 13 个文件，修改 1 个 Programme 测试配置，删除 0**。

| 相对根目录路径 | 变更 | 用途 |
| --- | --- | --- |
| `tests/programmes/tsconfig.core.json` | 修改 | 排除 server 文件夹，保留原纯核心仅 ES 类型环境 |
| `app/api/programmes/offerings/route.ts` | 新增 | GET 正式目录入口；Node dynamic route |
| `app/api/programmes/themes/route.ts` | 新增 | GET Master 主题及待验证辅助映射 |
| `app/api/programmes/consult/route.ts` | 新增 | POST 规划与可行性入口 |
| `lib/programmes/server/data.ts` | 新增 | 静态导入 B1 JSON，运行时不读 Excel |
| `lib/programmes/server/handlers.ts` | 新增 | HTTP 校验、预算、依赖降级及原 B2/B3 调用编排 |
| `lib/programmes/server/runtime.ts` | 新增 | 服务端配置、只读审阅文件与限时库存 transport |
| `tests/programmes/api.test.cjs` | 新增 | 36 项 handler／路由／信任边界／核心等价测试 |
| `tests/programmes/run-api-tests.cjs` | 新增 | 独立严格编译后执行全部 188 项测试 |
| `tests/programmes/tsconfig.api.json` | 新增 | Node/DOM HTTP 运行层的严格测试编译配置 |
| `tests/programmes/http-programme-smoke.cjs` | 新增 | 明确 endpoint 的 10 项真实 HTTP 验证 |
| `docs/programmes/B4-api-contract.md` | 新增 | API 形状、权限边界、错误、限额和启动复现 |
| `docs/programmes/B4-api-examples.json` | 新增 | 10 组实际 HTTP 请求／响应，非运营批准默认数据 |
| `docs/programmes/B4-stage-report.md` | 新增 | 本阶段报告 |

没有修改 package.json、pnpm-lock.yaml、根 tsconfig、next.config、导航、Stage 1 文件或 B1/B3 原数据。新增 server 子目录与三个 route 均在 Pair B 获准路径；修改 tsconfig.core 仅为将 API I/O 编译与浏览器可复用的纯核心编译隔离。

node_modules 仅为本机既有依赖的临时目录链接，不打包。Next 生成的 .next、next-env.d.ts、tsconfig.tsbuildinfo、测试编译输出及临时 backend 数据库均不打包。pnpm 包装器自动产生的 pnpm-workspace.yaml 已移出源码，未交付为共享配置变化。

原 ZIP 246 个文件、B1 基线 267 个文件、B1 的 6 个数据产物哈希全部相同；B2/B3 业务源码也未修改。完整 before/after 哈希见 PAIR_B_B4_DIFF.json。

## VALIDATION / 准确命令与结果

当前 Node v24.15.0、Next 16.3.3、TypeScript 5.7.3；Python 3.12.14，pytest 8.4.2、FastAPI 0.116.1、httpx 0.28.1、uvicorn 0.35.0。借用现有环境，未升级依赖。

从源码根目录实际运行：

```powershell
node tests/programmes/run-api-tests.cjs
node node_modules/typescript/lib/tsc.js --noEmit
node node_modules/typescript/lib/tsc.js -p tests/programmes/tsconfig.core.json --target ES6 --module ESNext --moduleResolution Bundler --noEmit
node node_modules/next/dist/bin/next build
node node_modules/next/dist/bin/next build --webpack
$env:PYTHONDONTWRITEBYTECODE='1'
& 'C:\Users\User\Documents\Codex\2026-09-10\du-y\orbit-ai-petrosains-inventory-system\.venv\Scripts\python.exe' -m pytest backend/tests -q -p no:cacheprovider --basetemp .test-tmp/b4-backend
```

| 检查 | 结果／范围 |
| --- | --- |
| B2/B3/API runner | **188 passed，0 failed，0 skipped**＝原 152＋新 36；包含源码 AST 检查 |
| core/API 独立 strict、unused 检查 | 通过；纯 core 不引入 DOM/Node 类型 |
| 项目 typecheck 直接等价命令 | exit 0 |
| 核心 ES6/ESNext/Bundler noEmit | exit 0 |
| 现有 backend/tests | **20 passed**，1 个既有 Starlette/anyio 弃用 warning；临时数据库和 mock detector，不指向现有库存库 |
| 默认 Next build（Turbopack） | **失败**：node_modules 目录链接指向项目文件系统根外 |
| Next build --webpack | **通过**，生成三个 Programme 动态路由和现有应用页面 |
| 实际 HTTP smoke | **10/10 通过**；独立 Next production server 实际 HTTP，不是直接函数模拟 |

`pnpm.cmd typecheck` 也曾尝试：环境提供的 pnpm 包装器先尝试自动 install/整理 modules，因无 TTY 中止（ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY）。未允许删除或升级共享依赖；转用上述直接命令。失败日志保留，不能将此包装器命令写成成功。默认 Turbopack 问题未通过改共享配置规避；正常本地安装环境仍应复验默认构建。

handler 测试覆盖正常输入、缺失、非法日期／枚举／人数／搜索预算、伪造证据与 URL、异常脱敏、库存错误/悬挂超时、硬失败与未知、无方案、方法导出、JSON 原始哈希，以及同输入/时钟/证据下 API programme 与直接 B2/B3 输出逐字节等价。

## ACTUAL HTTP / 请求响应示例

Webpack 生产构建启动两个临时 Next 实例：127.0.0.1:3304（库存指向已运行 8000 API）、127.0.0.1:3305（指向没有服务的 65530，仅用于故障测试）。未启动／重启或停止用户的 Stage 1 服务。完成后两个测试 Next 进程均已停止。

实际命令：

```powershell
node tests/programmes/http-programme-smoke.cjs --base=http://127.0.0.1:3304/api/programmes --degraded=http://127.0.0.1:3305/api/programmes --output=../../../outputs/PAIR_B_B4_HTTP_EXAMPLES.json
```

| HTTP 场景 | 实际结果 |
| --- | --- |
| 正式目录／主题 | 200，21 offering，辅助 mapping pending |
| 正常指定 ACT-001 | 200，NEEDS VERIFICATION，inventory.state=read |
| 信息缺失 | 200，有 missingInformation |
| 1 分钟已知硬失败与资源未知 | 200，NOT FEASIBLE，两类 Check 同时保留 |
| 客户端 evidence／假 offering | 400／400 |
| 2 次预算下无方案 | 200，programme=null，exhaustedWithinBounds=false |
| 后端连接不可达 | 200，NEEDS VERIFICATION，degraded=true，无未来量填充 |
| 对 consult 使用 GET | 405 |

完整 10 组请求与响应记录于 `2026-09-26T03:24:49.618Z`，见 B4-api-examples.json / PAIR_B_B4_HTTP_EXAMPLES.json。这些响应有真实执行时间，不要求跨运行字节一致；确定性通过注入相同时钟/证据的 handler 等价测试验证。**实际 HTTP timeout 未模拟；悬挂/TimeoutError 在 handler 层测试，HTTP 故障为连接不可达。**

## CONTRACT / 启动与剩余依赖

详见 B4-api-contract.md。正常运行需配置后端基础地址与稳定 namespace；审阅文件可选，缺失时 pending。读取成功不是盘点；未来预约、人员、场地、安全和材料批准仍须运营证据。服务端配置文件不是通过本 API 上传或批准的。

启动使用已构建 Next：`node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3304`。复现故障实例前只在该实例环境设置 ORBIT_PROGRAMME_INVENTORY_API_URL，不更改 Stage 1 服务。完整示例、限额、错误码和复现步骤在契约文档。

## RISKS / 未验证与停止点

- B0 PARTIAL：无真实 Git checkout 基线，不确认分支、HEAD、远程同步。
- 真实盘点、verified exact/alias、未来可用量与运营批准仍缺；B4 默认不会产生 VERIFIED FEASIBLE 的真实运营承诺。
- 默认 Turbopack 在依赖目录链接环境失败；已通过的是 Webpack production build。不能声称所有构建模式均通过。
- 服务端审阅源的真实性、签署权限与部署身份／访问控制须由集成环境确认；没有接入新的身份系统或外部 LLM。
- 未验证生产部署、远程网络、前端交互、断网冷启动或刷新恢复；本轮未重新导入 B1 Excel。
- HTTP 和测试是 Builder 的执行结果，尚未成为 Operator 独立复验；历史 151 项边界保留。

**完成 B4，等待阶段审核，不进入 B5。**
