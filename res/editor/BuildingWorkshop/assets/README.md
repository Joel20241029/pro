# 编辑器资源

buildingAuthoring 保存七种建筑原生制作源，enemyAuthoring 保存十种怪物原生制作源；editor 保存编辑器菜单与场景进程工具。BuildingPreview.ls、EnemyVariantsPreview.ls、EnemyWalkPreview.ls 是成品对比场景，EnemyCompositionSpike.ls 是能力小样，不作为混合 prefab 发布。

resources 是正式 GameView 视觉验收的可再生三包缓存，不进入版本控制；正式运行以生产游戏工程为准。详见各制作目录的 README。

hd2dAuthoring 保存本轮高清二维材质、独立塔预制体与人物/怪物动作小样；Hd2dProbe.ls 是对应原生小场景，尚未接入正式 GameView。它不替代原有成品资源，查看方式和验收边界见该目录的 README。
