# 高清二维资源工具

当前入口见 [资源总说明](../README.md)，全部临时参数 `--work` 必须在Downloads内。当前发布四包，不发布模型或粒子。

| 工具 | 用途 |
| --- | --- |
| `hd2d/bind-walk-character.py` | 从实测角色参数绑定八帧步态及独立站姿；四类分别配置 |
| `hd2d/verify-character-feet.py` | 检查刚性脚底、落地和足轴；不替代连续回放 |
| `hd2d/render-character-directions.py` | 固定灯光/镜头，完整骨骼转向，输出四向八帧及站姿 |
| `hd2d/prepare-production.mjs` | 显式裁切、统一母画布/足点、保留UI抗锯齿和皮肤专用九宫格 |
| `hd2d/prepare-native-prefabs.mjs` | 仅同步制作贴图和种子；保留现有.meta，原生prefab由Laya菜单保存 |
| `hd2d/extract-road-corridor.mjs` | 只读正式路图，提取可落脚土路边界并逐行验证，生成 RoadGeometry.ts；更换路图后必须重跑 |
| `build-building-layouts.mjs`、`build-enemy-layouts.mjs` | 从实际原生prefab生成运行布局与时间轴引用 |
| `build-resources.mjs` | 原图/裁边一致性校验、图集外扩、四包白名单和正式工程同步 |
| `resource-bundles.mjs` | base/buildings/characters/battle资源合同和分配 |
| `optimize-png-lossless.py`、`requirements-png.txt` | 主包 PNG 无损重编码；保留尺寸、RGBA 和颜色空间信息，不进入微信包 |

怪物的身体及配饰位置从 [enemy-layouts.mjs](../source/rendered2d/enemy-layouts.mjs) 同步到种子，再由 Laya 菜单 `RefineHdEnemyAttachments` 保存原生 prefab；最后运行 `build-resources.mjs --work <Downloads任务目录> --sync`。`build-enemy-layouts.mjs` 读取实际 `.lh` 的身体偏移、配饰矩形和前后层级，生成版本 2 合同。不要只手改派生 JSON，也不要为怪物单项修改执行全量建筑重建。

1.0.16 起，`build-resources.mjs` 在写主包图集后执行无损重编码，并逐字节比较解码 RGBA。依赖缺失或像素不同会终止构建；建筑、人物、战斗三包保持原编码。编码器使用 [py-zopfli](https://github.com/fonttools/py-zopfli)，固定版本见 `requirements-png.txt`。

1.0.19 为给战技界面腾出主包空间，将大图无损搜索从 5 轮提高到 15 轮，保留小图 10 轮。仅增加构建耗时，仍禁止减色、缩图或改变透明像素；本轮比 5 轮再节省 9,364 字节。

可在 Downloads 创建专用 Python 环境，然后显式指定工具路径：

```bash
python3 -m venv /Users/happyelements/Downloads/daidai-resource-tools
/Users/happyelements/Downloads/daidai-resource-tools/bin/pip install -r res/tools/requirements-png.txt
VILLAGE_PNG_PYTHON=/Users/happyelements/Downloads/daidai-resource-tools/bin/python \
  node res/tools/build-resources.mjs \
  --work /Users/happyelements/Downloads/daidai-resource-build --sync
```

Blender自动化调用需加 `--python-exit-code 1`，并检查产物报告，不能只看默认退出码。旧3D、像素图和粒子工具仅保留历史，不是当前发布步骤。
