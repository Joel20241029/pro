# 代代守村：图片资源包

日期：2026-11-10。候选资源版本：v0.2。技术文档见 [图片与序列帧规范](../doc/tech/02_图片与序列帧资源规范.md)。

已生成 134 张候选运行 PNG，包含 18 组、72 张人物与敌人动画帧，每组 4 帧。已分类、切片并合成 2 页图集，现已按运行白名单导入 Laya，并在微信开发者工具实际显示。

## 先看效果

- [打开本地动画预览](preview/index.html)：可播放/暂停、切倍速和逐帧检查。
- [人物与敌人总览](preview/characters_contact.png) 和 [静态资源总览](preview/static_contact.png)。
- [循环 GIF 目录](preview/animations/) 与 [四帧条带目录](preview/strips/)。

![人物与敌人总览](preview/characters_contact.png)

## 分类

| 分类目录 | PNG / 帧数 | 散图字节 |
| --- | ---: | ---: |
| buildings | 12 | 236,318 |
| terrain | 4 | 26,531 |
| decorations | 8 | 91,386 |
| ui/icons | 24 | 87,784 |
| effects | 8 | 10,864 |
| ui/panels | 6 | 54,701 |
| characters | 48 | 296,679 |
| enemies | 24 | 178,655 |

上述数量合计 134，不含源母版、预览和独立上传图标。村民 12 个动作组覆盖 8 个身份造型：4 个成人各有行走与一种工作动作，另有男童、女童、婴儿、长者。6 个敌人造型对应 5 种行为，第六个是杂兵外观变体。未提供完整四方向、攻击、受击和死亡序列，具体覆盖与静止显示见技术文档。

## 推荐导入

只按 manifest.runtimeWhitelist 导入以下 4 个文件：

- [world_0.png](atlases/world_0.png)：世界图集。
- [ui_0.png](atlases/ui_0.png)：UI 与特效图集。
- [frames.json](atlases/frames.json)：自定义矩形、pivot 与九宫格表。
- [animations.json](animations.json)：动作帧序、FPS、循环和 restFrame。

frames.json 是本项目自定义表，不是 Laya 原生 atlas 格式。按 PNG 载入 Texture 后用已核实的 Texture.createFromTexture 切片；或改由 IDE 对 runtime 散图打原生图集，二者择一。不要同时把散图和图集两套图片带进包。

| 项目 | 实际字节 | 设计配额 | 状态 |
| --- | ---: | ---: | --- |
| 世界图集 world_0.png，1024 × 1024 | 838,222 | 900,000 | 配额内 |
| UI/特效图集 ui_0.png，512 × 512 | 159,527 | 200,000 | 配额内 |
| 帧表与动画 JSON | 64,673 | 计入配置 100,000 | 需给其余配置留空间 |
| 候选运行输入合计 | 1,062,422 | — | 约 1.06 MB |
| 原始母版，仅制作参考 | 15,718,639 | 不进包 | source 目录 |

完整游戏还需引擎、适配、代码、场景、音频与配置；这些图片的统计不能代替微信实际计包。原始母版、预览和此说明不进运行包。

## 台账与来源

- [manifest.json](manifest.json)：当前文件、尺寸、源裁切、SHA-256、坐标与导入状态。
- [budget_report.json](budget_report.json)：实际体积与白名单。
- [validation_report.json](validation_report.json)：本地文件/引用/矩形/像素/透明检查，不代表 Laya 或真机通过。
- [source/generation_records.json](source/generation_records.json)：生成来源与母版信息。
- [144 × 144 上传图标](branding/app_icon_144.png)：PNG，37,432 字节，小于 2 MB；复制自已有设计资源。

原有 icon.png 保持原样。branding 图标用于平台上传，不在运行白名单中。运行帧状态为 imported_via_atlas，散图仅保留为资源源文件；地表尚未按严格无缝纹理验收，AI 动作细节仍需在实际尺寸检查。
