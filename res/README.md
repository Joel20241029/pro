# 代代守村 · 高清二维资源与制作工程

当前方案为高清预渲染二维：运行时只有二维图片、序列帧与Laya部件动画，不加载实时3D模型，全部粒子已移除。全局UI采用已确认的“明亮田园”，详见 [设计与实施范围](../doc/tech/32_高清预渲染二维美术重制.md)。下方历史记录不代表当前发布配置。

## 当前目录

| 目录 | 放什么、怎样使用 | 进入微信包 |
| --- | --- | --- |
| `design/hd2d/` | 造型确认稿、四向渲染、环境设计；08号图为全局UI标准 | 否 |
| `source/rendered2d/` | 角色模型/绑定/动作、原始生成稿、裁切配方、正式派生图 | 仅派生图打图集 |
| `editor/BuildingWorkshop/` | Laya 3.4.2原始工程：七种建筑各一个prefab，十种怪物各一个prefab | 否 |
| `runtime/`、`atlases/` | 分类散图与制作总图集，便于检查裁边与内容 | 否，不重复发布 |
| `native/` | 从已保存原生prefab转换的108建筑布局、怪物挂点、两段建筑时间轴 | 按白名单 |
| `bundles/base/` | 高清UI、草地/道路/环境、基础音频 | 主包 |
| `bundles/buildings/` | 建筑图片、108布局、升级/攻击时间轴 | 建筑分包 |
| `bundles/characters/` | 四类村民四向八帧、独立站姿、成人劳动、婴儿/老人休息、红心表情 | 人物分包 |
| `bundles/battle/` | 五类小怪、五类首领、配件、普通弹道、战斗音乐 | 战斗分包 |
| `preview/` | 由当前配方生成的预览，实际IDE验证另存Downloads | 否 |
| `archive/`、`source/3d/` | 历史像素资源、四帧步态、实时3D试验；只供追溯 | 否 |

先显示基础加载界面，建筑包完整后显示村庄，再准备人物；守夜前加载战斗包。失败保留手动重试。程序不混用旧资源或缺失动作替代品。

## 重建与迭代

1. 修改 `source/rendered2d/production-sources.mjs` 指向的原始稿，或角色 `rig-profile.json` 和可编辑Blender源；重新离线渲染，运行足底/朝向检查。
2. 运行 `node res/tools/hd2d/prepare-production.mjs --work <Downloads内目录>`，审查派生图及 `production_recipe.json`，再同步为 `source/asset_recipe.json`。
3. 建筑/怪物贴图或布局改变时用 `prepare-native-prefabs.mjs` 同步贴图和种子；它不写prefab或覆盖UUID。需要重做布局时，在Laya执行 `工具 / BuildHd2dProduction`。日常小改直接编辑对应原生prefab。
4. 运行 `node res/tools/build-resources.mjs --work <Downloads内目录> --sync`，透明裁边、外扩、校验后按白名单同步正式工程。
5. 构建微信目录 `tryVersion/wxgame`，运行包体检查及实际微信IDE验收。构建成功不能代替手机实测。

图片保持平滑采样与抗锯齿。八帧行走按实际路程保持相位；停止使用独立双脚落地帧。老人采用短步、固定握杖，孩子和老人不区分男女外观。UI按可见裁框居中，奶油金边卡片和绿色底板分层，按钮/图标/文字共同按压。

`manifest.json` 是当前白名单，`budget_report.json` 是资源字节，`validation_report.json` 是图集验证；最终微信包体以导出目录检查报告为准。所有临时渲染/日志/IDE截图在 `~/Downloads/daidai-hd2d-full-20261113/`。

## 历史记录：1.0.13 及之前的像素管线

以下尺寸、帧数、图集页数、字节和验证结论均为对应版本快照。二维制作方式重新采用，但本轮保留高清矢量 UI，最终资源数量、包体和验证结果仍须重新构建后确认。

历史日期：2026-11-13。当时为配置 13、表现版本 1.0.13：七类建筑、十类怪物和六种粒子采用独立原生预制体，资源分主包、人物包和守夜包。请从下表进入对应目录，日常制作不要直接修改图集。

### 历史目录索引

