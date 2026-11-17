# 高清二维资源工具

当前入口见 [资源总说明](../README.md)，`--work` 指向 Downloads 内目录。发布图集按七类资源拆分，通过进村和守夜两段加载。

| 工具 | 用途 |
| --- | --- |
| `hd2d/bind-walk-character.py` | 从实测角色参数绑定八帧步态及独立站姿；四类分别配置 |
| `hd2d/verify-character-feet.py` | 检查刚性脚底、落地和足轴；不替代连续回放 |
| `hd2d/render-character-directions.py` | 固定灯光/镜头，完整骨骼转向，输出四向八帧及站姿 |
| `hd2d/prepare-production.mjs` | 显式裁切、统一母画布/足点、保留UI抗锯齿和皮肤专用九宫格 |
| `hd2d/prepare-native-prefabs.mjs` | 仅同步制作贴图和种子；保留现有.meta，原生prefab由Laya菜单保存 |
| `hd2d/extract-road-corridor.mjs` | 从历史独立路图提取通行走廊，生成 RoadGeometry.ts |
| `hd2d/fit-village-map.mjs` | 由 `prepare-production.mjs` 调用，配准整图到现有通行走廊和城门，并逐行检查土路覆盖 |
| `build-building-layouts.mjs`、`build-enemy-layouts.mjs` | 从实际原生prefab生成运行布局与时间轴引用 |
| `build-resources.mjs` | 原图与裁边一致性校验、图集外扩、阶段白名单和正式工程同步 |
| `resource-bundles.mjs` | 七类资源与两个阶段的分配 |
| `prepare-remote-release.mjs` | 建立不可变的版本目录，验证已推送文件的字节并生成客户端清单 |
| `optimize-png-lossless.py`、`requirements-png.txt` | 历史版本主包 PNG 无损重编码工具 |

怪物的身体及配饰位置从 [enemy-layouts.mjs](../source/rendered2d/enemy-layouts.mjs) 同步到种子，再由 Laya 菜单 `RefineHdEnemyAttachments` 保存原生 prefab；最后运行 `build-resources.mjs --work <Downloads任务目录> --sync`。`build-enemy-layouts.mjs` 读取实际 `.lh` 的身体偏移、配饰矩形和前后层级，生成版本 2 合同。不要只手改派生 JSON，也不要为怪物单项修改执行全量建筑重建。

构建工程素材后，按版本导出到 `/Users/happyelements/Documents/remote-res/`。只提交该版本目录，推送到 Gitee 的 `origin/master`，用资源仓库的完整提交 SHA 核对线上字节并更新客户端清单。微信后台的 `downloadFile` 合法域名须包含 `https://gitee.com` 和 `https://raw.giteeusercontent.com`，供初始请求和跳转使用。

```bash
node res/tools/build-resources.mjs \
  --work /Users/happyelements/Downloads/daidai-resource-build --sync
node res/tools/prepare-remote-release.mjs <版本> --stage
git -C /Users/happyelements/Documents/remote-res add -- <版本>
git -C /Users/happyelements/Documents/remote-res commit --only -m "Publish <版本> resources" -- <版本>
git -C /Users/happyelements/Documents/remote-res push origin HEAD:refs/heads/master
node res/tools/prepare-remote-release.mjs <版本> <已推送的完整提交SHA> --write
```

Blender自动化调用需加 `--python-exit-code 1`，并检查产物报告，不能只看默认退出码。旧3D、像素图和粒子工具仅保留历史，不是当前发布步骤。
