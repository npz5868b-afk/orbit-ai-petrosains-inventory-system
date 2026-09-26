# B5 操作、复现与验证边界

## 启动

在已审核 B4 源码上按差异哈希核对后应用 B5 文件。不要覆盖不同基线的本地改动。当前副本没有 .git，包不是 commit/merge。

使用项目既有依赖。本机 node_modules 是原有依赖目录的 junction，本轮未安装依赖、未修改 package.json 或 pnpm-lock.yaml。pnpm wrapper 的本机行为有已知问题，验证使用 script 的等效直接命令。

```powershell
node tests/programmes/run-frontend-tests.cjs
node node_modules/typescript/lib/tsc.js --noEmit
node node_modules/typescript/lib/tsc.js -p tests/programmes/tsconfig.core.json --target ES6 --noEmit
node node_modules/next/dist/bin/next build --webpack
node node_modules/next/dist/bin/next start -p 3306 -H 127.0.0.1
```

浏览器打开 http://127.0.0.1:3306/programme 。库存默认只读 http://127.0.0.1:8000/api；审阅记录缺省为空。B4 服务端环境配置仍适用。不要把 synthetic fixtures 配成默认运营证据。

默认 Turbopack 在此 junction 环境的失败沿用 B4 记录，本轮没有宣称修复或再次通过；已通过的是 Webpack。

## 演示步骤（输入是测试规划请求，不是实际活动承诺）

1. 确认初始年龄/人数/时长/场地/网络等 Unknown，页面明确 Brief 不自动解析。等待 21 offering 目录加载。分别添加 Sustainability、Robotics 偏好主题及 Teamwork 偏好目标；填写 Secondary school、12-14、30 人、240 分钟、indoor、unstable、electricity yes。预算/无障碍/水可以保留 Unknown，或按真实已知信息填写。
2. 阅读 Request Understanding，再 Confirm & evaluate。实际浏览器显示 NEEDS VERIFICATION、目录正式名、待确认 availability、Notes 和未知材料；切勿称为获批活动。搜索结果由完整输入、证据和范围决定，不硬编码固定组合。
3. 人数改为 31。确认旧结果 OUT OF DATE，默认 Recheck original plan 开启，重新评估可保留原 ID，未知项不升级。
4. 对仅 Sustainability/Robotics 请求的 Solar Fan 原计划，年龄改为 4-8；得到 NOT FEASIBLE 年龄失败，同时仍有未知项，重新检查的 Colour Play Plan B 保留 NEEDS VERIFICATION。不能把这是学习目标完全等价的替代。
5. 人数快速改为 40→提交→42→提交。最终结果理解必须是 42，旧响应不能覆盖。可在浏览器网络开发工具中对请求限速进一步人工复查逆序返回；自动回归也使用延迟 promise 验证代次门控。
6. 把窗口改为 1 分钟并取消 Recheck original plan，观察有限搜索无合适方案、所有诊断硬失败、搜索边界与未确定项。
7. 年龄填 14-4，提交显示字段错误。Unknown 可以提交为待确认结果；0 或超上限人数不合法。日期控件使用 UTC+08；通过原生日期键盘选择后核对理解中的时区时间。
8. 将独立测试 Next 实例的 ORBIT_PROGRAMME_INVENTORY_API_URL 配为 http://127.0.0.1:9/api（仅测试服务），启动另一端口。设备仍在线，目录推荐可运行，库存读取失败与资源 Unknown 明确显示。不要停止现有 Stage 1 后端。
9. 正常页面加载并完成一次评估后，仅停止自己启动的 Next 进程。再次在线提交必须提示请求失败，旧结果过期。选择 Use loaded-page local calculation 并改变人数后重算，页面仍能产生 B2/B3 的本地结果，历史库存时间保留但全部库存/审批证据 Unknown。不得刷新或关闭页面后期待离线恢复。
10. 在 1440×1000、390×844 和 320×740 检查响应式布局；六项导航中的 Programme 可见。Tab 可从 Audience 移到 Age，原生 details 可键盘展开；表单有标签、loading/status/alert 和可见焦点。

## 本轮实际验证与未验证

- 真浏览器：Codex IAB 本机 Webpack production 页面，实际操作表单和 B4 HTTP；含多主题、未知、年龄硬失败+Plan B、保留原方案、连续提交、非法年龄、无合适方案、日期键盘、320/390/1440 布局和导航。保存 DOM 记录与截图，不是静态 mockup。
- 真故障注入：独立 Next 实例指向不可达库存端点；正常已加载页面停止自有 Next 服务后完成本地计算。没有操作、重置或停止现有 Stage 1 后端。
- 本机库存 HTTP 成功不代表真实盘点或未来可用量；演示请求不是现场验证。未加载合成库存、批准或测试 offering 为运行默认值。
- 合成/隔离测试：Node runner 的 fixtures、注入 transport/clock 和延迟 promise；backend pytest 使用 tmp_path 数据库和 MockDetector；它们不等同于现场运营验证。
- 未实际切断整台电脑网络，未对浏览器注入 navigator.offline 事件；已证明的是加载页面在 Programme 服务失联时仍可本地重算。自动离线事件分支经代码检查，物理断网仍列为人工复查事项。
- 未做真实移动设备、跨浏览器矩阵或完整屏幕阅读器审核；本次是 IAB 视口、标签与基础键盘检查。未测冷启动/刷新离线，产品本来也不承诺这些能力。
- CUA 日期 fill 在本机只改变 DOM 时未触发 React 更新；进一步使用日期原生 ArrowUp/Tab 确认 Request Understanding 和 API 结果实际包含 2026-11-01T10:00:00+08:00。复现必须核对理解，不把控件外观当作已提交。
