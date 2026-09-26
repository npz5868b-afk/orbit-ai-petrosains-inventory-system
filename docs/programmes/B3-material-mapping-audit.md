# B3 材料候选与未解决项报告

**仅为候选审计，不是批准映射表。**

真实 HTTP 读取与静态种子文件各有 109 条记录；275 条 ACT 行全部保留，其中 21 条歧义行。22 条完整名称规范化后相同，只形成 exact candidate；verified exact=0、verified alias=0、unresolved=275。

事件 programme 材料状态：Sufficient=0、Insufficient=0、Unknown=275。当前数量和未来数量均没有独立批准证据。Unknown 不等于无库存。

原始数量、单位、ACT 需求上下文、原始行 ID、sheet/row 和对应库存 ID/SKU 详见 material_inventory_mappings.json；真实读取详见 PAIR_B_B3_LIVE_RESOURCE_AUDIT.json。

| ACT 原始行 | 原始名称 | 候选 SKU | 待确认 |
| --- | --- | --- | --- |
| ACT-003:r8 | Cutter | T006 | 身份选择、规格、单位／包装、需求基准、分类、重用／reset、当前和事件数量 |
| ACT-005:r7 | Arduino Nano | E002 | 身份选择、规格、单位／包装、需求基准、分类、重用／reset、当前和事件数量 |
| ACT-006:r4 | Tracing Paper | C001 | 身份选择、规格、单位／包装、需求基准、分类、重用／reset、当前和事件数量 |
| ACT-007:r9 | Pipe Cleaner | C012 | 身份选择、规格、单位／包装、需求基准、分类、重用／reset、当前和事件数量 |
| ACT-007:r12 | Eraser | S015 | 身份选择、规格、单位／包装、需求基准、分类、重用／reset、当前和事件数量 |
| ACT-009:r12 | Breadboard | E004 | 身份选择、规格、单位／包装、需求基准、分类、重用／reset、当前和事件数量 |
| ACT-010:r10 | Breadboard | E004 | 身份选择、规格、单位／包装、需求基准、分类、重用／reset、当前和事件数量 |
| ACT-011:r4 | NodeMCU  | E006 | 身份选择、规格、单位／包装、需求基准、分类、重用／reset、当前和事件数量 |
| ACT-012:r8 | paper cup | C002 | 身份选择、规格、单位／包装、需求基准、分类、重用／reset、当前和事件数量 |
| ACT-014:r8 | Universal Indicator | L026 | 身份选择、规格、单位／包装、需求基准、分类、重用／reset、当前和事件数量 |
| ACT-014:r13 | Universal Indicator | L026 | 身份选择、规格、单位／包装、需求基准、分类、重用／reset、当前和事件数量 |
| ACT-016:r10 | Test Tube | L001 | 身份选择、规格、单位／包装、需求基准、分类、重用／reset、当前和事件数量 |
| ACT-016:r15 | Gloves | L011 | 身份选择、规格、单位／包装、需求基准、分类、重用／reset、当前和事件数量 |
| ACT-016:r16 | Test Tube rack | L002 | 身份选择、规格、单位／包装、需求基准、分类、重用／reset、当前和事件数量 |
| ACT-017:r5 | Paper clip | S010 | 身份选择、规格、单位／包装、需求基准、分类、重用／reset、当前和事件数量 |
| ACT-017:r9 | paper cup  | C002 | 身份选择、规格、单位／包装、需求基准、分类、重用／reset、当前和事件数量 |
| ACT-017:r17 | test tube | L001 | 身份选择、规格、单位／包装、需求基准、分类、重用／reset、当前和事件数量 |
| ACT-017:r20 | hammer | T011 | 身份选择、规格、单位／包装、需求基准、分类、重用／reset、当前和事件数量 |
| ACT-017:r42 | universal indicator | L026 | 身份选择、规格、单位／包装、需求基准、分类、重用／reset、当前和事件数量 |
| ACT-018:r13 | Tongue Depressor | C021 | 身份选择、规格、单位／包装、需求基准、分类、重用／reset、当前和事件数量 |
| ACT-021:r4 | Potassium Iodide | L020 | 身份选择、规格、单位／包装、需求基准、分类、重用／reset、当前和事件数量 |
| ACT-021:r9 | Volumetric Flask | L016 | 身份选择、规格、单位／包装、需求基准、分类、重用／reset、当前和事件数量 |

