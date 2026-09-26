# B7 — Pair A 最终契约 / 复现 / 集成说明

## 适用契约与包的应用边界

当前完整行为由 `B2-core-contract.md`（含R1）、`B3-resource-contract.md`、`B4-api-contract.md`、`B5-frontend-contract.md` 和 `B6-demo-and-contract.md` 共同定义。B4报告中的“本阶段无前端”是历史范围，最终已有 `/programme`。B6关于Plan B critical覆盖、what-if摘要以及participant-led硬要求的修正均在累计代码中。

基线是清单内SHA匹配的原始ZIP，不是已验证Git提交。先比较 `PAIR_B_B7_BASELINE_FILES.json` 及 `CUMULATIVE_FILES.json`。现有同名文件若与before不同，或新增路径已被他人创建，应先审阅冲突，不覆盖。代码包有75个累计路径，可一次应用到独立匹配副本；不要把B6增量当完整实现，不复制node_modules/.next/数据库/原Excel。

当前真实旧checkout缺少32029e7，不能直接应用并提交。本轮没有运行任何commit命令；不要把下面的检查步骤当已执行提交。Pair A确认真实基线、状态和分支后，按工作包只在aiic-programme-twin处理本包的明确文件清单；有改动时禁止pull/switch，保持aiic-finals-ready不动，不使用`git add .`混入他人文件。

## 最终API契约摘要

| 端点 | 行为 |
|---|---|
| GET /api/programmes/offerings | 21个正式ID/名称/原字段/Notes/来源，身份与可执行性分离 |
| GET /api/programmes/themes | Master主题和pending辅助映射，不提供运营批准 |
| GET /api/programmes/offerings?include=offline | B5 opt-in公开B1Bundle；manifest白名单，无服务端审阅/库存URL/凭据 |
| POST /api/programmes/consult | request + 可选plan/search，返回理解/缺失/假设/方案/覆盖/排程/检查/材料/PlanB/取舍/Enhancements/来源 |

客户端只提交stakeholder规划信息及合法正式offering IDs。不接受verified、confirmedBy、ResourcePool、旧PlanResult、库存URL/namespace或审阅数据。What-if提交修改后的request和原plan IDs，由核心重新评估。Brief不自动解析；Unknown/Optional/No/零不混淆。材料Sufficient不代表整场可行。

64KiB请求体，最多1000人/1440分钟/3活动/200评估，另有60000工作量预算；默认限额由人数×活动数计算。格式非法400，体过大413，超时408，媒体类型415，方法405；信息缺失/不可行/库存降级仍为200带业务状态；目录或审阅配置不可用503。错误不返回内部stack/凭据。具体字段和响应示例见B4/B5契约与本轮HTTP JSON。

Plan B经过同一套检查且保留每个critical主题/目标的Master依据；仅pending辅助映射不足以充当等价替代。它仍可为NEEDS VERIFICATION，Master支持不是运营批准。没有合适替代如实显示，不能强行换推荐或放松关键条件。

服务端配置：`ORBIT_PROGRAMME_INVENTORY_API_URL` 默认 `http://127.0.0.1:8000/api`；`ORBIT_PROGRAMME_INVENTORY_NAMESPACE` 默认 `orbit-primary`；`ORBIT_PROGRAMME_REVIEW_FILE` 未设时stocks/materials/operational为空。库存读1500ms超时，故障降级Unknown，无seed/cache回退。禁止配置tests里的synthetic台账；生产handler会拒绝。

## 本轮环境及准确复现

原项目package.json仍有typecheck/build脚本，未新增或升级依赖。本轮用现有Node和本地依赖直接执行等价命令，避免包装器改变共享安装。TS5.7.3、Next16.3.3、React19.2.4；Node24.15.0。完整实际argv/cwd/退出码/时间见交付COMMAND_RESULTS JSON。

在匹配源码根目录运行：

```powershell
node tests/programmes/run-b6-tests.cjs
node node_modules/typescript/lib/tsc.js --noEmit
node node_modules/typescript/lib/tsc.js -p tests/programmes/tsconfig.core.json --target ES6 --noEmit
node node_modules/next/dist/bin/next build --webpack
node tests/programmes/run-scenarios.cjs --output=<独立输出目录>/scenarios-local.json
```

