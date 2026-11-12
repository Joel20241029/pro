# 建筑制作工程

使用 LayaAir IDE 3.4.2 导入本目录或打开 `BuildingWorkshop.laya`。工程可独立编辑，不依赖 Downloads 中的试验项目。`engine/` 是 IDE 生成的本地引擎与声明，未纳入版本库；请使用对应版本的 IDE 生成。

## 日常编辑

打开 `assets/buildingAuthoring/prefabs/` 中对应的一个 .lh。每个文件只包含一种建筑；子节点按“种类_级别_房间数”命名。编辑时只显示一个变体，切换 Visible 后直接调整内部部件。容器根保持128×128、单位变换；不要移动变体根或排序足底。

`Body` 绑定 upgrade.mc，`Weapon` 绑定 attack.mc。在时间轴面板可查看、播放和修改关键帧。升级动画0.6秒、攻击动画0.3秒，实际运行由游戏时钟采样，Auto Play保持关闭。

`VisualBounds` 是动画可见范围；`Footprint` 是地面占地；`SortOrigin` 是遮挡基准；`Muzzle` 位于武器内部。范围节点隐藏且不带贴图。农田的 `AboveGround` 和 `AboveFootprint` 单独描述水车，不改变田畦可行走属性。

## 菜单工具

- `工具 / BuildVillageBuildings`：从 layout-seeds.json 重新生成七个原生预制体。仅用于首次搭建或明确重做，会覆盖人工布局；日常编辑不用点。
- `工具 / PreviewVillageBuildings`：读取已保存的 .lh，经原生渲染生成四档对比图和 BuildingPreview.ls，记录真实 .mc 采样结果。
- `工具 / CheckBuildingsInGame`：读取下载目录中的正式游戏测试编译，使用实际 GameView、SpriteFrames、VillageNavigation 渲染短屏/长屏昼夜夹具。需要先完成项目测试编译；不会连接微信云数据或写入真实游戏存档。

- `工具 / CompareGameRefactor`：读取 `~/Downloads/daidai-refactor-20261112/` 内两份正式 CommonJS 编译，在原生 Laya 中对照 8 组场景和 23 个面板；PNG 和节点树输出到 native-baseline/native-current。只用于行为保持验收，见 [技术文档 25](../../../doc/tech/25_代码分层与行为保持重构.md)。

两个原有验证菜单的中间输出位于 `~/Downloads/daidai-building-editor-20261112/evidence/`。正式保留的效果图在 `res/preview/buildings/`。GameView验收所需 `assets/resources/` 是自动复制缓存，已排除版本控制与建筑发布，制作源仍以 res/source 和原生预制体为准。

## 发布到游戏

在仓库根运行 `node res/tools/build-resources.mjs --work <Downloads内目录> --sync`。转换器读取原生 .lh，拒绝未知属性、纹理或动画。修改范围后必须执行建筑与全屏测试，不能只运行编辑器搭建命令。

`BuildingPreview.ls` 是查看多个成品的场景，不是将所有建筑装入一个 prefab。正式游戏不会加载这个预览场景。