未匹配名称的其他 253 行没有自动模糊匹配，也没有自动 alias。已核对的例子：同名 Breadboard 的 ACT-009:r12 与 ACT-010:r10 均候选 E004；后续经人工批准后必须共享同一个池，不可按活动复制数量。

人工复核清单：

- 每条原始行都须保留；先辨认 21 条歧义行是否为分节标题或真实需求。普通 material 行不可随意排除。
- 候选 SKU 必须逐项核对规格、颜色、尺寸、电压、浓度等要求；名称相同不构成可互换证明。
- 明确每行 quantity 的需求单位与 per-participant/group/station/session 依据；不从 80 packs 推导倍率。
- 独立提供带来源、审阅人和有效期的转换、consumable/reusable 分类及重用/reset 条件。
- currentQuantity 需要盘点／对账证据；eventQuantity 需要本次时间区间的可用记录。两者分别确认。
- 缺人员、房间、场地、安全与预约证据继续待验证；本轮不创建这些数据。

## 全部待确认行

| 行 ID | 原始名称 | 类型 | 来源 |
| --- | --- | --- | --- |
| ACT-001:r4 | A box of DIY Drone set contains:  - 1x propeller guard - 1x radio controller - 4x black propellers - 4x green propellers - 2x 3.7v LiPO battery - 1x USB cable charger - 1x spanner - 1x battery holder - 2x AA battery - 1x controller board - 2x black and white wired DC brush motor - 2x red and blue wired DC brush motor  | material | ACT-001_Mini Drone / row 4 |
| ACT-001:r5 | Brown Bag | material | ACT-001_Mini Drone / row 5 |
| ACT-001:r6 | Customised Sticker | material | ACT-001_Mini Drone / row 6 |
| ACT-001:r7 | Activity title sticker | material | ACT-001_Mini Drone / row 7 |
| ACT-002:r4 | 1X Battery Holder (AA Size) , 2X AA Battery, 1X USB 1X Microbit  | material | ACT-002_Microbit / row 4 |
| ACT-002:r5 | Brown Bag | material | ACT-002_Microbit / row 5 |
| ACT-002:r6 | Customised Sticker | material | ACT-002_Microbit / row 6 |
| ACT-002:r7 | Activity title sticker | material | ACT-002_Microbit / row 7 |
| ACT-003:r4 | Aquarium Rocks | material | ACT-003_Bottle Aquarium / row 4 |
| ACT-003:r5 | Artificial Aquatic Plant | material | ACT-003_Bottle Aquarium / row 5 |
| ACT-003:r6 | Sharpie Pen | material | ACT-003_Bottle Aquarium / row 6 |
| ACT-003:r7 | Empty Plastic mineral water bottle | material | ACT-003_Bottle Aquarium / row 7 |
| ACT-003:r8 | Cutter | material | ACT-003_Bottle Aquarium / row 8 |
| ACT-003:r9 | Brown Bag | material | ACT-003_Bottle Aquarium / row 9 |
| ACT-003:r10 | Customised Sticker | material | ACT-003_Bottle Aquarium / row 10 |
| ACT-003:r11 | Activity title sticker | material | ACT-003_Bottle Aquarium / row 11 |
| ACT-004:r4 | Modelling Dough Non-Toxic  | material | ACT-004_Colour Play / row 4 |
| ACT-004:r5 | Sharpie Pen | material | ACT-004_Colour Play / row 5 |
| ACT-004:r6 | Filter Paper | material | ACT-004_Colour Play / row 6 |
| ACT-004:r7 | Empty Spray Bottle | material | ACT-004_Colour Play / row 7 |
| ACT-004:r8 | Drawing Block | material | ACT-004_Colour Play / row 8 |
| ACT-004:r9 | Pencils | material | ACT-004_Colour Play / row 9 |
| ACT-004:r10 | Colour Chart printed materials | material | ACT-004_Colour Play / row 10 |
| ACT-004:r11 | Brown Bag | material | ACT-004_Colour Play / row 11 |
| ACT-004:r12 | Customised Sticker | material | ACT-004_Colour Play / row 12 |
| ACT-004:r13 | Activity title sticker | material | ACT-004_Colour Play / row 13 |
| ACT-005:r4 | MQ-2 Gas Sensor | material | ACT-005_Gas Detector / row 4 |
| ACT-005:r5 | RGB LED Module | material | ACT-005_Gas Detector / row 5 |
| ACT-005:r6 | Buzzer Module | material | ACT-005_Gas Detector / row 6 |
| ACT-005:r7 | Arduino Nano | material | ACT-005_Gas Detector / row 7 |
| ACT-005:r8 | Jumper Wire | material | ACT-005_Gas Detector / row 8 |
| ACT-005:r9 | Bread Board | material | ACT-005_Gas Detector / row 9 |
| ACT-005:r10 | Brown Bag | material | ACT-005_Gas Detector / row 10 |
| ACT-005:r11 | Customised Sticker | material | ACT-005_Gas Detector / row 11 |
| ACT-005:r12 | Activity title sticker | material | ACT-005_Gas Detector / row 12 |
| ACT-006:r4 | Tracing Paper | material | ACT-006_LED Lantern / row 4 |
| ACT-006:r5 | A4 Coloured Hard Paper | material | ACT-006_LED Lantern / row 5 |
| ACT-006:r6 | Printed Material | material | ACT-006_LED Lantern / row 6 |
| ACT-006:r7 | Coin Lithium battery | material | ACT-006_LED Lantern / row 7 |
| ACT-006:r8 | LED multicolor | material | ACT-006_LED Lantern / row 8 |
| ACT-006:r9 | Copper Tape strip | material | ACT-006_LED Lantern / row 9 |
| ACT-006:r10 | Scissors | material | ACT-006_LED Lantern / row 10 |
| ACT-006:r11 | Cellotape | material | ACT-006_LED Lantern / row 11 |
| ACT-006:r12 | Brown Bag | material | ACT-006_LED Lantern / row 12 |
| ACT-007:r4 | White Paper Cup | material | ACT-007_Scribbling Machine / row 4 |
| ACT-007:r5 | Battery Holder | material | ACT-007_Scribbling Machine / row 5 |
| ACT-007:r6 | Rocker Switch | material | ACT-007_Scribbling Machine / row 6 |
| ACT-007:r7 | Crocodile Clip | material | ACT-007_Scribbling Machine / row 7 |
| ACT-007:r8 | Magic Pen | material | ACT-007_Scribbling Machine / row 8 |
| ACT-007:r9 | Pipe Cleaner | material | ACT-007_Scribbling Machine / row 9 |
| ACT-007:r10 | Large Furball | material | ACT-007_Scribbling Machine / row 10 |
| ACT-007:r11 | Small Furball | material | ACT-007_Scribbling Machine / row 11 |
| ACT-007:r12 | Eraser | material | ACT-007_Scribbling Machine / row 12 |
| ACT-007:r13 | Masking Tape | material | ACT-007_Scribbling Machine / row 13 |
| ACT-007:r14 | AA Battery | material | ACT-007_Scribbling Machine / row 14 |
| ACT-007:r15 | Mini DC Motor | material | ACT-007_Scribbling Machine / row 15 |
| ACT-007:r16 | Brown Bag | material | ACT-007_Scribbling Machine / row 16 |
| ACT-008:r4 | Jumbo Popsicle | material | ACT-008_LED Flashlight / row 4 |
| ACT-008:r5 | Metal Binder | material | ACT-008_LED Flashlight / row 5 |
| ACT-008:r6 | Coin Lithium battery | material | ACT-008_LED Flashlight / row 6 |
| ACT-008:r7 | LED multicolor | material | ACT-008_LED Flashlight / row 7 |
| ACT-008:r8 | Copper Tape strip | material | ACT-008_LED Flashlight / row 8 |
| ACT-008:r9 | Scissors | material | ACT-008_LED Flashlight / row 9 |
| ACT-008:r10 | Brown Bag | material | ACT-008_LED Flashlight / row 10 |
| ACT-009:r4 | Arduino UNO with USB B Type Cable | material | ACT-009_Arduino 100 / row 4 |
| ACT-009:r5 | Jumper wires (m-m) | material | ACT-009_Arduino 100 / row 5 |
| ACT-009:r6 | Light Dependent Resistor | material | ACT-009_Arduino 100 / row 6 |
| ACT-009:r7 | LED | material | ACT-009_Arduino 100 / row 7 |
| ACT-009:r8 | Resistor 220 | material | ACT-009_Arduino 100 / row 8 |
| ACT-009:r9 | Resistor 10k | material | ACT-009_Arduino 100 / row 9 |
| ACT-009:r10 | Push button | material | ACT-009_Arduino 100 / row 10 |
| ACT-009:r11 | RGB Common Cathode | material | ACT-009_Arduino 100 / row 11 |
| ACT-009:r12 | Breadboard | material | ACT-009_Arduino 100 / row 12 |
| ACT-010:r4 | Arduino UNO with USB B Type Cable | material | ACT-010_Arduino 200 / row 4 |
| ACT-010:r5 | Jumper wires (m-m) | material | ACT-010_Arduino 200 / row 5 |
| ACT-010:r6 | Arduino DHT11 Temperature and Humidity Sensor with LED | material | ACT-010_Arduino 200 / row 6 |
| ACT-010:r7 | Ultrasonic Sensor HC-SR04 | material | ACT-010_Arduino 200 / row 7 |
| ACT-010:r8 | I2C LCD 16x2 1602 for Arduino | material | ACT-010_Arduino 200 / row 8 |
| ACT-010:r9 | SG90 Micro Servo | material | ACT-010_Arduino 200 / row 9 |
| ACT-010:r10 | Breadboard | material | ACT-010_Arduino 200 / row 10 |
| ACT-010:r11 | Arduino Adjustable IR Infrared Range Finder Obstacles Avoid Sensor | material | ACT-010_Arduino 200 / row 11 |
| ACT-011:r4 | NodeMCU  | material | ACT-011_Arduino 300 / row 4 |
| ACT-011:r5 | NodeMCU USB Micro B Cable | material | ACT-011_Arduino 300 / row 5 |
| ACT-011:r6 | Jumper wires (m-m) | material | ACT-011_Arduino 300 / row 6 |
| ACT-011:r7 | LED | material | ACT-011_Arduino 300 / row 7 |
| ACT-011:r8 | Arduino DHT11 Temperature and Humidity Sensor with LED | material | ACT-011_Arduino 300 / row 8 |
| ACT-012:r4 | Popsicle Stick Jumbo | material | ACT-012_DIY Catapult / row 4 |
| ACT-012:r5 | Rubber Band | material | ACT-012_DIY Catapult / row 5 |
| ACT-012:r6 | Heavy weight Plastic Spoon | material | ACT-012_DIY Catapult / row 6 |
| ACT-012:r7 | Ping Pong Ball | material | ACT-012_DIY Catapult / row 7 |
| ACT-012:r8 | paper cup | material | ACT-012_DIY Catapult / row 8 |
| ACT-013:r4 | Milk | material | ACT-013_DIY Ice Cream / row 4 |
| ACT-013:r5 | Sugar | material | ACT-013_DIY Ice Cream / row 5 |
| ACT-013:r6 | Salt | material | ACT-013_DIY Ice Cream / row 6 |
| ACT-013:r7 | Ice Cubes | material | ACT-013_DIY Ice Cream / row 7 |
| ACT-013:r8 | Zip Lock Bag | material | ACT-013_DIY Ice Cream / row 8 |
| ACT-013:r9 | Pet Jar | material | ACT-013_DIY Ice Cream / row 9 |
| ACT-013:r10 | Towel | material | ACT-013_DIY Ice Cream / row 10 |
| ACT-013:r11 | Polystyrene Foam Ice Box | material | ACT-013_DIY Ice Cream / row 11 |
| ACT-014:r5 | Glass | material | ACT-014_Water water Everywhere / row 5 |
| ACT-014:r6 | Vinegar | material | ACT-014_Water water Everywhere / row 6 |
| ACT-014:r7 | Clear Soap Solution | material | ACT-014_Water water Everywhere / row 7 |
| ACT-014:r8 | Universal Indicator | material | ACT-014_Water water Everywhere / row 8 |
| ACT-014:r9 | Glass Dropper | material | ACT-014_Water water Everywhere / row 9 |
| ACT-014:r11 | Kitchen Tissue | material | ACT-014_Water water Everywhere / row 11 |
| ACT-014:r12 | Spray Bottle | material | ACT-014_Water water Everywhere / row 12 |
| ACT-014:r13 | Universal Indicator | material | ACT-014_Water water Everywhere / row 13 |
| ACT-014:r14 | Vinegar | material | ACT-014_Water water Everywhere / row 14 |
| ACT-014:r15 | Clear soap solution | material | ACT-014_Water water Everywhere / row 15 |
| ACT-014:r16 | Satay Sticks | material | ACT-014_Water water Everywhere / row 16 |
| ACT-014:r18 | Glass Jar | material | ACT-014_Water water Everywhere / row 18 |
| ACT-014:r19 | Small Net | material | ACT-014_Water water Everywhere / row 19 |
| ACT-014:r20 | Container | material | ACT-014_Water water Everywhere / row 20 |
| ACT-014:r22 | Balloon | material | ACT-014_Water water Everywhere / row 22 |
| ACT-014:r23 | Lighter | material | ACT-014_Water water Everywhere / row 23 |
| ACT-014:r24 | Small Umbrella | material | ACT-014_Water water Everywhere / row 24 |
| ACT-014:r25 | Raincoat | material | ACT-014_Water water Everywhere / row 25 |
| ACT-014:r27 | Glass | material | ACT-014_Water water Everywhere / row 27 |
| ACT-014:r28 | Food Coloring | material | ACT-014_Water water Everywhere / row 28 |
| ACT-014:r29 | Kitchen Tissue | material | ACT-014_Water water Everywhere / row 29 |
| ACT-014:r31 | Cotton Rope | material | ACT-014_Water water Everywhere / row 31 |
| ACT-014:r32 | Platform | material | ACT-014_Water water Everywhere / row 32 |
| ACT-014:r33 | Container | material | ACT-014_Water water Everywhere / row 33 |
| ACT-014:r34 | Food Coloring | material | ACT-014_Water water Everywhere / row 34 |
| ACT-014:r36 | 9L Bottle | material | ACT-014_Water water Everywhere / row 36 |
| ACT-014:r37 | Food Coloring | material | ACT-014_Water water Everywhere / row 37 |
| ACT-014:r38 | Cloth Tape | material | ACT-014_Water water Everywhere / row 38 |
| ACT-014:r39 | Tray | material | ACT-014_Water water Everywhere / row 39 |
| ACT-014:r41 | Cotton Rope | material | ACT-014_Water water Everywhere / row 41 |
| ACT-014:r42 | Glass | material | ACT-014_Water water Everywhere / row 42 |
| ACT-014:r43 | Masking Tape | material | ACT-014_Water water Everywhere / row 43 |
| ACT-014:r45 | Sodium Hydroxide | material | ACT-014_Water water Everywhere / row 45 |
| ACT-014:r46 | Aluminium Foil | material | ACT-014_Water water Everywhere / row 46 |
| ACT-014:r47 | Balloon | material | ACT-014_Water water Everywhere / row 47 |
| ACT-014:r48 | Candle | material | ACT-014_Water water Everywhere / row 48 |
| ACT-015:r5 | Zippo | material | ACT-015_Combustion Show / row 5 |
| ACT-015:r7 | Clear glass | material | ACT-015_Combustion Show / row 7 |
| ACT-015:r8 | Small candle holder | material | ACT-015_Combustion Show / row 8 |
| ACT-015:r9 | Candle | material | ACT-015_Combustion Show / row 9 |
| ACT-015:r11 | Tong | material | ACT-015_Combustion Show / row 11 |
| ACT-015:r12 | Fire resistant plate | material | ACT-015_Combustion Show / row 12 |
| ACT-015:r14 | Dishwashing liquid | material | ACT-015_Combustion Show / row 14 |
| ACT-015:r15 | Dettol disinfectant spray | material | ACT-015_Combustion Show / row 15 |
| ACT-015:r16 | Heat resistant bowl [pyrex] | material | ACT-015_Combustion Show / row 16 |
| ACT-015:r18 | Whoosh bottle | material | ACT-015_Combustion Show / row 18 |
| ACT-015:r19 | Bendosen ethanol 95% | material | ACT-015_Combustion Show / row 19 |
| ACT-015:r20 | Beaker | material | ACT-015_Combustion Show / row 20 |
| ACT-015:r22 | Lighter with long handle | material | ACT-015_Combustion Show / row 22 |
| ACT-015:r23 | Gas refill lighter | material | ACT-015_Combustion Show / row 23 |
| ACT-016:r4 | Small Balloons | material | ACT-016_Eat, Prey, Love Show / row 4 |
| ACT-016:r5 | Thick Satin Cloth | material | ACT-016_Eat, Prey, Love Show / row 5 |
| ACT-016:r6 | Mounting Boards | material | ACT-016_Eat, Prey, Love Show / row 6 |
| ACT-016:r7 | Easel | material | ACT-016_Eat, Prey, Love Show / row 7 |
| ACT-016:r8 | Cooking Oil | material | ACT-016_Eat, Prey, Love Show / row 8 |
| ACT-016:r9 | Glass Bowl | material | ACT-016_Eat, Prey, Love Show / row 9 |
| ACT-016:r10 | Test Tube | material | ACT-016_Eat, Prey, Love Show / row 10 |
| ACT-016:r11 | Frog Musical Instrument | material | ACT-016_Eat, Prey, Love Show / row 11 |
| ACT-016:r12 | Glow-in-the-Dark Stick | material | ACT-016_Eat, Prey, Love Show / row 12 |
| ACT-016:r13 | Pliers | material | ACT-016_Eat, Prey, Love Show / row 13 |
| ACT-016:r14 | Safety Goggles | material | ACT-016_Eat, Prey, Love Show / row 14 |
| ACT-016:r15 | Gloves | material | ACT-016_Eat, Prey, Love Show / row 15 |
| ACT-016:r16 | Test Tube rack | material | ACT-016_Eat, Prey, Love Show / row 16 |
| ACT-017:r4 | Playing with polymer | material_or_section_needs_review | ACT-017_Cool Chem Show / row 4 |
| ACT-017:r5 | Paper clip | material | ACT-017_Cool Chem Show / row 5 |
| ACT-017:r6 | balloon | material | ACT-017_Cool Chem Show / row 6 |
| ACT-017:r7 | Introduction/ Ice breaking_Magic Cup | material_or_section_needs_review | ACT-017_Cool Chem Show / row 7 |
| ACT-017:r8 | baby diapers | material | ACT-017_Cool Chem Show / row 8 |
| ACT-017:r9 | paper cup  | material | ACT-017_Cool Chem Show / row 9 |
| ACT-017:r10 | Jar | material | ACT-017_Cool Chem Show / row 10 |
| ACT-017:r11 | UV Ray | material_or_section_needs_review | ACT-017_Cool Chem Show / row 11 |
| ACT-017:r12 | tonic water | material | ACT-017_Cool Chem Show / row 12 |
| ACT-017:r13 | uv light | material | ACT-017_Cool Chem Show / row 13 |
| ACT-017:r14 | box | material | ACT-017_Cool Chem Show / row 14 |
| ACT-017:r15 | Chemical Reaction 1_Chemiluminescene | material_or_section_needs_review | ACT-017_Cool Chem Show / row 15 |
| ACT-017:r16 | light stick | material | ACT-017_Cool Chem Show / row 16 |
| ACT-017:r17 | test tube | material | ACT-017_Cool Chem Show / row 17 |
| ACT-017:r18 | test tube holder | material | ACT-017_Cool Chem Show / row 18 |
| ACT-017:r19 | gergaji | material | ACT-017_Cool Chem Show / row 19 |
| ACT-017:r20 | hammer | material | ACT-017_Cool Chem Show / row 20 |
| ACT-017:r21 | ziplog | material | ACT-017_Cool Chem Show / row 21 |
| ACT-017:r22 | glove latex | material | ACT-017_Cool Chem Show / row 22 |
| ACT-017:r23 | Chemical Reaction 2_Baking soda + Vinegar | material_or_section_needs_review | ACT-017_Cool Chem Show / row 23 |
| ACT-017:r24 | baking soda | material | ACT-017_Cool Chem Show / row 24 |
| ACT-017:r25 | vinegar | material | ACT-017_Cool Chem Show / row 25 |
| ACT-017:r26 | 5L water bottle | material | ACT-017_Cool Chem Show / row 26 |
| ACT-017:r27 | jug | material | ACT-017_Cool Chem Show / row 27 |
| ACT-017:r28 | spoon | material | ACT-017_Cool Chem Show / row 28 |
| ACT-017:r29 | balloon | material | ACT-017_Cool Chem Show / row 29 |
| ACT-017:r30 | Color Changing [1]-synthetic | material_or_section_needs_review | ACT-017_Cool Chem Show / row 30 |
| ACT-017:r31 | tissue flower | material | ACT-017_Cool Chem Show / row 31 |
| ACT-017:r32 | vase | material | ACT-017_Cool Chem Show / row 32 |
| ACT-017:r33 | stick | material | ACT-017_Cool Chem Show / row 33 |
| ACT-017:r34 | bottle spray | material | ACT-017_Cool Chem Show / row 34 |
| ACT-017:r35 | Dishwashing liquid | material | ACT-017_Cool Chem Show / row 35 |
| ACT-017:r36 | phenolphthalein | material | ACT-017_Cool Chem Show / row 36 |
| ACT-017:r37 | Color Changing [2]-synthetic / natural | material_or_section_needs_review | ACT-017_Cool Chem Show / row 37 |
| ACT-017:r38 | glass | material | ACT-017_Cool Chem Show / row 38 |
| ACT-017:r39 | Dishwashing liquid | material | ACT-017_Cool Chem Show / row 39 |
| ACT-017:r40 | dropper | material | ACT-017_Cool Chem Show / row 40 |
| ACT-017:r41 | vinegar  | material | ACT-017_Cool Chem Show / row 41 |
| ACT-017:r42 | universal indicator | material | ACT-017_Cool Chem Show / row 42 |
| ACT-017:r43 | red cabbage | material | ACT-017_Cool Chem Show / row 43 |
| ACT-017:r44 | bunga telang | material | ACT-017_Cool Chem Show / row 44 |
| ACT-017:r45 | Hot Chemistry 1-Whoosh bottle | material_or_section_needs_review | ACT-017_Cool Chem Show / row 45 |
| ACT-017:r46 | methylated spirit | material | ACT-017_Cool Chem Show / row 46 |
| ACT-017:r47 | lighter | material | ACT-017_Cool Chem Show / row 47 |
| ACT-017:r48 | funnel | material | ACT-017_Cool Chem Show / row 48 |
| ACT-017:r49 | metal cup | material | ACT-017_Cool Chem Show / row 49 |
| ACT-017:r50 | chopstick long | material | ACT-017_Cool Chem Show / row 50 |
| ACT-017:r51 | Hot Chemistry 2-Burning Book | material_or_section_needs_review | ACT-017_Cool Chem Show / row 51 |
| ACT-017:r52 | methylated spirit | material | ACT-017_Cool Chem Show / row 52 |
| ACT-017:r53 | lighter | material | ACT-017_Cool Chem Show / row 53 |
| ACT-017:r54 | book | material | ACT-017_Cool Chem Show / row 54 |
| ACT-017:r55 | Hot Chemistry 3-Fire Tornado | material_or_section_needs_review | ACT-017_Cool Chem Show / row 55 |
| ACT-017:r56 | lazy susan | material | ACT-017_Cool Chem Show / row 56 |
| ACT-017:r57 | dustbin | material | ACT-017_Cool Chem Show / row 57 |
| ACT-017:r58 | aluminium foil | material | ACT-017_Cool Chem Show / row 58 |
| ACT-017:r59 | small dish | material | ACT-017_Cool Chem Show / row 59 |
| ACT-017:r60 | mthylated spirit | material | ACT-017_Cool Chem Show / row 60 |
| ACT-017:r61 | dropper | material | ACT-017_Cool Chem Show / row 61 |
| ACT-017:r62 | lighter | material | ACT-017_Cool Chem Show / row 62 |
| ACT-017:r63 | plastic spoon | material | ACT-017_Cool Chem Show / row 63 |
| ACT-017:r64 | metal salt [ copper chloride] | material | ACT-017_Cool Chem Show / row 64 |
| ACT-017:r65 | metal salt [strontium chloride] | material | ACT-017_Cool Chem Show / row 65 |
| ACT-017:r66 | cap from jar | material | ACT-017_Cool Chem Show / row 66 |
| ACT-017:r67 | General items | material_or_section_needs_review | ACT-017_Cool Chem Show / row 67 |
| ACT-017:r68 | masking tape | material_or_section_needs_review | ACT-017_Cool Chem Show / row 68 |
| ACT-017:r69 | marker  | material_or_section_needs_review | ACT-017_Cool Chem Show / row 69 |
| ACT-017:r70 | danger tape | material_or_section_needs_review | ACT-017_Cool Chem Show / row 70 |
| ACT-017:r71 | scissors | material_or_section_needs_review | ACT-017_Cool Chem Show / row 71 |
| ACT-017:r72 | blades | material_or_section_needs_review | ACT-017_Cool Chem Show / row 72 |
| ACT-017:r73 | lighter refill | material_or_section_needs_review | ACT-017_Cool Chem Show / row 73 |
| ACT-017:r74 | fire extinguisher | material_or_section_needs_review | ACT-017_Cool Chem Show / row 74 |
| ACT-017:r75 | GOGLES | material_or_section_needs_review | ACT-017_Cool Chem Show / row 75 |
| ACT-017:r76 | GLOVE | material_or_section_needs_review | ACT-017_Cool Chem Show / row 76 |
| ACT-018:r5 |  Sodium Hydroxide, NaOH pallete (1kg)  | material | ACT-018_Sustainable Suds / row 5 |
| ACT-018:r6 | Cooking Oil | material | ACT-018_Sustainable Suds / row 6 |
| ACT-018:r7 | Digital Scale | material | ACT-018_Sustainable Suds / row 7 |
| ACT-018:r8 | Plastic Measuring Cup | material | ACT-018_Sustainable Suds / row 8 |
| ACT-018:r9 | Plastic Measuring Beaker | material | ACT-018_Sustainable Suds / row 9 |
| ACT-018:r10 | Essential Oil | material | ACT-018_Sustainable Suds / row 10 |
| ACT-018:r11 | Food Colouring | material | ACT-018_Sustainable Suds / row 11 |
| ACT-018:r12 | Pipette Dropper | material | ACT-018_Sustainable Suds / row 12 |
| ACT-018:r13 | Tongue Depressor | material | ACT-018_Sustainable Suds / row 13 |
| ACT-018:r14 | Round plastic container with lid | material | ACT-018_Sustainable Suds / row 14 |
| ACT-018:r15 | Sticker Paper  | material | ACT-018_Sustainable Suds / row 15 |
| ACT-018:r16 | Nitril latex glove | material | ACT-018_Sustainable Suds / row 16 |
| ACT-018:r17 | Sauce Container | material | ACT-018_Sustainable Suds / row 17 |
| ACT-018:r18 | Spatula | material | ACT-018_Sustainable Suds / row 18 |
| ACT-019:r20 | Solar powered fan kit | material | ACT-019_Solar Fan / row 20 |
| ACT-019:r21 | Cable tie | material | ACT-019_Solar Fan / row 21 |
| ACT-019:r22 | Torchlight W591 | material | ACT-019_Solar Fan / row 22 |
| ACT-020:r4 | Baking soda | material | ACT-020_Fabolous Fizzy / row 4 |
| ACT-020:r5 | Citric acid | material | ACT-020_Fabolous Fizzy / row 5 |
| ACT-020:r6 | Epsom salt | material | ACT-020_Fabolous Fizzy / row 6 |
| ACT-020:r7 | Soap colouring pigment | material | ACT-020_Fabolous Fizzy / row 7 |
| ACT-020:r8 | Coconut oil | material | ACT-020_Fabolous Fizzy / row 8 |
| ACT-020:r9 | Cornstarch | material | ACT-020_Fabolous Fizzy / row 9 |
| ACT-020:r10 | Essential oil | material | ACT-020_Fabolous Fizzy / row 10 |
| ACT-020:r11 | Bath bomb mold | material | ACT-020_Fabolous Fizzy / row 11 |
| ACT-020:r12 | Disposable spoon | material | ACT-020_Fabolous Fizzy / row 12 |
| ACT-020:r13 | Paper bowl | material | ACT-020_Fabolous Fizzy / row 13 |
| ACT-021:r4 | Potassium Iodide | material | ACT-021_Elephant_Toothpaste / row 4 |
| ACT-021:r5 | Hydrogen Peroxide | material | ACT-021_Elephant_Toothpaste / row 5 |
| ACT-021:r6 | Beaker | material | ACT-021_Elephant_Toothpaste / row 6 |
| ACT-021:r7 | Conical Flask | material | ACT-021_Elephant_Toothpaste / row 7 |
| ACT-021:r8 | Conical Flask | material | ACT-021_Elephant_Toothpaste / row 8 |
| ACT-021:r9 | Volumetric Flask | material | ACT-021_Elephant_Toothpaste / row 9 |
| ACT-021:r10 | Electronic Kitchen Scale | material_or_section_needs_review | ACT-021_Elephant_Toothpaste / row 10 |
| ACT-021:r11 | Lab Spatula | material | ACT-021_Elephant_Toothpaste / row 11 |
| ACT-021:r12 | Measuring Cylinder | material | ACT-021_Elephant_Toothpaste / row 12 |
| ACT-021:r13 | Yeast | material | ACT-021_Elephant_Toothpaste / row 13 |
| ACT-021:r14 | Distilled Water | material | ACT-021_Elephant_Toothpaste / row 14 |
| ACT-021:r15 | Goggles | material | ACT-021_Elephant_Toothpaste / row 15 |
| ACT-021:r16 | Nitrile Gloves | material | ACT-021_Elephant_Toothpaste / row 16 |
