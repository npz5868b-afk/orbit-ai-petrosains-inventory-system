# PAIR B — B7 FINAL REGRESSION / DELIVERY REPORT

## TASK / STATUS

**STATUS: PARTIAL — 本轮工程回归和累计交付 PASS；Git / commit BLOCKED，not committed yet。B0 保持 PARTIAL。** 已完成B7可执行部分，停止待审核，不合并、不推送、不部署。B7没有新增功能、LLM、API、页面功能或修改业务代码，只增加本阶段交接文档。

## GIT / 本轮只读核查

Programme工作目录仍是无自身.git的已审核源码快照。发现另一个相关真实checkout：`C:\Users\User\Documents\Codex\2026-09-10\du-y\orbit-git-auth`，remote身份匹配官方仓库（日志仅记录去凭据URL）。读取其AGENTS.md及适用父目录指引；相关AGENTS要求改Next代码前读本地Next文档，本轮未改Next业务代码。Programme源码副本中未发现适用AGENTS。

- 真实checkout分支：`teammate-ocr-performance`；HEAD：`a064d9c6b2c3e4c546225b54b7882ddd11d38455`。
- `git cat-file -t 32029e7`、`git merge-base --is-ancestor 32029e7 HEAD` 均exit128，对象不存在，**无法确认祖先关系**，不能当作“已证实不是祖先”。
- `git status --short --branch` 未列出tracked修改，但警告无法读取`backend/.pytest_cache/`。不据此声称完整工作区clean。tracked diff/cached diff均空。
- 本地未见`aiic-programme-twin`或`final-hardening`分支；没有建立目标分支。`aiic-finals-ready`没有被移动或重写；本轮后验HEAD及全部local refs与开始一致。
- 未pull/fetch/switch/stash/reset/init/commit/push/merge，也未覆盖或清理该checkout的文件。其旧分支不作为本次交付基线。

缺少的是：真实的prepared baseline对象/祖先证据、与源码快照相符的checkout、可安全操作的工作区状态及正确`aiic-programme-twin`分支。详见 `PAIR_B_B7_GIT_AUDIT.json`。不会为了提交而制造仓库历史。

## BASELINE / 累计差异

已逐文件重新核对原始ZIP，与B0/B1记录完全一致：`orbit-ai-petrosains-inventory-system-final-hardening.zip`，SHA-256 `162805528e64f70dbdbe6e070b75e49c7fe5d876aab8b447e1d0ec35788eaf00`，246个原始文件。**这是已验证的ZIP字节基线，不是已验证的Git commit基线。**

累计交付75文件：B1–B6的72个累计修改路径，加B7的3个交接文档；74新增、1修改。唯一原有共享文件是`components/app-shell.tsx`，只增加Compass import和Programme NAV项。其余245个ZIP文件字节不变。B7开始时317个已有源码文件全部字节不变，包括B6修复、B1数据与所有测试。

`PAIR_B_B7_CUMULATIVE_FILES.json`记录每个交付文件的before/after哈希及用途分类；`PAIR_B_B7_BASELINE_FILES.json`记录全部原始文件；`PAIR_B_B7_CUMULATIVE_DIFF.patch`含全部新增/修改文本，另有共享文件短补丁。`PAIR_B_B7_CUMULATIVE_CHANGES.zip`是完整累计增量，直接叠加到核对后的原始基线，**不需要逐个重放B1–B6阶段包**；它不是完整含依赖的仓库。

## DATA / 保护边界

- B1保留21个正式offering、12条约束、25条待验证主题映射、275材料行及21歧义行；6个manifest产物哈希本轮吻合。原工作簿SHA-256 `10810eb3e4ed3fa3a2cb94c828fa7965fbe4a03370157bc5b4a7ab9a705b5d4e`。
- 本轮B1测试确实提供原始Excel，19项合成+8项原工作簿测试均通过、无跳过。这是本轮Builder记录，不改写此前Operator未获得Excel的审核边界。
- 运行入口的project-local import闭包已审计：只加载7个Programme JSON（6个数据/审计+manifest），没有tests/docs fixture、原始Excel、数据库、缓存、私钥/环境文件。配置缺省时运营审阅为空；synthetic审阅仍由生产handler拒绝。
- 原始Excel仅在隔离测试输入目录；不进入累计代码包。测试中的synthetic台账明确位于`tests/programmes/`，文档例子位于docs；不作为正式默认运营数据。包内包含这些测试/文档是为了可复现，不等于运行默认数据。
- 审计检查了路径白名单、运行import闭包、私钥标记及常见credential形态，未发现命中；这不是对所有未知秘密的通用安全认证。程序未读取/打包用户其他凭据。
- Stage1交易、扫描、原API、CV、原库存数据、package.json、pnpm-lock.yaml均不变。未升级依赖。backend测试使用新隔离临时SQLite，未写正式库存；真实HTTP仅GET既有库存后端。
- 盘点、映射批准、usage basis/单位/包装换算、重用/reset、未来可用量、人员/场地/安全批准仍Unknown；成功HTTP、updated_at、Data_Confidence或synthetic通过都不能证明真实活动VERIFIED FEASIBLE。

## TESTS / 本轮实际执行