| 目录 | 存放什么 | 怎样使用 | 进入微信包 |
| --- | --- | --- | --- |
| `design/` | 已确认的造型稿与设计提示词 | 审查风格、轮廓和升级差异 | 否 |
| `reference/` | 原始村落效果图 | 对照整体色彩、视角和布局 | 否 |
| `editor/BuildingWorkshop/` | 可独立打开的 Laya 原始工程 | 编辑建筑、怪物与原生 2D 粒子，保留部件、帧、挂点、范围和发射参数 | 否 |
| `source/` | 原始母版、配方、提示词、生成台账与归档 | 生产图片的可追溯输入 | 否 |
| `runtime/` | 按配方生成的分类散图 | 检查裁切和完整源画布 | 否，不与图集重复导入 |
| `atlases/` | 五页图集与制作侧总帧索引 | 裁边审计；正式发布见 bundles | 否，不重复发布 |
| `bundles/` | base、characters、battle 按包成品 | 各自图集、帧/动画表及专属资源 | 按白名单 |
| `native/` | 从编辑器源转换的建筑、怪物、粒子数据及共享 .mc | 运行时仅实例化当前等级 | 是 |
| `audio/` | 三轨紧凑音频及音频台账 | 白天、夜战和点击音效 | 是 |
| `branding/` | 平台上传图标及原图 | 用于微信后台素材上传 | 否 |
| `preview/` | 动作预览、运行/备用总览、建筑实绘 | 美术与研发验收 | 否 |
| `tools/` | 可重复执行的制作与转换脚本 | 从源文件重建，不反向修改成品 | 否 |

根目录 `manifest.json` 是运行白名单和每项素材台账；`budget_report.json` 是最新资源字节统计；`validation_report.json` 记录图集、裁边、动画检查；`animations.json` 是人物和敌人的序列帧配置。

### 历史建筑做法

每种建筑一个原生预制体：`HOUSE.lh`、`FARM.lh`、`LOGGING.lh`、`GATE.lh`、`ARROW.lh`、`STONE.lh`、`SLOW.lh`。共108种等级/房间组合，运行时只创建当前变体。全项目角色共37组2～4帧动画，其中怪物10组各4帧；本轮建筑使用原生部件时间轴动画，不将部件动画误称为网格蒙皮骨骼。

1～12级逐级改变结构。更高等级在9～12级的高级结构组合中循环并显示精确等级，范围与节点数不会随无限游玩持续膨胀。民居的修缮与房数分别影响层高/屋顶和侧屋/上层房间。

每个变体包含 `VisualBounds`、`Footprint`、`SortOrigin`；防塔另有 `Weapon/Muzzle`。农田的水车使用独立遮挡组与底座，田畦仍可行走。详见 [建筑实施记录](../doc/tech/23_Laya编辑器建筑部件与升级动画.md)。

2026-11-12 比例与塔位调整：两栋民居显示宽度由 116/106 放大至 140/128，沿用原生预制体，以原足底定位并同步扩大导航底座。参数位于 `VillageScene.VILLAGE_PROPS`；第 3/4 塔的唯一坐标源 `GameConfig.PADS` 改为 `(300,535)` / `(455,650)`。图集、母版与原生动画无需重建；设计稿及实际场景检查分类保存在 [compact-header](preview/compact-header/README.md)。

### 历史构建与验证

```bash
node res/tools/build-resources.mjs \
  --work /Users/happyelements/Downloads/daidai-enemies-loading-20261112/art/packed \
  --sync
```

流程：母版+配方 → 分类散图 → 编辑器引用贴图同步 → 透明裁边图集；七个原生 .lh → 严格属性校验 → 紧凑布局。两个 .mc 使用原生二进制原样复制。原生源工程的搭建命令见 [工程说明](editor/BuildingWorkshop/README.md)。

只发布 `manifest.runtimeWhitelist`，不递归复制整个 res。当时 295 张源画布，264 张运行素材、31 张备用素材，37 组人物/敌人动画、128 张动画帧、5 页图集。弃用的 10 张旧升级挂饰、旧抛石机关及旧屏中 Tip 底板已退出运行图集，原始素材保留。

图集仅裁 alpha=0 外圈，frames.json 恢复源画布偏移和脚底；九宫格保持完整尺寸。建筑母版的分格裁片额外使用显式主体矩形，避免邻格碎片进入部件；这个制作裁切与运行图集透明裁边是两个步骤。

