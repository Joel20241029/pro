# 敌人 3D 原始资产与骨骼动画源工程

本目录保存用户已授权真实 3D 改造的 5 种小怪和 5 种首领。全部使用本项目新生成的独立单体参考图，通过 animal-mediakit 网关的 Hyper3D Gen2 生成；未把整张概念设计板直接送入 3D 服务。每类均独立生成，没有同模换名。

## 文件分类

- `*_reference.png`：imagegen 生成的单体参考，均已人工检查后才发送给 Hyper3D。
- `*_raw.glb`：服务返回的原始模型，内嵌 2048 贴图，保留不覆盖。
- `*_task.json`：原始成功响应，含 task_id、完整 3D prompt、模型版本和参考图路径。
- `*_raw_inspection.json`：Blender 导入后的顶点、三角面、包围盒和贴图检查数据。
- `*_raw_front.png` / `*_raw_threequarter.png`：Blender 导入真实 GLB 后的检查渲染，不是生成参考图。
- `manifest.json`：逐类模型、任务、校验哈希及骨架族映射。
- `inspect_enemy.py`：本次 Blender 检查脚本副本；运行参数为原始 GLB 路径、输出目录。

## 制作与接入边界

`*_raw.glb` 是保留的高质量原始资产，不是微信运行包；不得直接把本目录整体复制进运行资源。已由下述制作脚本完成减面、缩贴图、落地、骨骼权重和动作，最终 GLB 位于编辑器项目的 `assets/world3d/enemies/`。人形均为空手 A 姿态，避免武器和手部粘连；野猪、狼王、獠牙兽王是四足中性站姿。武器由运行层独立挂点装配。

Blender 导入后的朝前方向为 -Y，上为 +Z；模型原点通常居中，落地时使用各模型实际包围盒 minZ，不能复用同一个固定偏移。各角色身形差异是刻意设计，骨骼权重需按各自关节位置检查。原始模型本身不带骨骼；下述运行版本已完成实际 GLB 重导入与动画逐帧检查。这些 Blender 证据不等于 Laya 或微信真机动画验收。

生成参数统一为 `hyper3d-gen2 / Shaded / Quad / face-count 10000 / glb`。GLB 导出通常已三角化，实际三角面数以 inspection 为准。每类只提交一个 Hyper3D 任务，没有超时重发或供应商自动切换。

## 类型与任务追溯

| 类型 ID | 中文名称 | task_id | 三角面 | 原始字节 |
|---|---|---|---:|---:|
| enemy_raider | 山匪 | cgt-20261113085048-nq42m | 21236 | 3651756 |
| enemy_runner | 疾行匪 | cgt-20261113085415-lwzhq | 21930 | 3811356 |
| enemy_armored | 甲兵 | cgt-20261113085416-rmgbp | 20932 | 3600340 |
| enemy_boar | 野猪 | cgt-20261113084721-txq7t | 19924 | 3284592 |
| enemy_disruptor | 扰阵师 | cgt-20261113085047-qxp88 | 22215 | 3875132 |
| enemy_chief | 山寨匪首 | cgt-20261113085453-s2vlz | 21781 | 4105988 |
| enemy_commander | 铁甲统领 | cgt-20261113084658-f6k74 | 22947 | 3640768 |
| enemy_wolfking | 疾风狼王 | cgt-20261113085116-zcd8k | 20456 | 3818380 |
| enemy_tuskking | 獠牙兽王 | cgt-20261113085453-6d6hp | 21867 | 3685340 |
| enemy_shaman | 山魈长老 | cgt-20261113085116-9rxxg | 22043 | 4306364 |


## 可编辑源工程与运行模型

- `{id}.blend`：减面后的网格、512 贴图、真实蒙皮权重、骨架及 `idle` / `walk` 两个动作。打开 Blender 后可修改骨骼和权重。未混入检查用摄影机。
- `{id}_runtime_report.json`：实际运行 GLB 重导入后的骨骼、材质、包围盒、逐帧地面与循环检查记录。
- `{id}_idle_sheet.jpg` / `{id}_walk_sheet.jpg`：实际运行 GLB 各 31 帧的联系表，不是概念图。
- `runtime-manifest.json`：10 项数组，包含运行文件路径、实际 idle 首帧高度、动作名、字节数、三角面和挂点。供接入方读取。
- `runtime-validation.json`：二进制 GLB、蒙皮、贴图、动作及哈希的详细验证记录。
- `socket-follow-validation.json`：实际 GLB 重导入后，20 个头/背挂点在 walk 第 1、8 帧相对父骨变换保持一致、世界位置实际移动的验证。
- 最终运行文件：`res/editor/BuildingWorkshop/assets/world3d/enemies/{id}.glb`。由 Laya 原生导入/发布管线转换；不要同时发布原始 GLB 和转换后的重复资产。

