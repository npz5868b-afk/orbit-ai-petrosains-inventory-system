# PAIR B — B1 DATASET IMPORTER + AUDIT

## TASK

完成已授权的 B1：下载原始 Programme Catalogue、先读 Participant_README 与 Data_Dictionary、检查真实工作表、开发 Python 导入器、生成确定性运行时 JSON、测试及审计。依据 Main Work Package＋完整累计版 Addendum v1.2（Programme Twin: Judge-Proof Feasibility Rules）。本阶段不扩充规格，不进入 B2。

## STATUS

**B1 导入工程与数据保真验收：PASS。运营数据验证：PARTIAL／NEEDS VERIFICATION。B0 报告继续保留 PARTIAL，未改写。**

官方原始 Excel 现已实际取得、读取并逐单元格核验，已解除此前的 Excel 获取阻塞。这不等于所有目录内容、数量基准或运营条件获得确认。真实 Git 基线仍未验证；本工作目录是无 `.git` 的独立 ZIP 源码副本。

已实际运行 27 项测试，全部通过、无跳过。原始 ZIP 的 **246 个文件逐个 SHA-256 相同：修改 0、删除 0**。交付新增 12 个文件。没有启动应用／数据库服务、迁移、修改库存、训练 CV、修改 API、导航、package.json 或 pnpm-lock.yaml。

## INPUT SOURCE