| 项目 | 本轮结果 |
|---|---|
| Programme全量 | 214检查通过：212运行测试+2源码检查，0失败/跳过；包括B2-R1/B3/B4/B5/B6 |
| B1导入 | 27测试通过，无跳过；实际读取原始Excel，不用历史通过代替 |
| backend现有测试 | 20通过，1个既有Starlette/AnyIO DeprecationWarning；使用临时DB |
| 严格TS | Programme runner内core/API两套tsconfig编译通过，TS5.7.3 |
| 项目typecheck / ES6 | 两者exit0 |
| 生产构建 | Next16.3.3 Webpack exit0，117页面生成；默认Turbopack旧限制保留，未声称所有模式通过 |
| 官方场景HTTP | 9个真实POST均200，每例与直接核心完整programme/checks/materials/PlanB/search等一致 |
| HTTP smoke | 10项通过，包括伪造证据/非法ID拒绝、硬失败+未知、库存不可达、无方案 |
| 本地完整场景 | 九个A类变体及B类synthetic资源流程不变量通过；B类是本地集成/handler测试，不是运营验证 |
| 最终页面 | 本轮实际IAB：40人API→41人手动local→41人API；待验证状态/原方案保留/旧结果过期/历史库存读取时间均正确 |
| browser offline/online事件 | 未执行：本轮查询工具仍无离线模拟能力；手动切模式不冒充该事件测试 |
| 物理断网 | 未执行；按现场清单补测，不能承诺离线冷启动或刷新恢复 |

本轮环境：Windows PowerShell；Node v24.15.0；Python3.12.14；openpyxl3.1.5；pytest8.4.2；FastAPI0.116.1；Pydantic2.13.5；httpx0.28.1；TypeScript5.7.3。依赖使用既有安装位置，没有新安装或升级。

| 命令阶段 | Exit | 用时 | 完整日志 |
|---|---|---|---|
| `ENVIRONMENT` | 0 | 0.063 s | `PAIR_B_B7_ENVIRONMENT.txt` |
| `PYTHON_ENVIRONMENT` | 0 | 0.344 s | `PAIR_B_B7_PYTHON_ENVIRONMENT.txt` |
| `BACKEND_ENVIRONMENT` | 0 | 1.453 s | `PAIR_B_B7_BACKEND_ENVIRONMENT.txt` |
| `PROGRAMME_TESTS` | 0 | 7.609 s | `PAIR_B_B7_PROGRAMME_TESTS.txt` |
| `B1_IMPORT_TESTS` | 0 | 9.516 s | `PAIR_B_B7_B1_IMPORT_TESTS.txt` |
| `BACKEND_TESTS` | 0 | 10.437 s | `PAIR_B_B7_BACKEND_TESTS.txt` |
| `TYPECHECK` | 0 | 4.5 s | `PAIR_B_B7_TYPECHECK.txt` |
| `ES6` | 0 | 1.188 s | `PAIR_B_B7_ES6.txt` |
| `BUILD_WEBPACK` | 0 | 20.609 s | `PAIR_B_B7_BUILD_WEBPACK.txt` |
| `SCENARIOS_LOCAL` | 0 | 5.11 s | `PAIR_B_B7_SCENARIOS_LOCAL.txt` |
| `SCENARIOS_HTTP` | 0 | 5.766 s | `PAIR_B_B7_SCENARIOS_HTTP.txt` |
| `HTTP_SMOKE` | 0 | 0.531 s | `PAIR_B_B7_HTTP_SMOKE.txt` |

命令argv、cwd、时间、环境覆盖和退出码在 `PAIR_B_B7_COMMAND_RESULTS.json` / `PAIR_B_B7_HTTP_COMMAND_RESULTS.json`；启动argv/只读库存配置在 `PAIR_B_B7_SERVER_COMMANDS.json`。typecheck/ES6空日志是exit0无输出，非未执行。HTTP使用本轮3318/3319本机进程；3319注入不可达库存URL，不停止既有8000后端。本轮自有进程及浏览器标签已清理。

## PAIR A 交付 / 截图来源

交接格式见 `B7-pair-a-handoff.md`，当前API/构建/复现与现场清单见 `B7-reproduce-and-integration.md`。历史B4/B5/B6契约完整保留，B7复现文档说明最终适用组合，避免将历史阶段报告误当当前无前端状态。

五场景演示沿用已审核B6步骤和真实页面截图（在交接包`evidence/B6/`，明确来源B6）；本轮9个场景HTTP全部重跑。B7在线/本地截图在`evidence/B7/`。B5移动截图作为已审核历史证据附于`evidence/B5/`，不宣称B7重新完成手机/移动矩阵。14项v1.2映射位于累计docs中的B6-acceptance-map，映射测试本轮全部运行。

## KNOWN LIMITATIONS / NEXT

Git/commit BLOCKED、not committed yet；B0 PARTIAL。默认Turbopack未解决；现场运营证据未获批准；offline/online事件、物理断网、真实移动设备/辅助技术、部署环境验证尚待进行。搜索有明示边界，不支持对所有排程组合的全局无解证明。

**停止在B7审核点。** Pair A取得正确真实checkout和32029e7基线对象后，对齐原始ZIP/当前分支差异与本累计manifest；若有他人修改，不pull/switch/覆盖。安全条件满足后再按工作包在aiic-programme-twin处理限定文件的本地提交。此次未提交、推送、合并、部署，也未扩大specification。
