# Laya 可编辑源工程

当前采用二维制作入口 `BuildingWorkshop/BuildingWorkshop.laya`，使用 LayaAir IDE 3.4.2；正式游戏工程在仓库根目录 `project/LayaProject/`。2026-11-13 用户已取消实时 3D 和 3D 转二维路线，恢复原图集、序列帧与部件建筑。回退验证状态见 [技术记录 31](../../doc/tech/31_恢复二维场景与序列帧.md)。

## 当前二维制作源

- `BuildingWorkshop/assets/buildingAuthoring/`：HOUSE、FARM、LOGGING、GATE、ARROW、STONE、SLOW 七个独立预制体，保留等级、房数变体、足底、占地、可见范围、射口及原生时间轴。
- `BuildingWorkshop/assets/enemyAuthoring/`：5 小怪＋5 首领的二维组合预制体，保留原序列帧、身体和配件挂点。
- `BuildingWorkshop/assets/particleAuthoring/`：四类命中、精英脚底圈、大王之心鲜红按钮环绕，共六种二维粒子；不恢复拖尾和升级粒子。

构建使用 `res/tools/build-resources.mjs --work <Downloads任务目录> --sync`。制作源经专用转换器生成布局、动画及粒子配置，再按 base、characters、battle 白名单发布；制作工程、编辑器脚本、元数据与预览图不进入微信包。不得手改生成图集或转换结果。

高清 UI 面板和图标保留游戏代码矢量绘制，人物头像恢复原人物序列帧。二维人物继续使用既有性别、年龄和岗位对应素材，不采用试验中的五套 3D 模型外观划分。

## 停止采用的 3D 试验

`BuildingWorkshop/assets/world3d/` 与 `res/source/3d/` 保留可追溯制作源，不作为当前发布输入，也不转渲染为二维资源。原导入、官方导出及模型验证记录仍可阅读，但只描述试验当时的结果。修改当前二维资源时，不执行 world3d 导出链覆盖 bundles。

回退前完整快照位于 `/Users/happyelements/Downloads/daidai-restore-2d-20261113/before/realtime-3d-snapshot.tar.gz`。