- 原始文件实际名称：`DATASET_PROGRAMME CATALOGUE.xlsx`；10,846,744 字节。
- SHA-256：`10810eb3e4ed3fa3a2cb94c828fa7965fbe4a03370157bc5b4a7ab9a705b5d4e`。
- 已知来源：用户提供的 [AIIC FINALS KIT Google Drive 文件夹](https://drive.google.com/drive/folders/10dsvHGKZzkvrpt97QM85sEqbeuh8Gjsp)；[原始文件](https://drive.google.com/file/d/1d6LMttltK_cifuOrivyUzu9_pYMdK0Tv/view)，file ID `1d6LMttltK_cifuOrivyUzu9_pYMdK0Tv`。读取的是下载后的原始 XLSX，并非网页预览。
- 本地获得时间记录：`2026-09-26T09:35:12.2047548+08:00`。这是取得副本的时间记录，**不是官方发布日期／更新日期**；后者保持 null。
- 原始输入只读使用，导入前后哈希一致。输出目录另附同字节原始 Excel，方便审核和复现。
- 源码 ZIP：`orbit-ai-petrosains-inventory-system-final-hardening.zip`；SHA-256 `162805528e64f70dbdbe6e070b75e49c7fe5d876aab8b447e1d0ec35788eaf00`。
- 工作包：`AIIC_Finals_PAIR_B_Operator_Work_Package_ORBIT_Programme_Twin (1).md`，SHA-256 `1a25d1d28c62110c3ef859f3a381b71faeae1573b8cac585f5d8d7c849e4c29f`。
- Addendum：`AIIC_Finals_PAIR_B_Operator_Addendum_v1_2 (1).md`，SHA-256 `d3d4477687a1b519665782d22a9854aaad5e86f88d5aaba10a0b270f69e124ff`；已选完整累计版，13 个编号章节，Section 12 有 14 个新增验收案例。未使用另一副标题的同名版本。
- 独立开发副本：`C:\Users\User\Documents\Codex\2026-09-26\ni\work\pair-b-b1\orbit-ai-petrosains-inventory-system-final-hardening`。未执行 git init、pull、switch、stash、reset、commit、push 或 merge。分支、HEAD `32029e7`、远程同步与工作区干净状态仍无法从 ZIP 证实。

真实工作表共 26 张，按 workbook 原始顺序：

1. `Offerings_Master`
2. `Theme_Objective_Mapping`
3. `ACT-001_Mini Drone`
4. `ACT-002_Microbit`
5. `ACT-003_Bottle Aquarium`
6. `ACT-004_Colour Play`
7. `ACT-005_Gas Detector`
8. `ACT-006_LED Lantern`
9. `ACT-007_Scribbling Machine`
10. `ACT-008_LED Flashlight`
11. `ACT-009_Arduino 100`
12. `ACT-010_Arduino 200`
13. `ACT-011_Arduino 300`
14. `ACT-012_DIY Catapult`
15. `ACT-013_DIY Ice Cream`
16. `ACT-014_Water water Everywhere`
17. `ACT-015_Combustion Show`
18. `ACT-016_Eat, Prey, Love Show`
19. `ACT-017_Cool Chem Show`
20. `ACT-018_Sustainable Suds`
21. `ACT-019_Solar Fan`
22. `ACT-020_Fabolous Fizzy`
23. `ACT-021_Elephant_Toothpaste`
24. `Constraint_Rules`
25. `Data_Dictionary`
26. `Participant_README`

## CHANGED FILES

以下路径均相对于源码副本根目录。全部为 B1 新增文件；现有文件未修改，未新增后续 API、TS 核心或浏览器代码。

| 相对路径 | 用途 | 变更／共享状态 |
| --- | --- | --- |
| `backend/requirements-programme-import.txt` | 隔离导入／测试依赖 openpyxl==3.1.5；未安装或升级任何依赖 | 新增；无现有共享文件修改 |
| `backend/scripts/import_programme_catalogue.py` | 只读 Excel 导入、结构校验、来源定位、公式／缓存保留及确定性 JSON 输出 | 新增；无现有共享文件修改 |
| `backend/data/programmes/source_manifest.json` | 来源、获得时间、SHA-256、26 张表和 6 个数据产物的摘要 | 新增；无现有共享文件修改 |
| `backend/data/programmes/programme_offerings.json` | 21 个 offering，保留全部 34 个原始字段 | 新增；无现有共享文件修改 |
| `backend/data/programmes/programme_theme_mapping.json` | 25 条辅助映射，不作为固定推荐答案 | 新增；无现有共享文件修改 |
| `backend/data/programmes/programme_constraints.json` | 12 条完整官方约束文本 | 新增；无现有共享文件修改 |
| `backend/data/programmes/programme_dictionary.json` | 14 条字典定义及 Participant_README 全部非空单元格文本 | 新增；无现有共享文件修改 |
| `backend/data/programmes/programme_materials.json` | 21 张 ACT 表、275 行候选、原始数量语境及歧义 | 新增；无现有共享文件修改 |
| `backend/data/programmes/import_audit.json` | 机器可读审计、公式、错误和未验证条件 | 新增；无现有共享文件修改 |
| `tests/programmes/test_importer.py` | 19 项合成夹具测试＋8 项原始工作簿集成测试 | 新增；无现有共享文件修改 |
| `docs/programmes/data-contract.md` | 数据消费、特殊值、公式、材料字段及复现约定 | 新增；无现有共享文件修改 |
| `docs/programmes/B1-import-audit.md` | 本阶段中文审计与交付报告 | 新增；无现有共享文件修改 |

`PAIR_B_B1_CHANGES.zip` 仅含以上 12 个新增文件，保留相对路径，供审核后移植。`PAIR_B_B1_FILE_DIFF.json` 列出原始 246 文件的比对结果及全部新增文件的哈希，含以下不进入源码交付包的本地输入／中间产物：

- `.test-tmp/finals-data/DATASET_PROGRAMME CATALOGUE.xlsx`
- `.test-tmp/finals-data/acquisition.json`
- `.test-tmp/import-pass1/` 下首次导入的 7 个 JSON：`source_manifest.json`、`programme_offerings.json`、`programme_theme_mapping.json`、`programme_constraints.json`、`programme_dictionary.json`、`programme_materials.json`、`import_audit.json`。首次结果被保留，最终结果位于 `backend/data/programmes/`。

这些路径由现有 `.gitignore` 的 `.test-tmp/` 规则覆盖；没有改动忽略规则。工作区外层另有下载副本、交付组装脚本和报告／测试日志，不属于应用源码修改。

## DATA AUDIT

先实际读取了 Participant_README，再读 Data_Dictionary，随后解释主表、映射、规则与各 ACT 表。README 指定 Master 为主依据、映射仅辅助、缺失信息要明确处理、不得虚构。其 `A23` 引用的 `Activity_Based_Inventory` 工作表实际不存在，已记录差异并保留 21 张真实 ACT 表。

| 指标 | 实际结果 |
| --- | --- |
| 官方 offering | 21，ACT-001 至 ACT-021，ID 唯一，正式名称原样保留 |
| 官方约束 | 12，RULE-001 至 RULE-012；每条 6 个字段均保留且非空 |
| 主题／目标映射 | 25；关联 ID 校验通过，全部 Validation_Status 为 To be validated |
| 材料 ACT 表 | 21；每个 offering 恰好对应一张 |
| 材料候选行 | 275；这是提取行数，不是已确认物料 SKU 数 |
| 数量栏有原始内容的候选行 | 254；包括文本占位符，不等于 254 行数量已验证 |
| 数量缺失／材料或标题待区分 | 21；全部保留、标记待确认 |
| 另存分节／注释行 | 15；没有丢弃，也未混算成材料行 |
| 公式 | 17；读取公式＋原存缓存，17 个缓存存在、0 缺失、0 缓存错误；未重算 |
| Excel 错误 | 34 个 #VALUE!，均在图片栏；ACT-013 8 个、ACT-016 13 个、ACT-021 13 个 |
| 输出 | 7 个紧凑 UTF-8 JSON，共 590,327 字节，来源定位与内容摘要齐全 |

各 offering 的正式名称与材料计数：

| Offering_ID | 原始正式名称 | 候选行 | 其中待区分行 | 另存分节／注释行 |
| --- | --- | ---: | ---: | ---: |
| ACT-001 | Mini Drone | 4 | 0 | 0 |
| ACT-002 | Microbit | 4 | 0 | 0 |
| ACT-003 | Bottle Aquarium | 8 | 0 | 0 |
| ACT-004 | Colour Play | 10 | 0 | 0 |
| ACT-005 | Gas Detector | 9 | 0 | 0 |
| ACT-006 | LED Lantern | 9 | 0 | 0 |
| ACT-007 | Scribbling Machine | 13 | 0 | 0 |
| ACT-008 | LED Flashlight | 7 | 0 | 0 |
| ACT-009 | Arduino 100 | 9 | 0 | 0 |
| ACT-010 | Arduino 200 | 8 | 0 | 0 |
| ACT-011 | Arduino 300 | 5 | 0 | 0 |
| ACT-012 | DIY Catapult | 5 | 0 | 0 |
| ACT-013 | DIY Ice Cream | 8 | 0 | 0 |
| ACT-014 | Water water Everywhere | 36 | 0 | 9 |
| ACT-015 | Combustion Show | 14 | 0 | 6 |
| ACT-016 | Eat, Prey, Love Show | 13 | 0 | 0 |
| ACT-017 | Cool Chem Show | 73 | 20 | 0 |
| ACT-018 | Sustainable Suds | 14 | 0 | 0 |
| ACT-019 | Solar Fan | 3 | 0 | 0 |
| ACT-020 | Fabolous Fizzy | 10 | 0 | 0 |
| ACT-021 | Elephant Toothpaste | 13 | 1 | 0 |

材料保留原始 `Number per pack`、ready packs、`Quantity needed`、`Quantity (unit) in 1 set`、`Quantity for 40 sets`、`Quantity per Set`、`Quantity`、`Total unit / session` 等表头和对应单元格。没有把需求当库存，没有按参加人数缩放，没有从相同名字推断材料匹配。所有 275 行的 operational_usage_basis、inventory_mapping、consumption_or_reuse、pack_conversion 均为空且需要验证；原表已有使用语境仍完整保留在 fields 中。

原表的合并单元格保留为空及 anchor/range 元数据，没有向下填充。ACT-003 的 D7 材料名称保留原坐标。ACT-018 的第 4 行和 ACT-019 的第 19 行表头均正确识别。相邻多个源单元格保持数组，不拼接为一个已验证规格。

字典明确界定 Unknown、N/A、To be validated。Optional、No、Yes、空白、零、布尔及普通文本分别保留；TBC、NIL、To be confirmed 标记 undefined_placeholder，不伪造字典解释。实际非空源单元格中，Optional 9 个、No 52 个、Unknown 2 个、N/A 2 个、To be validated 27 个、undefined_placeholder 23 个；零与空白区别另有合成测试，未声称原表存在零。

所有记录通过文档 source_sha256 → manifest 工作簿 → source.sheet/source.row → cell 追溯。公式保留公式字符串、缓存值和 recalculated=false；缺失关键缓存的合成案例被标记为 formula_cache_missing，未生成计算结果。openpyxl 提示不支持某些扩展；本次没有保存原工作簿，因此没有移除原文件中的扩展／图片。图片未参与推断，缓存是否陈旧仍未验证。

## TESTS

运行位置：`C:\Users\User\Documents\Codex\2026-09-26\ni\work\pair-b-b1\orbit-ai-petrosains-inventory-system-final-hardening`。使用本机已有 Python 和 openpyxl 3.1.5；未安装依赖。实际最终导入命令（PowerShell）：

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
& 'C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' backend/scripts/import_programme_catalogue.py '.test-tmp/finals-data/DATASET_PROGRAMME CATALOGUE.xlsx' --output backend/data/programmes --acquisition .test-tmp/finals-data/acquisition.json
```

结果：exit 0；21 offerings／12 constraints／25 mappings／275 material candidates；`Import integrity PASS; operational evidence NEEDS VERIFICATION`。补充审计标记前的第一次输出移动到 `.test-tmp/import-pass1/` 保留后，执行了上述最终导入；没有覆盖其他人的改动。

实际最终测试命令：

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
$env:ORBIT_PROGRAMME_WORKBOOK=Join-Path $PWD '.test-tmp\finals-data\DATASET_PROGRAMME CATALOGUE.xlsx'
& 'C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest discover -s tests/programmes -p 'test_*.py' -v 2>&1 | Tee-Object -FilePath 'C:\Users\User\Documents\Codex\2026-09-26\ni\outputs\PAIR_B_B1_TESTS.txt'
if ($LASTEXITCODE -ne 0) { throw "B1 tests failed: $LASTEXITCODE" }
```

结果：**27 tests / 9.381s / OK，exit 0，无跳过**。完整逐项记录见 `PAIR_B_B1_TESTS.txt`。

- 原始来源集成检查：预期 SHA／26 表／21 ID／正式名称，Master、Mapping、Rules、Dictionary 全部非空数据单元格与原始 XLSX 一致；ACT 全部非空单元格（含表头、序言、注释）值和坐标完整保留；12 条约束完整；公式原文与缓存分离。
- 合成反例：重复 ID、数量不符、缺名、孤立／缺失 ACT、无效映射、缺失／不完整约束、缺字典、未知表、结构漂移均拒绝；测试数据明确标为 synthetic，不进入运行时目录。
- 语义与材料：特殊值不混同、零不等于 No／未知、包装／session 语境不缩放、合并空格不填值、位移材料名称／表头识别、歧义行不删除、价格栏文字不当数值。
- 公式反例：缓存缺失不计算，故意陈旧的缓存保留原存值并标记未重算，Excel 错误不变成零。
- 确定性：两个临时目录的 7 个 JSON 逐字节相同，并与交付文件逐字节相同；manifest 内 6 个输出哈希匹配。输入文件导入前后哈希一致。
- 保护已有文件：错误输入哈希拒绝导入；已有不同输出在写入前被拒绝，原内容不变。
- ZIP 差异：使用 Python zipfile／hashlib 逐个比对原始 246 文件，全部相同，结果在 `PAIR_B_B1_FILE_DIFF.json`。交付组装实际命令：`& 'C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' work/build_b1_delivery.py`（从本任务工作区根目录执行；脚本是本地交付工具，不进入应用）。

未执行：前端 build、typecheck、lint、Stage 1 集成／数据库测试、API 启动、迁移、公式重算、现场资源验证、未来预约核对。它们不属于此次 B1 验收，不能据此声称应用全量回归已通过。没有环境变量时官方集成测试会跳过，不能把那种运行当成本次 27 项完整验收。

## UNRESOLVED DATA

完整逐项 sheet／row／cell 详见 `backend/data/programmes/import_audit.json`。下面是实际审计项数，类别可重叠，不等于不同记录数量：

| 审计代码 | 数量 |
| --- | ---: |
| `dictionary_value_mismatch` | 47 |
| `material_or_section_ambiguous` | 21 |
| `material_specification_missing` | 116 |
| `multiple_cells_under_header_span` | 9 |
| `nonnumeric_price_cell` | 10 |
| `operational_evidence_not_verified` | 21 |
| `readme_sheet_reference_mismatch` | 1 |
| `undefined_placeholder` | 23 |

需要人工确认的具体事项：

1. 全部 21 条 Availability_Status 为 `To be confirmed`，不在字典枚举内，不能按 Active／已确认可提供处理。Notes 中部分时间、年龄、staffing 是规划假设或草稿，部分化学操作需 HSE／当地批准。目录身份已核对，现场可行性未确认。
2. 21 个 Delivery_Mode 使用 `Facilitated hands-on`／`Facilitated demonstration`，5 个 Offering_Type 使用 `Science Show`，与字典值不一致；保持原文。20 个年龄使用 `n+`，1 个使用 `4-8`；字典仅给 Number range 格式，B1 不新增上下界或统一年龄解析。后续 B2 必须显式处理并保留证据。
3. ACT-020 正式名称是 **Fabolous Fizzy**，不能擅自改成 Fabulous Fizzy；Notes 自身要求核对名称及具体流程。ACT-021 的 ID 来自工作簿，Notes 说明源文件编制时补给该 ID；导入器没有分配或改写它。
4. 25 条主题映射均 To be validated；不能用作固定答案或已验证主题结论。所有 Last_Validated 源值为 `2026-09-22`，仅作为原始记录字段保留，不充当文件发布、库存盘点或同步确认时间。
5. `ACT-001_Mini Drone!G4` 的 NIL、`ACT-013_DIY Ice Cream!E10` 的 TBC 没有字典定义；未知不变成零。ACT-021 的规格文字 `1,00 mL` 原样保留，需确认是否笔误。
6. 116 行在专用规格栏缺少值，包括部分待区分标题；这不等于其他文字栏没有规格线索。10 个 Price/unit 单元格实际是文字，不能当价格，也未擅自搬到规格栏：ACT-014_Water water Everywhere!F5; ACT-014_Water water Everywhere!F7; ACT-014_Water water Everywhere!F15; ACT-014_Water water Everywhere!F18; ACT-014_Water water Everywhere!F27; ACT-014_Water water Everywhere!F28; ACT-015_Combustion Show!F14; ACT-015_Combustion Show!F16; ACT-017_Cool Chem Show!F16; ACT-017_Cool Chem Show!F31。
7. 9 处单表头跨度内存在多个有值的源单元格；保持独立坐标与数组，需消费端谨慎解释。275 行均未获得可用于库存计算的已验证需求基准、包装转换、重用／reset 条件或 SKU 映射。
8. 34 个图片栏错误不影响数值原样导出，但图片／附件内容未验证；17 个公式缓存的时效性也未确认。

数量缺失、材料／标题需要区分的全部 21 行：

- `ACT-017_Cool Chem Show!r4`：Playing with polymer
- `ACT-017_Cool Chem Show!r7`：Introduction/ Ice breaking_Magic Cup
- `ACT-017_Cool Chem Show!r11`：UV Ray
- `ACT-017_Cool Chem Show!r15`：Chemical Reaction 1_Chemiluminescene
- `ACT-017_Cool Chem Show!r23`：Chemical Reaction 2_Baking soda + Vinegar
- `ACT-017_Cool Chem Show!r30`：Color Changing [1]-synthetic
- `ACT-017_Cool Chem Show!r37`：Color Changing [2]-synthetic / natural
- `ACT-017_Cool Chem Show!r45`：Hot Chemistry 1-Whoosh bottle
- `ACT-017_Cool Chem Show!r51`：Hot Chemistry 2-Burning Book
- `ACT-017_Cool Chem Show!r55`：Hot Chemistry 3-Fire Tornado
- `ACT-017_Cool Chem Show!r67`：General items
- `ACT-017_Cool Chem Show!r68`：masking tape
- `ACT-017_Cool Chem Show!r69`：marker 
- `ACT-017_Cool Chem Show!r70`：danger tape
- `ACT-017_Cool Chem Show!r71`：scissors
- `ACT-017_Cool Chem Show!r72`：blades
- `ACT-017_Cool Chem Show!r73`：lighter refill
- `ACT-017_Cool Chem Show!r74`：fire extinguisher
- `ACT-017_Cool Chem Show!r75`：GOGLES
- `ACT-017_Cool Chem Show!r76`：GLOVE
- `ACT-021_Elephant_Toothpaste!r10`：Electronic Kitchen Scale

## RISKS

- 源码快照没有真实 Git 元数据。Pair A 集成前仍需确认真实 checkout 的分支、HEAD、已有改动、共享目录是否冲突；不得将本次哈希比对表述为 Git clean 或与远程同步。
- 官方目录中的草稿、枚举差异和待确认字段可能影响后续筛选。B2 不得把词法标签或非空数值当作证据已验证；B1 的 PASS 仅指导入完整性和测试。
- 材料数量／价格原始语境不同，不能统一按人数比例换算；当前库存、演示借出量、updated_at、conversion_to_base=1 和 consumable/reusable 标签均未用于补齐证据。
- 未提供未来预约、facilitator、room 并行能力或安全批准。不存在虚构数据，也没有为 B1 建立预约系统。
- Python 只用于导入／开发，JSON 后续可由 TypeScript 消费。B1 未验证浏览器打包、Next API 或离线运行。已定离线目标仍仅限已加载页面的本地计算，不声称断网冷启动／刷新恢复。
- 导入器针对本次已审阅的 21 offerings／12 rules／26 sheets 版本设结构保护；未来 workbook 结构改变需要审阅后更新，不自动丢弃未知表或凑数。

## NEXT

**B1 到此停止，等待 Pair B／Operator 阶段审核；未启动 B2。** 后续获准进入 B2 时，数据入口为 `backend/data/programmes/source_manifest.json`，再按 manifest 读取 programme_dictionary、programme_offerings、programme_theme_mapping、programme_constraints；材料与审计保留给资源适配阶段使用。

建议审核本轮 12 个新增文件、21 行材料歧义、枚举差异与原始 Notes。获准后的 B2 才实现共享 TypeScript 纯计算核心、请求模型与推荐／约束测试；请求需表达年龄范围、未知值、不稳定网络、日期、人员和场地并行能力。状态遵守 NOT FEASIBLE → NEEDS VERIFICATION → FEASIBLE WITH ASSUMPTIONS → VERIFIED FEASIBLE，关键未知不能以“假设够用”转成可行。API、导航、依赖清单及前端仍等待其各自阶段。
