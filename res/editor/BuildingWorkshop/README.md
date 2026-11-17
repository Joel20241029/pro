# 高清二维建筑与怪物制作工程

当前使用LayaAir 3.4.2，七种建筑各一个prefab，十种怪物各一个prefab；完整目录说明见 [上级说明](../README.md)。

`工具 / BuildHd2dProduction` 读取 `res/source/rendered2d/native-layout-seeds.json` 和当前配方，原生保存17个prefab，验证108建筑布局及三种塔攻击时间轴。该菜单会重做布局，仅在明确重制时运行；日常微调直接编辑对应 `.lh`。

怪物专项校准使用 `工具 / RefineHdEnemyAttachments`：从 [逐帧配置](../../source/rendered2d/enemy-layouts.mjs) 生成的种子保存十个独立怪物 prefab，保留原 UUID，不触碰建筑。身体画布、配饰矩形及前后顺序以原生节点为准，导出合同为版本 3（小怪 6 帧、首领 8 帧、分类型足点与整轮步幅）。2026-11-16 已执行原生生成并验证 70 帧、96 组组合，制作与实测记录见 [长期经营与怪物重制](../../../doc/tech/46_长期经营与怪物重制.md)；[旧配饰校准记录](../../../doc/tech/38_怪物移动与配饰校准.md) 仅保留当时的帧数。

`prepare-native-prefabs.mjs` 只同步纹理和种子，不手写原生prefab、不重写meta、不建立重复UUID制作区。历史 `hd2dProduction` staging已归档。正式构建始终从当前 `buildingAuthoring` 和 `enemyAuthoring` 转换。

当前包无粒子和实时3D；下文旧菜单和数据仅用于历史版本复现，不能作为高清当前验收结果。

## 历史工程说明

# 建筑、怪物与粒子制作工程

使用 LayaAir IDE 3.4.2 导入本目录或打开 `BuildingWorkshop.laya`。工程可独立编辑，不依赖 Downloads 中的试验项目。`engine/` 是 IDE 生成的本地引擎与声明，未纳入版本库；请使用对应版本的 IDE 生成。

## 日常编辑

打开 `assets/buildingAuthoring/prefabs/` 中对应的一个 .lh。每个文件只包含一种建筑；子节点按“种类_级别_房间数”命名。编辑时只显示一个变体，切换 Visible 后直接调整内部部件。容器根保持128×128、单位变换；不要移动变体根或排序足底。

`Body` 绑定 upgrade.mc，`Weapon` 绑定 attack.mc。在时间轴面板可查看、播放和修改关键帧。升级动画0.6秒、攻击动画0.3秒，实际运行由游戏时钟采样，Auto Play保持关闭。

`VisualBounds` 是动画可见范围；`Footprint` 是地面占地；`SortOrigin` 是遮挡基准；`Muzzle` 位于武器内部。范围节点隐藏且不带贴图。农田的 `AboveGround` 和 `AboveFootprint` 单独描述水车，不改变田畦可行走属性。

## 菜单工具

- `工具 / BuildVillageBuildings`：从 layout-seeds.json 重新生成七个原生预制体。仅用于首次搭建或明确重做，会覆盖人工布局；日常编辑不用点。
- `工具 / PreviewVillageBuildings`：读取已保存的 .lh，经原生渲染生成四档对比图和 BuildingPreview.ls，记录真实 .mc 采样结果。
- `工具 / CheckBuildingsInGame`：读取下载目录中的正式游戏测试编译，使用实际 GameView、SpriteFrames、VillageNavigation 渲染短屏/长屏昼夜夹具。需要先完成项目测试编译；不会连接微信云数据或写入真实游戏存档。
- `工具 / CheckBuildingTips`：使用相同正式编译，验收两栋民房的尖端缩放气泡、原生命中选择、面板拦截、重排及重开清理。输出到 `~/Downloads/daidai-building-tip-20261112/native/`，完整说明见 [技术文档 26](../../../doc/tech/26_建筑点击气泡.md)。
- `工具 / CheckVillageInteraction`：验证地图村民点击详情，包含人物阶段、前景选择、节点换人、树木/民房遮挡、农田与夜间暂停恢复，同时渲染共享底板的屏中 Tip。仅使用内存夹具，输出到 `~/Downloads/daidai-person-click-20261112/native/`；不上传排行榜或操作真实存档。

