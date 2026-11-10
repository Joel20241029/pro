# 代代守村：图片资源包

版本：v0.3。日期：2026-11-10。用于竖屏、单机微信小游戏。

当前交付 **184 张源画布、30 组序列帧、120 张动画帧、2 页运行图集**。每个动作 4 帧。成人与儿童已补齐正面、背面、右侧行走，左侧复用右侧镜像；人物移动按实际方向选帧。新增木栅墙与有高光、厚边的 UI 底板。旧母版保留，新母版、源裁切参数、构建脚本和文档均已同步。

## 查看效果与原始素材

- [动态资源预览](preview/index.html)：四方向连续切换、全部动作、暂停和逐帧查看。
- [人物动作总览](preview/characters_contact.png) 与 [静态资源总览](preview/static_contact.png)。
- [原始动作母版](source/animations/) 与 [原始静态母版](source/static/)。
- [资源制作配方](source/asset_recipe.json)：稳定输入，编辑裁切、画布、pivot、九宫格、帧率和方向映射。
- [本轮生成提示词](source/visual_v2_prompts.json) 与 [生成记录](source/generation_records.json)：原图路径、参考图、提示词、尺寸与 SHA-256。

## 分类

| 分类 | PNG / 帧数 | 散图字节 |
| --- | ---: | ---: |
| buildings | 13 | 256,543 |
| terrain | 4 | 26,531 |
| decorations | 8 | 91,386 |
| ui/icons | 24 | 87,784 |
| effects | 8 | 10,864 |
| ui/panels | 7 | 90,511 |
| characters | 96 | 606,351 |
| enemies | 24 | 178,655 |

总计 184：96 张村民帧、24 张敌人帧、64 张静态图。30 组动画是包含方向的动作组，不是 30 种人物或 30 种行为。婴儿和长者保留待机，敌人保留原有六组行走；没有新增人体攻击、受击、死亡动作。

## 图集裁边与导入

图集只裁掉 **alpha=0 的透明外圈**，不按白色删像素，也不裁掉人物的浅色服装。完整源画布仍保存在 runtime；frames.json 保存 sourceSize、trimOffset 和原 pivot，Laya 使用 `Texture.create` 还原裁边偏移，动作切换不会因裁边而改变脚底。九宫格底板保留完整画布，每张图外围保留 2 像素打包间隔。

本轮 159 张图片可裁边，内容占用由 1,171,456 像素降到 982,957 像素，减少 **188,499 像素 / 16.09%**。这是内容面积节省，不是 PNG 字节下降比例；本轮新增方向帧，因此最终资源字节仍比旧版增加。目前仍为两页图集。

运行输入由 manifest.runtimeWhitelist 与 frames.pages 声明，目前为以下四个文件：

- [world_0.png](atlases/world_0.png)：世界图集，1024×1024，1,158,851 字节。
- [ui_0.png](atlases/ui_0.png)：UI / 特效图集，512×512，195,342 字节。
- [frames.json](atlases/frames.json)：自定义矩形、原画布、裁边偏移、pivot、九宫格与页表。
- [animations.json](animations.json)：动作、帧率、静止帧、四方向与敌人原生朝向。

运行图片及元数据共 **1,450,325 字节**。原始母版、runtime 散图、预览、脚本和说明不进微信包。不要递归复制整个 res，也不要同时导入散图和同内容图集。

## 可重复构建

```bash
node /Users/happyelements/Documents/pro/res/tools/build-resources.mjs \
  --work /Users/happyelements/Downloads/daidai-wechat-visual-20261110/work/assets \
  --sync
```

构建依赖 Node.js 和本机 ImageMagick，脚本默认 `/opt/homebrew/bin/magick`；其他机器可设置 `VILLAGE_MAGICK`。临时目录必须位于 Downloads。流程为母版与配方 → 分类散图 → 透明裁边 → 两类图集分页 → 像素/动画检查 → 台账与预览 → Laya 运行白名单。配方不引用生成后的图集坐标，重新排图不会丢失制作依据。

UI 母版含淡辉光，源裁切使用经过检查的显式轮廓矩形；九宫格采用 stretch 输出基准画布，避免方格等比缩放把宽按钮缩成中央小块。普通图片仍采用 contain。不要用母版整格的微弱 alpha 外接框替换这些源裁切框。

## 校验与维护

- [完整台账](manifest.json)：源路径、分类、尺寸、源裁切、哈希、图集坐标和导入状态。
- [体积报告](budget_report.json)：运行字节、分类、裁边面积和两页纹理尺寸。
- [资源校验](validation_report.json)：透明裁边、图集像素、动画引用、画布/pivot 与九宫格检查。
- [图片规范](../doc/tech/02_图片与序列帧资源规范.md) 与 [本轮技术记录](../doc/tech/06_视觉升级与资源管线.md)。
- [144×144 上传图标](branding/app_icon_144.png)：PNG，37,432 字节，小于 2 MB；独立上传用途，不在运行白名单。

完整包体以微信导出目录报告为准；开发者工具运行不等同手机真机验收，目录原始字节不等同微信上传统计。已有 icon.png 和旧源母版均保留。
