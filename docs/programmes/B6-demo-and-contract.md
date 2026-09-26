# B6 — 契约修正、命令与可复现演示

## 最小契约修正

沿用 B2-R1/B3/B4/B5，不新增 API 字段、架构或运营数据。`recommend().primary` 仍可返回相关但未确认关键覆盖的候选。`alternative` 及硬失败后的 `whatIf().plan` 必须对每个 critical theme/objective 有 Master 字段支持的覆盖（含原有有依据的语义推断）；只靠待验证辅助映射不够。preference 未覆盖不阻止替代。此门槛不是运营批准：所有证据检查照旧，仍可 NEEDS VERIFICATION。

`comparePlans(before, after, alternative = null)` 新增可选第三参数，旧两参数调用兼容。UI传入真实planB；硬失败且无Plan B时提示 `No suitable Plan B found within the search bounds.`；有Plan B则提示查看重新检查的方案及未知项，不称已获批准。

表单改 `Require participant-led delivery`；理解改 `Participant-led requirement / Required (hard constraint)`。核心participant-led规则完全不变。以上契约由三个B6回归与正向边界验证。

## 命令与启动（项目根目录）

实际环境 Node v24.15.0，TypeScript 5.7.3，已有依赖；未安装依赖或升级锁文件。PowerShell，将重定向日志目录按本机路径替换即可：

```powershell
node tests/programmes/run-b6-tests.cjs
node node_modules/typescript/lib/tsc.js --noEmit
node node_modules/typescript/lib/tsc.js -p tests/programmes/tsconfig.core.json --target ES6 --noEmit
node node_modules/next/dist/bin/next build --webpack
node tests/programmes/run-scenarios.cjs --output=../../../outputs/PAIR_B_B6_SCENARIOS_LOCAL.json
```

常规Next测试进程：`node node_modules/next/dist/bin/next start -p 3316`。本轮实际通过 PowerShell `Start-Process -WindowStyle Hidden` 启动并记录PID/日志；默认只读库存URL为 `http://127.0.0.1:8000/api`，没有审阅文件。不要为了复现启动会初始化数据库的未知服务。后端不存在时正常结果仍可降级，但 smoke 中预期正常read的断言需按测试条件说明。

另开独立进程，**仅其启动环境**设 `ORBIT_PROGRAMME_INVENTORY_API_URL=http://127.0.0.1:9/api`，运行 `node node_modules/next/dist/bin/next start -p 3317`；这是注入不可达依赖，未关闭真实Stage1后端。不要设置synthetic审阅文件。

```powershell
node tests/programmes/run-scenarios.cjs --base=http://127.0.0.1:3316/api/programmes --output=../../../outputs/PAIR_B_B6_SCENARIOS_HTTP.json
node tests/programmes/http-programme-smoke.cjs --base=http://127.0.0.1:3316/api/programmes --degraded=http://127.0.0.1:3317/api/programmes --output=../../../outputs/PAIR_B_B6_HTTP_SMOKE.json
```

前者9个真实POST均200，并逐一以响应evaluatedAt对照直接纯核心；后者10个真实HTTP包含目录、主题、正常、缺失、硬失败+未知、伪造证据400、非法ID400、无方案、库存依赖失败、GET consult 405。Class B及synthetic拒绝仍是本地集成/handler测试，与真实HTTP明确分开。

## 页面演示步骤

1. 打开 `/programme`，确认21个目录加载；按 `scenarios.json` 对应条目填结构化字段，不把brief当自动解析。每次独立场景刷新清空表单；有what-if对照时保留页面。
2. S1：加两critical主题和Teamwork preference，200人180分钟、indoor、unstable、Medium，不填年龄先评估。应显示bounded无方案及失败/未知。再用明确12–14、电力yes、指定001+019诊断，7组各活动、270下界超时。
3. S2：Water critical + Creative Science preference，40人90分钟、电力no；年龄空→Unknown。评估后年龄改7–11，旧结果OUT OF DATE；重评后保留003并仍待验证。
4. S3：Spectacular Chemistry critical、500人，时间空；相关候选pending且无合适Plan B。单独明确30分钟、选017，120分钟下界硬失败；保留所有未知。
5. S4：IoT preference + Introduce IoT architecture critical、选011；不填年龄/人数/时间先待验证。修改3–5、20人、300分钟，重评后NOT FEASIBLE，提示无合适Plan B；不得推荐丢失关键目标的幼儿活动。
6. S5：Robotics+Sustainability critical，14–16岁30人600分钟indoor，选001+019；真实证据Unknown，Plan B009+019仍pending；查看preserved/lost/improved/unresolved。已确认短缺的计算只能运行隔离B类脚本，正式页面不注入fixture。
7. 展开预算/偏好，勾选Require participant-led delivery，展开理解，必须显示Required (hard constraint)。
8. 打开3317，跑S2-age：页面仍由Programme API计算但库存读取失败，Unknown，无种子替代。只停止本轮3317进程、保留页面；改41人后提交，应提示请求失败/重试，旧结果OUT OF DATE。选local calculation重新计算，应显示41人、ACT-003仍pending、Local calculation、未刷新库存。

## 已执行与未执行的离线边界

实际执行的是本机IAB页面操作、停止自有Next/API，以及注入不可达库存URL；设备网络仍连接。工具仅公开visibility/viewport和pageAssets/webmcp，无网络离线模拟接口（能力列表另附）。**没有执行物理断网，也没有模拟offline/online事件**。不把手选local或API停机说成浏览器触发了offline事件。

现场补测：先加载页面和目录并评估，使用浏览器DevTools Network Offline（这仍是模拟，不是物理断网），修改人数/网络并评估，核对offline提示、本地结果、Unknown资源与旧结果过期；再切Online，核对模式/旧结果状态并重新请求在线API。另用真实断网重做并记录时间/截图；分别检查网络在线但库存API停机、Programme API停机。不得依赖断网冷启动或刷新恢复；未加载目录时不应宣称本地计算成功。

本轮没有重复B5的完整移动布局/键盘/真实设备矩阵；B6截图是IAB桌面实际截图。默认Turbopack旧失败仍未解决，验证通过的构建模式仅Webpack。现有backend20测试未在本轮重复执行（Stage1未改），保留前阶段Builder记录来源。