- `工具 / CompareGameRefactor`：读取 `~/Downloads/daidai-refactor-20261112/` 内两份正式 CommonJS 编译，在原生 Laya 中对照 8 组场景和 23 个面板；PNG 和节点树输出到 native-baseline/native-current。只用于行为保持验收，见 [技术文档 25](../../../doc/tech/25_代码分层与行为保持重构.md)。

两个原有验证菜单的中间输出位于 `~/Downloads/daidai-building-editor-20261112/evidence/`。正式保留的效果图在 `res/preview/buildings/`。GameView验收所需 `assets/resources/` 是自动复制缓存，已排除版本控制与建筑发布，制作源仍以 res/source 和原生预制体为准。

## 发布到游戏

在仓库根运行 `node res/tools/build-resources.mjs --work <Downloads内目录> --sync`。转换器读取原生 .lh，拒绝未知属性、纹理或动画。修改范围后必须执行建筑与全屏测试，不能只运行编辑器搭建命令。

`BuildingPreview.ls` 是查看多个成品的场景，不是将所有建筑装入一个 prefab。正式游戏不会加载这个预览场景。

## 怪物制作与验收

10 个独立预制体位于 [assets/enemyAuthoring](assets/enemyAuthoring/README.md)。沿用同一个制作工程，避免重复引擎、插件和配置。

- `工具 / BuildVillageEnemies`：按挂点种子，用 Laya 原生保存十种四帧预制体；会覆盖人工布局，日常编辑不用重复执行。
- `工具 / CheckEnemyComposition`：实际验证 drawImage 局部乘色与配件整体镜像，输出 Downloads 本任务 spike 目录。
- `工具 / VerifyEnemiesInGame`：使用历史编译与三包资源，渲染人物准备/失败状态、长短屏、战前列表、10 种怪物、40 敌人＋20 村民容量及四帧/变体总览。结果位于 `~/Downloads/daidai-enemies-loading-20261112/checks/native/`。

建筑和怪物的历史 GameView 验收菜单共同读取 `~/Downloads/daidai-enemies-loading-20261112/checks/compiled/`，以及本工程保留的 `assets/resources/base`、`characters`、`battle`。CompareGameRefactor 另需旧两份编译和 `~/Downloads/daidai-enemies-loading-20261112/archive/old-village-package/` 的锁定图集。

EnemyVariantsPreview.ls、EnemyWalkPreview.ls 是查看用的原生场景，不是混合怪物 prefab，不参与发布。


## 粒子制作与验收

6 个独立原生粒子预制体及共享材质、shader 位于 [assets/particleAuthoring](assets/particleAuthoring/README.md)。所有粒子使用内置白纹理，不另加图片。1.0.13 保留命中、精英圈和红色按钮环绕，删除拖尾与升级粒子。

- `工具 / BuildVillageParticles`：按 recipe 用真实 Laya 原生组件和资产保存器重建，覆盖手工参数；日常调参直接编辑对应 `.lh`。
- `工具 / VerifyParticlesInGame`：读取 `~/Downloads/daidai-release-1.0.13/checks/compiled/` 的正式游戏编译，在原生持续渲染中验证 6 种效果、长短屏、保留建筑升级动作、实际命中粒子的暂停和三倍速压力场景。输出至该任务 `checks/native/`，全部存档在内存。

运行分包只装原生序列化转换后的粒子参数。发布资源、包体与验证边界见 [技术文档 29](../../../doc/tech/29_粒子特效与动作反馈.md)。

## 1.0.25 阴影维护

怪物预制体根节点包含独立 ContactShadow，与当前 Frame 共用父变换；原生保存与全量制作入口均支持它。导出合同升级为 v4，贴图继续引用已有 shadow_actor。具体制作流程见 [怪物制作源](assets/enemyAuthoring/README.md)，验证与发布见 [技术文档47](../../../doc/tech/47_动画内阴影与自动最高难度.md)。