制作脚本为 `res/tools/3d/prepare-enemies.py` 和 `res/tools/3d/enemy_rig.py`。脚本按每类实际形体设置关节，7 类人形和 3 类四足采用不同骨架；四足包含独立前后腿与尾骨。两段动作各 31 个关键采样帧、30 FPS；GLB 采样时间为约 0.0333 至 1.0333 秒，循环跨度 1 秒。动作是实际蒙皮变形，不是缩放模型代替走路。

所有运行模型均为单网格、单蒙皮、单个 `Surface` 材质；贴图为内嵌 512×512 JPEG，质量 90。材质以 `KHR_materials_unlit` 和 `baseColorTexture` 导出，保留底色贴图以便运行时做温和染色。编辑器显示用骨骼小球不属于 GLB 的运行网格。

| 类型 | 实测高度 | 三角面 | 运行字节 |
|---|---:|---:|---:|
| enemy_armored | 1.711978 | 2600 | 182524 |
| enemy_boar | 1.578832 | 2600 | 192148 |
| enemy_chief | 2.246518 | 3500 | 232460 |
| enemy_commander | 2.300360 | 3499 | 241456 |
| enemy_disruptor | 1.802188 | 2599 | 200416 |
| enemy_raider | 1.653176 | 2599 | 197864 |
| enemy_runner | 1.652231 | 2600 | 200024 |
| enemy_shaman | 2.293646 | 3500 | 261260 |
| enemy_tuskking | 2.095548 | 3500 | 256184 |
| enemy_wolfking | 2.195406 | 3499 | 239512 |

10 个 GLB 合计 30,496 三角面、2,203,848 字节。高度是实际 GLB idle 首帧的整体包围盒高度（含发型、头饰等），不是四足肩高。作者目标高度另记在详细报告的 `authoredHeight` 中。

## 挂点约定

每个模型只有一个 `HeadAnchor` 和一个 `BackAnchor`，分别直接随 `Head` 与 `Spine` 骨骼运动；`FootOrigin` 为模型根下的足底参考。头挂点在实际头顶，背挂点在上背后侧。静止姿态下挂点保持模型轴向：Blender +Z 向上、-Y 向前，对应 GLB +Y 向上、+Z 向前；挂点缩放为 1，不通过缩放角色骨架适配配件。

`runtime-manifest.json` 中 `sockets` 记录骨骼与静止位置，`headWidth` 记录各模型头部测量宽度，便于人工检查配件适配；不应把它当作额外的首领整体放大系数。角色整体缩放由运行层统一处理。

## 再生成与验证

在项目根目录执行以下形式，替换类型 ID 和本机 Blender 路径。`--work` 必须放在 Downloads；其中是临时的逐帧 PNG 和报告。默认 `--render all` 会检查并渲染每动作全部 31 帧，`--render key` 只减少图片输出，但仍检查全部帧的地面/循环包围盒。

```sh
"/path/to/Blender" -b --python-exit-code 1 -P res/tools/3d/prepare-enemies.py --   --source res/source/3d/enemies/enemy_boar_raw.glb   --id enemy_boar   --output res/editor/BuildingWorkshop/assets/world3d/enemies/enemy_boar.glb   --editable res/source/3d/enemies/enemy_boar.blend   --work /Users/happyelements/Downloads/daidai-3d-implementation-20261113/enemies/runtime/enemy_boar
```

本批 10 个实际运行 GLB 共重导入并渲染 620 帧；20 张全帧联系表均已人工查看。检查了动作非静止、四足腿序、头与尾跟随、穿地和首尾循环包围盒；二进制检查覆盖蒙皮权重归一、合法骨骼索引、单材质底色贴图、实际 512 JPEG 和动作采样变化。添加最终挂点后，20 张联系表与已检查版本逐字节一致，证明挂点未改变角色形体或动作。Laya 原生转换与微信实机表现由游戏集成阶段另行验证。

源资产、可编辑文件与正式报告在本目录保留；制作中间帧、日志及本次产生的 `.blend1` 备份位于 Downloads 的同任务目录，不进入微信包。
