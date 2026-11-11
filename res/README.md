# 代代守村：图片资源包

版本：v0.8。日期：2026-11-11。用于竖屏、单机微信小游戏。

当前交付 **174 张源画布、32 组序列帧、108 张动画帧、2 页运行图集** 。照料与老人动作每组 2 帧，其余动作每组 4 帧。成年男女各一种外观，均有耕作、砍树、照料动作。成人与儿童已补齐正面、背面、右侧行走，左侧复用右侧镜像；人物移动按实际方向选帧。新增木栅墙与有高光、厚边的 UI 底板。旧母版保留，新母版、源裁切参数、构建脚本和文档均已同步。

## 查看效果与原始素材

- [动态资源预览](preview/index.html)：四方向连续切换、全部动作、暂停和逐帧查看。
- [人物动作总览](preview/characters_contact.png) 与 [静态资源总览](preview/static_contact.png)。
- [原始动作母版](source/animations/) 与 [原始静态母版](source/static/)。
- [资源制作配方](source/asset_recipe.json)：稳定输入，编辑裁切、画布、pivot、九宫格、帧率和方向映射。
- [本轮人物方案](source/concepts/villagers_gender_v6.png)、[人物生成提示词](source/villagers_v6_prompts.json)、[早期界面提示词](source/visual_v2_prompts.json) 与 [生成记录](source/generation_records.json)：原图路径、参考图、提示词、尺寸与 SHA-256。

## 分类

| 分类 | PNG / 帧数 | 散图字节 |
| --- | ---: | ---: |
| buildings | 13 | 256,543 |
| terrain | 4 | 26,531 |
| decorations | 8 | 91,386 |
| ui/icons | 25 | 91,059 |
| effects | 8 | 10,864 |
| ui/panels | 8 | 27,392 |
| characters | 88 | 567,182 |
| enemies | 20 | 162,761 |

总计 174：88 张村民帧、20 张敌人帧、66 张静态图。32 组动画包含方向变体，均已有运行入口；静态资源仍有候选。旧 B 外观、旧版长者待机和杂兵换装退出运行图集，原图保留，裁片配置归档于 [旧版配方](source/archive/adult_variants_v1_recipe.json)。没有新增人体攻击、受击、死亡动作。

## 图集裁边与导入

图集只裁掉 **alpha=0 的透明外圈** ，不按白色删像素，也不裁掉人物的浅色服装。完整源画布仍保存在 runtime；frames.json 保存 sourceSize、trimOffset 和原 pivot，Laya 使用 `Texture.create` 还原裁边偏移，动作切换不会因裁边而改变脚底。九宫格底板保留完整画布，每张图外围保留 2 像素打包间隔。

本轮 152 张图片可裁边，内容占用由 1,045,916 像素降到 887,070 像素，减少 **158,846 像素 / 15.19%** 。这是内容面积节省，不是 PNG 字节下降比例。目前仍为两页图集。

运行输入由 manifest.runtimeWhitelist 与 frames.pages 声明，目前为以下四个文件：

- [world_0.png](atlases/world_0.png)：世界图集，1024×1024，1,110,913 字节。
- [ui_0.png](atlases/ui_0.png)：UI / 特效图集，512×512，132,722 字节。
- [frames.json](atlases/frames.json)：自定义矩形、原画布、裁边偏移、pivot、九宫格与页表。
- [animations.json](animations.json)：动作、帧率、静止帧、四方向与敌人原生朝向。

运行图片及元数据共 **1,338,735 字节** 。原始母版、runtime 散图、预览、脚本和说明不进微信包。不要递归复制整个 res，也不要同时导入散图和同内容图集。

当前这四个文件由 Laya 原生发布配置打入微信 `resources/village` 分包，运行 URL 和工程导入目录保持原样。发布器额外生成分包 `game.js` 与 `fileconfig.json`，因此导出分包为六个文件、1,338,986 字节。它们是发布产物，不应加进美术白名单或制作配方。Main 等待分包加载成功后才读取图集；主包不复制同一套图片，原始母版、配方、裁边和动画参数均未改变，详见 [11 微信原生分包](../doc/tech/11_微信原生分包.md)。

## 可重复构建

### 攻击小图的使用

箭楼使用已有 [箭矢](runtime/effects/fx_arrow.png)，石塔使用已有 [石块](runtime/effects/fx_stone.png)，均为 48×48 透明 PNG。它们已经打入 ui_0 图集，此次接入弹道没有增加图片包体。原图朝向、用途及命中衔接已补入制作配方 mapping；原始 [effects 母版](source/static/effects.png) 与生成记录继续保留。

箭矢原图向右，代码绕画布中心旋转；石块用短抛弧与自转。两者落点共用 fx_hit，寒塔复用 fx_ice/fx_slow_ring。运行中的显示尺寸、时间和轨迹由 [ProjectileMotion.ts](../project/LayaProject/src/view/ProjectileMotion.ts) 控制，完整表现约定见 [技术记录](../doc/tech/06_视觉升级与资源管线.md)。修改图片须从现有母版/配方重建，修改轨迹无需重画或增加序列帧。

### 执行构建

```bash
node /Users/happyelements/Documents/pro/res/tools/build-resources.mjs \
  --work /Users/happyelements/Downloads/daidai-wechat-visual-20261110/work/assets \
  --sync
```

