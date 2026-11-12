# 代代守村：图片与音频资源包

1.0.4 全面屏适配复用现有图片，没有新增或改写原图、图集、裁边、pivot 与九宫格。人物 64～68 的显示尺寸、建筑位置和安全区由 GameLayout/VillageScene 管理，头顶挂点同时应用屏幕与精英缩放。维护说明见 [19](../doc/tech/19_全面屏与安全区适配.md)。

居民区后续收紧为地图约 32%，城门血条改为程序绘制的 88×7 逻辑像素，血量字号22，二者共同对齐城门中心；这些是 GameLayout/GameView 的显示参数，图片源、制作配方和图集继续复用。调整记录与验证见 [19 第 10 节](../doc/tech/19_全面屏与安全区适配.md#10-居民区再次收紧与城门居中)。

配置 10 本轮重点：无栏农田母版 [farm_open_v10.png](source/static/farm_open_v10.png) 及 [完整提示词](source/farm_v10_prompts.json)，扰阵师/匪首源裁切对齐，19 张备用图退出运行图集。具体挂点、运行入口与验证见 [18 村庄视觉与每日口粮](../doc/tech/18_村庄视觉与每日口粮.md)。所有旧母版继续保留。

版本：v0.13。日期：2026-11-12。用于竖屏、单机微信小游戏。

当前交付 **196 张源画布、177 张运行素材、19 张备用素材、32 组序列帧、108 张动画帧、2 页运行图集** 。照料与老人动作每组 2 帧，其余动作每组 4 帧。成年男女各一种外观，均有耕作、砍树、照料动作。成人与儿童已补齐正面、背面、右侧行走，左侧复用右侧镜像；人物移动按实际方向选帧。新增木栅墙与有高光、厚边的 UI 底板。旧母版保留，新母版、源裁切参数、构建脚本和文档均已同步。

2026-11-12：新增独立花果与升级部件；全部32组人物/敌人动画保留序列帧，编辑器制作验证未通过，详见 [交付与验证](../doc/tech/22_场景音频与图文排版交付.md)。本次图标图文排版只调整显示尺寸和挂点，不改原始48×48图标。

## 查看效果与原始素材

- [动态资源预览](preview/index.html)：四方向连续切换、全部动作、暂停和逐帧查看。
- [人物动作总览](preview/characters_contact.png)、[运行静态资源总览](preview/static_contact.png) 与 [备用素材总览](preview/reserve_contact.png)。
- [原始动作母版](source/animations/) 与 [原始静态母版](source/static/)。
- [资源制作配方](source/asset_recipe.json)：版本 3 稳定输入，编辑裁切、画布、pivot、九宫格、帧率、方向和每项 runtime/usage。
- [本轮人物方案](source/concepts/villagers_gender_v6.png)、[人物生成提示词](source/villagers_v6_prompts.json)、[早期界面提示词](source/visual_v2_prompts.json) 与 [生成记录](source/generation_records.json)：原图路径、参考图、提示词、尺寸与 SHA-256。

## 分类

| 分类 | 源画布 | 运行 | 备用 | 散图字节 |
| --- | ---: | ---: | ---: | ---: |
| buildings | 25 | 24 | 1 | 288,290 |
| terrain | 4 | 0 | 4 | 26,531 |
| decorations | 12 | 10 | 2 | 97,423 |
| ui/icons | 25 | 15 | 10 | 91,059 |
| effects | 14 | 12 | 2 | 31,686 |
| ui/panels | 8 | 8 | 0 | 27,392 |
| characters | 88 | 88 | 0 | 567,182 |
| enemies | 20 | 20 | 0 | 162,846 |

总计 196：88 张村民帧、20 张敌人帧、88 张静态图。运行图集包含 108 帧动画和 69 张静态图；19 张未接入静态图仅保留制作源与预览。32 组动画均有运行入口。旧 B 外观、旧版长者待机和杂兵换装另归档于 [旧版配方](source/archive/adult_variants_v1_recipe.json)，没有新增人体攻击、受击、死亡动作。

备用 19 张为：未点燃火堆、四种地砖、直/角木栏、铃/暂停/播放/设置/关闭图标、四季图标、升级图标、声波与升级特效。它们不进入发布图集，源文件仍可继续迭代。每项具体 ID、用途与是否发布由 recipe.runtime/usage 和 manifest.importStatus 明确区分。

## 图集裁边与导入

图集只裁掉 **alpha=0 的透明外圈** ，不按白色删像素，也不裁掉人物的浅色服装。完整源画布仍保存在 runtime；frames.json 保存 sourceSize、trimOffset 和原 pivot，Laya 使用 `Texture.create` 还原裁边偏移，动作切换不会因裁边而改变脚底。九宫格底板保留完整画布，每张图外围保留 2 像素打包间隔。

本轮 160 张运行图片可裁边，内容占用由 992,108 像素降到 829,922 像素，减少 **162,186 像素 / 16.35%**。这是内容面积节省，不是 PNG 字节下降比例。目前仍为两页图集。

运行输入由 manifest.runtimeWhitelist 与 frames.pages 声明，目前为以下七个文件：

- [world_0.png](atlases/world_0.png)：世界图集，1024×1024，1,086,332 字节。
- [ui_0.png](atlases/ui_0.png)：UI / 特效图集，512×512，114,966 字节。
- [frames.json](atlases/frames.json)：自定义矩形、原画布、裁边偏移、pivot、九宫格与页表。
- [animations.json](animations.json)：动作、帧率、静止帧、四方向与敌人原生朝向。
- [village_loop.mp3](audio/village_loop.mp3)：24 秒原创循环，96,462 字节。
- [battle_loop.mp3](audio/battle_loop.mp3)：14.55 秒夜战循环，58,637 字节。
- [ui_click.mp3](audio/ui_click.mp3)：约 85ms 轻点击，854 字节。

运行图片及元数据共 **1,297,650 字节** ，加三轨音频后共 **1,453,603 字节** 。新增部件散图合计 38,096 字节，新增音频合计 59,491 字节。原始母版、runtime 散图、预览、脚本和说明不进微信包。不要递归复制整个 res，也不要同时导入散图和同内容图集。

当前这七个文件由 Laya 原生发布配置打入微信 `resources/village` 分包，运行 URL 和工程导入目录保持原样。发布器额外生成分包 `game.js` 与 `fileconfig.json`，因此导出分包为九个文件；实际导出字节见 [本轮交付记录](../doc/tech/22_场景音频与图文排版交付.md)。它们是发布产物，不应加进美术白名单或制作配方。Main 等待分包加载成功后才读取图集；主包不复制同一套图片，原始母版、配方、裁边和动画参数继续维护，详见 [11 微信原生分包](../doc/tech/11_微信原生分包.md)。

## 可重复构建

### 头顶表情制作源

新增六张 48 × 48 表情：开心、得意、困倦、安心、喜爱、好奇；分类为 `runtime/effects/emote_*.png`，放入原 512 × 512 UI 图集，未增加页数。旧人物文字气泡已删除，屏幕中央操作 Tip 仍使用自己的九宫格。

原图为 [villager_emotes_v1.png](source/emotes/villager_emotes_v1.png)，完整提示词、实际尺寸、SHA-256 和裁片顺序见 [generation.json](source/emotes/generation.json)。制作方式为内置 imagegen 生成透明 PNG，实际源图 1254 × 1254；3 列 2 行，每格 418 × 627。轮廓裁切写入 [asset_recipe.json](source/asset_recipe.json)，避免母版外圈微弱 alpha 影响缩放。

运行 pivot 为 `(24,48)`，头顶尺寸与轻微上浮由 `VillagerEmotes.ts` 和 `GameView.ts` 管理，沿用 3 秒显示、全村最多一个的表现调度。当前挂点位于足底上方：成人／老人 52、儿童 46 逻辑像素，基础偏移随屏幕布局与精英体型共同缩放，额外最多上浮 3 像素。配置 7 只调整表现坐标，原图、配方及图集未变，见 [塔位覆盖与表情距离](../doc/tech/14_塔位覆盖与表情距离.md)。六张图与元数据合计让运行资源增加 22,691 字节。修改图片应从原图或配方重建，不能直接修改图集。

### 攻击小图的使用

箭楼使用已有 [箭矢](runtime/effects/fx_arrow.png)，石塔使用已有 [石块](runtime/effects/fx_stone.png)，均为 48×48 透明 PNG。它们已经打入 ui_0 图集，此次接入弹道没有增加图片包体。原图朝向、用途及命中衔接已补入制作配方 mapping；原始 [effects 母版](source/static/effects.png) 与生成记录继续保留。

箭矢原图向右，代码绕画布中心旋转；石块用短抛弧与自转。两者落点共用 fx_hit，寒塔复用 fx_ice/fx_slow_ring。运行中的显示尺寸、时间和轨迹由 [ProjectileMotion.ts](../project/LayaProject/src/view/ProjectileMotion.ts) 控制，完整表现约定见 [技术记录](../doc/tech/06_视觉升级与资源管线.md)。修改图片须从现有母版/配方重建，修改轨迹无需重画或增加序列帧。

### 执行构建

```bash
node /Users/happyelements/Documents/pro/res/tools/build-resources.mjs \
  --work /Users/happyelements/Downloads/daidai-wechat-visual-20261110/work/assets \
  --sync
```

构建依赖 Node.js 和本机 ImageMagick，脚本默认 `/opt/homebrew/bin/magick`；其他机器可设置 `VILLAGE_MAGICK`。临时目录必须位于 Downloads。流程为母版与配方 → 全部分类散图 → runtime 筛选 → 透明裁边 → 两类图集分页 → 像素/动画/备用排除检查 → 台账与运行/备用预览 → Laya 运行白名单。所有素材必须显式声明 runtime，缺少声明或动画引用备用帧会中止构建。配方不引用生成后的图集坐标，重新排图不会丢失制作依据。

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

本轮 UI 复用已有图标与九宫格，PNG 页未增加。男女照料均原生朝右，表现按孩子位置镜像；婴儿固定篝火育儿位，对应映射已回写源配方和 animations。

完整包体以微信导出目录报告为准；开发者工具运行不等同手机真机验收，目录原始字节不等同微信上传统计。已有 icon.png 和旧源母版均保留。

## 好友榜奖杯与复用表现

新增 [奖杯母版](source/static/ranking_trophy_v1.png) 和 [完整提示词](source/ranking_trophy_v1_prompt.txt)，生成记录含原路径、尺寸和 SHA-256；`asset_recipe.json` 明确裁切与 48×48 输出，图集照常裁透明边。新增奖杯没有引入新的动画组，完整运行资源仅增加 4,057 字节。

成家红心从 30 调为 52 逻辑像素；精英村民使用现有人物帧整体缩放 1.25 倍，保留原足底。不要为两种表现复制人物帧或改写图集。规则与微信 Layout 来源见 [技术文档 10](../doc/tech/10_好友榜与精英村民.md)。

好友榜入口修订为首波成功后显示，继续复用现有奖杯原图与图集；删除面板额外按钮、扩大列表均为代码布局调整，无需新增或改写图片资源。

## 原创循环音乐与复现

《篝火边》为原创音符谱与加法合成，没有第三方采样。成品 24 秒、单声道、22,050 Hz、32 kbps MP3，音量由游戏设为 0.3，正常速度循环，不随 3 倍速加速。

- [音符谱](source/audio/village_loop.score.json)：80 BPM、8 小节、旋律/和弦/低音及音色参数。
- [合成与编码工具](tools/build-audio.py)：Python 标准库合成，ffmpeg/libmp3lame 压缩，循环尾音回卷。
- [音频台账](audio/manifest.json)：输入/输出 SHA-256、峰值、循环边界差、时长及真机试听状态。
- 母版 WAV 在 Downloads 的 `daidai-growth-20261111/audio/`，不进源码和微信包，可由音符谱重建。

```bash
python3 /Users/happyelements/Documents/pro/res/tools/build-audio.py \
  --work /Users/happyelements/Downloads/daidai-growth-20261111/audio --sync
node /Users/happyelements/Documents/pro/res/tools/build-resources.mjs \
  --work /Users/happyelements/Downloads/daidai-growth-20261111/resource-build --sync
```

先生成音乐，再构建资源台账与白名单。工具会同步 MP3 到 Laya 资源目录；发布包只接收成品，不复制谱、母版、manifest 或脚本。开发者工具已读出 duration=24、paused=false 和持续推进的 currentTime；手机听感、iOS 静音开关与实际通话打断尚未验证。


## 花果与建筑部件源

本轮母版：[village_parts_v11.png](source/static/village_parts_v11.png)，提示词：[生成说明](source/static/village_parts_v11.prompt.txt)，记录：[generation.json](source/static/village_parts_v11.generation.json)。四张花果位于 `runtime/decorations/parts/`，十二张部件位于 `runtime/buildings/parts/`；小图尺寸24～72像素，无新图集页。

花果挂在树自身局部节点，跟随树足底排序，不能置于全局特效层。建筑部件定义见 `BuildingVisuals.ts`，使用128基准坐标后按宿主宽度等比映射；不改变人物导航与炮塔射口。图文图标继续复用既有素材；资源栏/底部按钮的图标44逻辑像素、图文间距6逻辑像素，共同按实际文字宽度居中，面板中头像和建设图标适当放大。

音频源位于 `source/audio/*.score.json`，运行文件在 `audio/`。运行 `python3 res/tools/build-audio.py --work <Downloads目录> --sync` 后再构建美术资源。音频清单以 `tracks` 列出三轨；`bytes`为三轨总字节。图集构建与微信包检查均逐一核对这三轨，不能再按单个音频对象读取。
