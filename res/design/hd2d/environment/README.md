# 高清环境候选与拆层

本目录属于已批准的高清二维美术试验，不进入正式微信游戏。所有候选仍以用户原参考图为验收标准。

## 文件与来源

| 文件 | 来源及职责 |
| --- | --- |
| `tree_oak_layers.png` | image_gen 圆树原图，上部树体、下部独立地影；花果未画入树体 |
| `tree_pine_layers.png` | image_gen 松树原图，仅采用上部树体，下面偏白的影子不采用 |
| `sign.png` | image_gen 空白木牌；“友谊路”“文明里村”由 Laya 实时文字绘制 |
| `rock_cluster.png` | image_gen 干净边缘石堆；带外发光的旧候选未采用 |
| `flower.png` | image_gen 独立花朵，作为树冠挂件 |
| `fruit_apple.png` | Blender 实际离线渲染的独立苹果 |
| `campfire_base.png` | Blender 实际渲染的石圈与木柴，含静态暖光 |
| `campfire_front.png` | 同一工程、相机和画布的三块前石遮挡层 |
| `campfire_flame_strip.png` | image_gen 火焰四帧，实际为 2172×724，各格 543×724 |
| `generation-prompts.json` | 完整提示词及采用状态，区分描述生成与图片参考调用 |
| `manifest.json` | 每个原文件的实际来源、方法、字节、SHA-256 与接入状态 |

## 裁切与层级

原 PNG 保留不动。裁切框在 `../parts/probe-recipe.json`，取自真实图片尺寸。火焰使用四个相同的 543×448 公共画布，不逐帧裁边、缩成相同可见高度或重新居中。

树体均排除底部阴影。试样复用圆树原图的灰褐色柔和地影作为接地近似，并非每个模型的正式投影。花果在树体根节点内使用局部坐标；树影独立在地面层。

原生布局为 `Hd2dEnvironmentConfig.ts`，组装为 `Hd2dProbeEnvironment.ts`，都在 `res/editor/BuildingWorkshop/assets/editor/`。树、塔、路牌、火堆和人物共同放在 World 容器，按地面点排序；HUD 独立。木牌文字只覆盖板面，排除立柱。火堆内部顺序为底座、火焰、前石。

## 重建和验证

1. 苹果和火堆按 [离线源说明](../../../source/rendered2d/environment/README.md) 重建。
2. 执行 `node res/tools/hd2d/build-probe-assets.mjs`。
3. 在 Laya 菜单执行“工具 → BuildHd2dProbe”。
4. 执行 `node res/tools/hd2d/verify-probe.mjs /Users/happyelements/Downloads/daidai-hd2d-20261113/native`。

检查四帧火焰、人物在树/木牌/火堆前后的六张实际截图，证据在 `../validation/`。完整村内排布、树冠精修、最终阴影、不同机型和游戏寻路仍需单独验收，本试样不修改生产布局或碰撞。