构建依赖 Node.js 和本机 ImageMagick，脚本默认 `/opt/homebrew/bin/magick`；其他机器可设置 `VILLAGE_MAGICK`。临时目录必须位于 Downloads。流程为母版与配方 → 分类散图 → 透明裁边 → 两类图集分页 → 像素/动画检查 → 台账与预览 → Laya 运行白名单。配方不引用生成后的图集坐标，重新排图不会丢失制作依据。

UI 母版含淡辉光，源裁切使用经过检查的显式轮廓矩形；九宫格采用 stretch 输出基准画布，避免方格等比缩放把宽按钮缩成中央小块。普通图片仍采用 contain。不要用母版整格的微弱 alpha 外接框替换这些源裁切框。

## 九宫格进一步缩小

本轮另将九宫格的可拉伸中心和边条压成 2 像素，四角保持原像素。木框面板从 160×160 变为 98×98；卡片、四种按钮和头像框变为 30×30。原基准尺寸记录在 recipe.nineSliceSourceSize，最终帧表使用紧凑尺寸。可拉伸区域的细微渐变会简化，并非整张图片严格无损；四角会逐像素验证。

新增 Tip 使用独立的 [32×32 底图](runtime/ui/panels/panel_tip.png)，无木框与装饰描边，浅麦金色，深棕文字，无外投影，仅 767 字节。原图和完整提示词分别保存于 [Tip 母版](source/static/village_tip_v4.png) 与 [提示词](source/visual_v4_prompts.json)。动态预览额外提供九宫格拉伸展示。

统一人物并补齐劳动动作时，运行美术与元数据曾由 1,384,589 减至 1,172,578 字节。此前新增男女老人共 16 帧后为 1,300,061 字节；本轮六类人物重画后为 1,338,735 字节，仍低于统一人物前的体积。两页尺寸没有改变，不能据此声称纹理显存减少。人物与建筑没有降采样。

当前成人工作母版为 [adults_work_v6.png](source/animations/adults_work_v6.png)，对应 [完整提示词](source/villagers_v6_prompts.json)。旧 adults_work_v4 母版与提示词作为历史保留。成家红心复用 [fx_hearts](runtime/effects/fx_hearts.png)，不增加新特效图；两个角色各自头顶显示，继承人物足底遮挡。详见 [动画审计与岗位规则](../doc/tech/07_人物动画审计与自动岗位.md)。

## 老人动画制作源

当前使用 [elders_v6.png](source/animations/elders_v6.png) 母版及 [完整提示词](source/villagers_v6_prompts.json)，旧 elders_v5 母版与提示词保留。男女各 8 帧：正面、背面、右侧行走各 2 帧，待机 2 帧；左侧镜像右侧。行走 4 FPS、待机 2 FPS，80×80 原画布、足底 pivot 为 `(40,77)`。裁片分别放在 `runtime/characters/elder_male/`、`elder_female/`，条带和 GIF 与图集同步生成。旧版单组老人待机仍归档，不混用。

荣休后在村内慢走和驻足，老人详情与寿终家谱使用对应性别的待机静止帧。具体触发条件见 [08 晚年生活与滑动列表](../doc/tech/08_晚年生活与滑动列表.md)。

## 本轮人物辨识重画

成年、儿童、老人六类人物共替换 84 帧：男性冷蓝衣与短发，女性暖橘衣与长辫，老人延续对应冷暖色并呈现白发差异。当前母版为 `adults_walk_v6.png`、`adults_work_v6.png`、`children_walk_v6.png`、`elders_v6.png`。原画布、足底 pivot、帧 ID、动作帧数和 FPS 保持不变，仍沿用原导航与遮挡。旧 84 帧裁片配置保存在 [重画前配方](source/archive/villagers_pre_v6_recipe.json)，完整生产约定见 [09 人物辨识与生育预检](../doc/tech/09_人物辨识与生育预检.md)。

## 校验与维护

- [完整台账](manifest.json)：源路径、分类、尺寸、源裁切、哈希、图集坐标和导入状态。
- [体积报告](budget_report.json)：运行字节、分类、裁边面积和两页纹理尺寸。
- [资源校验](validation_report.json)：透明裁边、图集像素、动画引用、画布/pivot 与九宫格检查。
- [图片规范](../doc/tech/02_图片与序列帧资源规范.md) 与 [本轮技术记录](../doc/tech/06_视觉升级与资源管线.md)。
- [144×144 上传图标](branding/app_icon_144.png)：PNG，37,432 字节，小于 2 MB；独立上传用途，不在运行白名单。

完整包体以微信导出目录报告为准；开发者工具运行不等同手机真机验收，目录原始字节不等同微信上传统计。已有 icon.png 和旧源母版均保留。

## 好友榜奖杯与复用表现

新增 [奖杯母版](source/static/ranking_trophy_v1.png) 和 [完整提示词](source/ranking_trophy_v1_prompt.txt)，生成记录含原路径、尺寸和 SHA-256；`asset_recipe.json` 明确裁切与 48×48 输出，图集照常裁透明边。新增奖杯没有引入新的动画组，完整运行资源仅增加 4,057 字节。

成家红心从 30 调为 52 逻辑像素；精英村民使用现有人物帧整体缩放 1.25 倍，保留原足底。不要为两种表现复制人物帧或改写图集。规则与微信 Layout 来源见 [技术文档 10](../doc/tech/10_好友榜与精英村民.md)。

好友榜入口修订为首波成功后显示，继续复用现有奖杯原图与图集；删除面板额外按钮、扩大列表均为代码布局调整，无需新增或改写图片资源。
