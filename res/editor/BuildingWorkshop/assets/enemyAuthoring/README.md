# 怪物原生制作目录

打开上层 `BuildingWorkshop.laya`，使用 LayaAir IDE 3.4.2。与建筑共用一个可打开的制作工程，但目录和预制体完全分开：10 种怪物各自一个 .lh。

| 子目录/文件 | 内容与用途 |
| --- | --- |
| prefabs/ | 5 小怪、5 首领独立原生预制体，正式布局权威源 |
| textures/ | 从母版配方生成的身体、细节和配件贴图；用于编辑器原生显示 |
| layout-seeds.json | 首次搭建与明确重做时的挂点种子；日常导出不读取种子替代 .lh |

每个预制体根为 96×96。Frame0～Frame3 各包含 TintBody、FixedDetails、HeadSocket、BackSocket；同时只显示一帧进行调整。SortOrigin 固定为 (48,92)，VisualBounds 为源画布。修改头/背挂点后直接保存对应 .lh；身体与细节保持相同画布、单位变换，不分别挪动。

`工具 / BuildVillageEnemies` 使用原生 `CreateAssetUtil.createPrefab` 保存 10 个文件，会重置人工挂点，仅在明确重做时使用。日常使用构建脚本从已保存 .lh 严格转换到 `res/native/enemies.json`。遇到不支持属性直接报错，避免编辑器和运行效果悄悄分歧。

行走仍是 4 帧，运行使用共同战斗时钟选帧；这次没有引入网格蒙皮骨骼。配色、兼容饰物、受控尺寸在正式项目 `src/view/config/EnemyVisualConfig.ts`，每只最多身体、细节、头饰、背饰 4 层，不额外生成组合整图。