Programme runner自动严格编译core/API后运行214检查。B1独立导入测试（不加载backend pytest夹具）需要Python3.12/openpyxl3.1.5及SHA匹配的原工作簿：

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
$env:ORBIT_PROGRAMME_WORKBOOK='<隔离目录>\DATASET_PROGRAMME CATALOGUE.xlsx'
python -X utf8 -m unittest discover -s tests/programmes -p 'test_*.py' -v
python -X utf8 -m pytest backend/tests -q -p no:cacheprovider --basetemp '<新的独立临时目录>'
```

本轮两个Python可执行位置在日志中：导入用Codex内置Python，backend用既有项目venv。若没有原Excel，8项官方工作簿测试会跳过，**不能**称27项全部复现。backend临时路径必须全新且专用，避免pytest清理别人的临时文件；测试使用MockDetector和临时SQLite。

启动已构建的本地Next（不部署）：

```powershell
$env:ORBIT_PROGRAMME_INVENTORY_API_URL='http://127.0.0.1:8000/api'
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3318
```

另一个独立测试进程仅对其环境设置库存URL为 `http://127.0.0.1:9/api`，端口3319；不停止或修改真实8000后端。两者都不设置审阅文件。API启动进程在本轮用CREATE_NO_WINDOW隐藏运行，具体argv/PID/环境在SERVER_COMMANDS JSON。

```powershell
node tests/programmes/run-scenarios.cjs --base=http://127.0.0.1:3318/api/programmes --output=<独立输出目录>/scenarios-http.json
node tests/programmes/http-programme-smoke.cjs --base=http://127.0.0.1:3318/api/programmes --degraded=http://127.0.0.1:3319/api/programmes --output=<独立输出目录>/http-smoke.json
```

正常read断言需要现有可读取库存后端；不要为复现而擅自启动会初始化生产DB的服务。没有后端时可验证降级，但应明确与正常read用例不同。不会自动用seed冒充live。

## 五场景演示 / 截图

按 `tests/programmes/scenarios.json` 和 `B6-demo-and-contract.md` 填结构化字段；每个原始缺失版本和显式补充版本清楚分开。完整九个实际输出在本轮 `PAIR_B_B7_SCENARIOS_HTTP.json`，不是沿用旧成功日志。

| 场景 | 演示重点 | 审核截图（B6来源） |
|---|---|---|
| 200 secondary、180分钟、室内unstable、Sustainability+Robotics critical、Teamwork preference | 年龄先Unknown；显式12–14/electricity yes指定001+019后仍270分钟下界硬失败，7组不假设7通道 | S1-original-no-plan、S1 |
| 40 primary、90分钟、无电、Water critical+Creative Science preference | 年龄不推断；补7–11后保留003且pending，材料8行Unknown | S2-unknown-age、S2-age-retained |
| 500公众、Spectacular Chemistry critical | “较短”先Unknown；30分钟是测试设定，017下界120硬失败；无足够关键依据的替代不出PlanB | S3-unknown-window、S3-30-min |
| preschool/young、Arduino300类critical目标 | 年龄先Unknown；显式3–5与14+硬冲突；无等价PlanB，不替成不相关幼儿活动 | S4-unknown-age、S4-age-hard-fixed |
| Robotics+Sustainability critical，资源不可用 | A类未批准不可用声明仍Unknown；B类隔离确认短缺后001+018替代保留两个关键主题、解释损失 | S5；B类见本轮JSON和集成脚本，不放入正式页面 |

交接包evidence/B6含上述已审核真实IAB截图、矩阵和页面文本；evidence/B7有本轮API40人→本地41人→API41人的截图/文本。移动截图是evidence/B5的既有审核来源，本轮未重复完整移动矩阵。

## 现场补测 / 已知限制

1. 工具能力列表没有网络offline模拟，本轮未触发浏览器offline/online事件；手选local不是事件模拟。现场先加载目录和页面，用DevTools Offline改变网络、修改人数并评估，核对自动local/Unknown/旧结果过期；再Online重评。记录这只是模拟。
2. 另做物理断网/恢复，同样记录最新输入、模式、时间和来源。明确不支持未加载页面冷启动、离线刷新恢复。不可将库存后端失联、Programme API失联、浏览器网络离线混为一件事。
3. 核实真实盘点、材料mapping/规格/单位/usage basis/包装换算/重用/reset、人员/场地/时段预约/安全证据；未获批准始终Unknown。不要用演示80packs或conversion_to_base=1推导人数倍率。
4. 默认Turbopack旧问题未修；只Webpack通过。补真实设备/辅助技术、部署环境验证需独立记录，不据本机测试宣称全环境通过。
5. Git prepared baseline及目标分支未确认，not committed yet；由Pair A做最终基线/集成决定。此次停在B7审核，不合并、不推送、不部署。
