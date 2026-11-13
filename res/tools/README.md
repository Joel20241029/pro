# 资源构建工具

## 当前正式入口

2026-11-13 用户确认恢复原二维表现，取消实时 3D 及 3D 转二维方案。正式资源入口恢复 `build-resources.mjs`，保留高清矢量 UI，人物头像使用原帧；不使用模型渲染生成的新二维资源。

```bash
node res/tools/build-resources.mjs \
  --work /Users/happyelements/Downloads/daidai-restore-2d-20261113/resource-build \
  --sync
```

`--work` 必须位于 Downloads，保存本次中间裁片和构建产物；`--sync` 同步受管资源到 `project/LayaProject/assets/resources/`。回退中的脚本保护、资源契约和加载器必须一起调整，不允许仅降低 manifest 版本来绕过旧的 v4 保护。

## 二维制作链

| 工具 | 职责 |
| --- | --- |
| `build-resources.mjs` | 母版裁切、透明裁边、九宫格、图集、资源台账、验证报告与同步 |
| `build-building-layouts.mjs` | 七个原生二维建筑预制体转紧凑部件布局与共享原生时间轴 |
| `prepare-enemy-sources.mjs`、`build-enemy-layouts.mjs` | 十种敌人源图与二维组合布局 |
| `build-particle-layouts.mjs` | 原生二维粒子预制体转 base、characters、battle 配置 |
| `resource-bundles.mjs` | 三包分配、白名单、分包帧与动作索引、代码侧资源契约 |
| `seed-building-layouts.mjs` | 制作源搭建辅助；日常改动优先编辑已有原生预制体 |

保留四类命中、精英圈及大王之心红色按钮环绕，共六种二维粒子；不恢复攻击拖尾和建筑升级粒子。三包职责、原生源和资源边界见 [资源总说明](../README.md)。仅发布运行白名单，不能把编辑工程、预览或原始素材递归带入游戏。

构建成功不等于表现验收。回退后须验证裁边与足底、四方向动画、建筑遮挡与射口、暂停倍速、粒子生命周期、三包加载和完整微信目录体积；具体待验证项见 [技术记录 31](../../doc/tech/31_恢复二维场景与序列帧.md)。

## 停止采用的试验工具

`build-world3d-resources.mjs` 与 `3d/` 下的模型生成工具保留历史用途，不属于当前发布步骤；原始 3D 模型和 world3d 编辑源保留追溯，不加载、不发布，也不转渲染成二维资源。旧 3D 构建记录不能当作当前二维链路验证结果。
