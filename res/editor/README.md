# Laya可编辑源工程

使用 `BuildingWorkshop/BuildingWorkshop.laya`（LayaAir 3.4.2）。当前为高清预渲染二维，详细制作入口见 [资源总说明](../README.md)。

- `assets/buildingAuthoring/`：七种独立建筑prefab，108等级/房数布局，Body/Weapon/Muzzle、足底、占地、可见范围和原生时间轴。
- `assets/enemyAuthoring/`：五小怪和五首领，2～4帧正面整图、头/背配件挂点。
- `assets/editor/Hd2dProduction*.ts`：在真实Laya编辑器实例化、保存并验证上述源工程。
- `Hd2dProductionBuildings.ls`、`Hd2dProductionEnemies.ls`：制作预览场景，不作为一个总prefab发布。

人物可编辑离线渲染源在 `../source/rendered2d/characters/`，UI生成母版和裁切参数在 `../source/rendered2d/`。运行时使用二维图集。旧world3d/particleAuthoring只供历史追溯，不再进入当前包。
