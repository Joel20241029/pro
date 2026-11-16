# 编辑器工具

BuildingWorkshop 是编辑器菜单进程，BuildingWorkshopScene 是原生场景进程；不能合并为同一模块，否则 IEditor/IEditorEnv 环境不一致。BuildingGameCheck 和 BuildingGameCheckScene 用于正式 GameView 离屏验收。仅在编辑器运行，不进入游戏。

高清正式制作使用 `Hd2dProductionWorkshop`（菜单）与 `Hd2dProductionScene`（场景）配对。在 LayaAir IDE 打开本工程后：

- `工具 / BuildHd2dProduction`：读取 `res/source/rendered2d/production_recipe.json` 与 `native-layout-seeds.json`，通过原生预制体接口保存七种独立建筑及等级布局。
- `工具 / RefineHdArrowWeapons`：只调整箭塔十二级的左右弩组。围绕原支架底部连接点放大到 1.3 倍，发射口随弩组变换；保存 `buildingAuthoring/prefabs/ARROW.lh`，再输出左右两组截图与报告。
- `工具 / RefineHdEnemyAttachments`：通过 `Hd2dEnemyRefinementScene` 只保存十种怪物及其预览场景；逐帧校准身体、面具、头饰、旗帜和披肩，输出 28 帧共 164 个组合画面。不会重写建筑，原怪物 prefab UUID 保留。

2026-11-13 的箭塔细化已在实际 LayaAir IDE 执行，证据位于 `/Users/happyelements/Downloads/daidai-hd2d-full-20261113/native-refinement/`。它验证编辑器预制体，微信中的最终显示另见设计文档第 9 节。

预制体修改后，使用 `res/tools/build-resources.mjs --work <Downloads/任务目录> --sync` 重建。运行布局从 `.lh` 转换，不能仅修改游戏里的 JSON 而遗漏此处原件。完整重建所用的种子布局也必须保留相同的锚点、位置和缩放，避免下一次原生制作恢复旧尺寸。
