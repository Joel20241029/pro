# 已停用的实时三维编辑器脚本

`WorldParticle3DWorkshopScene.ts` 是此前实时三维粒子的制作与验证脚本。回退二维后，它引用的 `World3DConfig` 和 `WorldParticle3DConfig` 已不存在，留在 Laya 的 `assets/` 下会阻止整个原生编辑器编译。

2026-11-13 将脚本及原 `.meta` 从 `res/editor/BuildingWorkshop/assets/world3d/effects/` 原样归档到这里，供历史溯源。这里不在编辑器的编译目录内，不参与游戏发布，也不表示恢复实时三维或粒子效果。原文件没有被重写。
