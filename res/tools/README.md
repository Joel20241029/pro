# 高清二维资源工具

当前入口见 [资源总说明](../README.md)，全部临时参数 `--work` 必须在Downloads内。当前发布四包，不发布模型或粒子。

| 工具 | 用途 |
| --- | --- |
| `hd2d/bind-walk-character.py` | 从实测角色参数绑定八帧步态及独立站姿；四类分别配置 |
| `hd2d/verify-character-feet.py` | 检查刚性脚底、落地和足轴；不替代连续回放 |
| `hd2d/render-character-directions.py` | 固定灯光/镜头，完整骨骼转向，输出四向八帧及站姿 |
| `hd2d/prepare-production.mjs` | 显式裁切、统一母画布/足点、保留UI抗锯齿和皮肤专用九宫格 |
| `hd2d/prepare-native-prefabs.mjs` | 仅同步制作贴图和种子；保留现有.meta，原生prefab由Laya菜单保存 |
| `build-building-layouts.mjs`、`build-enemy-layouts.mjs` | 从实际原生prefab生成运行布局与时间轴引用 |
| `build-resources.mjs` | 原图/裁边一致性校验、图集外扩、四包白名单和正式工程同步 |
| `resource-bundles.mjs` | base/buildings/characters/battle资源合同和分配 |

Blender自动化调用需加 `--python-exit-code 1`，并检查产物报告，不能只看默认退出码。旧3D、像素图和粒子工具仅保留历史，不是当前发布步骤。