当时资源白名单共 18 个文件，合计 2,146,685 字节。微信导出主包 2,590,578 字节，人物包 620,031 字节，守夜包 609,615 字节，总计 3,820,224 字节。这是目录原始字节，不是上传压缩统计。主场景先显示再准备人物，点击守夜才准备战斗资源，失败可主动重试。详见 [技术记录28](../doc/tech/28_组合怪物与分阶段资源加载.md)。

建筑点击气泡：点击左侧民房显示“佟楼”，右侧显示“南楼”，以指角尖端为原点展开、收起，总计 2 秒。新增 `22×22` 九宫格主体与 `20×14` 指角，仍合入现有 UI 图集；制作源及完整提示词在 [source/ui/anchored-tip](source/ui/anchored-tip/README.md)，确认稿、实际渲染和检查报告在 [preview/anchored-tip](preview/anchored-tip/README.md)，实现见 [技术文档 26](../doc/tech/26_建筑点击气泡.md)。

屏中 Tip 已共用该米黄主体九宫格，不带指角，正文为棕橙色 `#9a591f`，保留两秒淡入淡出。旧 `panel_tip` 只保留源素材，退出发布图集，资源白名单减少 2,093 字节。地图村民点击详情不增加图片资源，最新 Tip 及各类人物详情实绘和检查报告见 [villager-interaction](preview/villager-interaction/README.md)，实现见 [技术文档 27](../doc/tech/27_地图村民详情与共享Tip.md)。

排行入口图文间距已调整，奖杯大小保留，“排行”与奖杯、底框分开留白；仅修改布局参数，原图和图集不变。最新长短屏实绘见 [ranking-entry](preview/ranking-entry/README.md)。

村名与道路路牌：母版与提示词在 `source/decorations/`，共同使用 88×52 底图和独立中文；“文明里村”显示宽 140，“友谊路”显示宽 120，均为设计像素。文字与位置配置在 `VillageSceneConfig.VILLAGE_PROPS`，与牌体共用遮挡。复用底图不增加运行素材，不新增图集内容。村名牌首次实绘见 [village-sign](preview/village-sign/README.md)，最新双路牌实绘见 [compact-header](preview/compact-header/README.md)，规则见 [技术记录24](../doc/tech/24_精英姓名与文明里村路牌.md)。

村内花果：原伐木树复用两簇红果，两个角落各增加一棵 84/86 宽的树，分别带一簇约 10 像素的浅色花和黄果。树木参照原伐木树 90 宽修正了与成年村民的比例，花果保持小点缀。树与花果全部复用现有运行素材，不增位图；相对挂点、大小和透明度记录在 `VillageSceneConfig.VILLAGE_PROPS.canopyDetails`，花果与树一起遮挡。具体参数见 [场景交付记录](../doc/tech/22_场景音频与图文排版交付.md)，最新实绘继续归档到 [compact-header](preview/compact-header/README.md)。

村内松树：在两棵花果圆树之外，再复用 `deco_tree_pine` 放置两棵 88 宽的松树，分别位于左下草地和右上农田外侧，与圆树错位。树形略高，保留中央活动区。只调整场景配置，不新增素材或图集页。

### 历史组合怪物

5 小怪与 5 首领，原色细节＋中性身体着色＋兼容头/背饰，最多 4 个绘制层。外观种子随波次保存，重进不重抽，也不影响家庭随机。每 12 夜一名首领，前五场依次展示五种底型。原始来源见 [source/enemies](source/enemies/README.md)，编辑入口见 [enemyAuthoring](editor/BuildingWorkshop/assets/enemyAuthoring/README.md)，实际组合效果见 [preview/enemies](preview/enemies/README.md)。


### 历史粒子制作

1.0.13 保留 6 种 Laya 原生 2D 粒子：4 种命中、精英脚底圈、鲜红色大王之心边缘环绕；攻击拖尾与建筑升级粒子已移除。怪物红闪、伐木树摆和建筑原有升级动作保留。粒子复用内置白纹理，不增加图集页。源与编辑说明见 [particleAuthoring](editor/BuildingWorkshop/assets/particleAuthoring/README.md)，正式实绘见 [preview/particles](preview/particles/README.md)。

`particles.json` 跟随 base、characters、battle 的既有准备与失败重试。当时运行素材白名单 21 个文件，共 2,194,813 字节；完整微信导出还包含代码和引擎，不能用素材数冒充包体。
