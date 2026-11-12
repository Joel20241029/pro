# 代代守村 · 资源与编辑器源工程

日期：2026-11-12。当前建筑已按确认的设计稿完成原生 Laya 拼装。请从下表进入对应目录，日常制作不要直接修改图集。

## 目录索引

| 目录 | 存放什么 | 怎样使用 | 进入微信包 |
| --- | --- | --- | --- |
| `design/` | 已确认的造型稿与设计提示词 | 审查风格、轮廓和升级差异 | 否 |
| `reference/` | 原始村落效果图 | 对照整体色彩、视角和布局 | 否 |
| `editor/BuildingWorkshop/` | 可独立打开的 Laya 原始工程 | 编辑七种建筑的部件、范围和原生动画 | 否 |
| `source/` | 原始母版、配方、提示词、生成台账与归档 | 生产图片的可追溯输入 | 否 |
| `runtime/` | 按配方生成的分类散图 | 检查裁切和完整源画布 | 否，不与图集重复导入 |
| `atlases/` | 两页图集及 frames.json | 微信实际加载的图片与裁边信息 | 是 |
| `native/` | 从编辑器源转换的建筑布局及共享 .mc | 运行时仅实例化当前等级 | 是 |
| `audio/` | 三轨紧凑音频及音频台账 | 白天、夜战和点击音效 | 是 |
| `branding/` | 平台上传图标及原图 | 用于微信后台素材上传 | 否 |
| `preview/` | 动作预览、运行/备用总览、建筑实绘 | 美术与研发验收 | 否 |
| `tools/` | 可重复执行的制作与转换脚本 | 从源文件重建，不反向修改成品 | 否 |

根目录 `manifest.json` 是运行白名单和每项素材台账；`budget_report.json` 是最新资源字节统计；`validation_report.json` 记录图集、裁边、动画检查；`animations.json` 是人物和敌人的序列帧配置。

## 当前建筑做法

每种建筑一个原生预制体：`HOUSE.lh`、`FARM.lh`、`LOGGING.lh`、`GATE.lh`、`ARROW.lh`、`STONE.lh`、`SLOW.lh`。共108种等级/房间组合，运行时只创建当前变体。人物仍使用32组2～4帧动画；本轮建筑使用原生部件时间轴动画，不将部件动画误称为网格蒙皮骨骼。

1～12级逐级改变结构。更高等级在9～12级的高级结构组合中循环并显示精确等级，范围与节点数不会随无限游玩持续膨胀。民居的修缮与房数分别影响层高/屋顶和侧屋/上层房间。

每个变体包含 `VisualBounds`、`Footprint`、`SortOrigin`；防塔另有 `Weapon/Muzzle`。农田的水车使用独立遮挡组与底座，田畦仍可行走。详见 [建筑实施记录](../doc/tech/23_Laya编辑器建筑部件与升级动画.md)。

2026-11-12 比例与塔位调整：两栋民居显示宽度由 116/106 放大至 140/128，沿用原生预制体，以原足底定位并同步扩大导航底座。参数位于 `VillageScene.VILLAGE_PROPS`；第 3/4 塔的唯一坐标源 `GameConfig.PADS` 改为 `(300,535)` / `(455,650)`。图集、母版与原生动画无需重建；设计稿及实际场景检查分类保存在 [compact-header](preview/compact-header/README.md)。

## 构建与验证

```bash
node res/tools/build-resources.mjs \
  --work /Users/happyelements/Downloads/daidai-building-editor-20261112/resource-build \
  --sync
```

流程：母版+配方 → 分类散图 → 编辑器引用贴图同步 → 透明裁边图集；七个原生 .lh → 严格属性校验 → 紧凑布局。两个 .mc 使用原生二进制原样复制。原生源工程的搭建命令见 [工程说明](editor/BuildingWorkshop/README.md)。

只发布 `manifest.runtimeWhitelist`，不递归复制整个 res。当前 229 张源画布，198 张运行素材、31 张备用素材，32 组人物/敌人动画、108 张动画帧、2 页图集。弃用的 10 张旧升级挂饰、旧抛石机关及旧屏中 Tip 底板已退出运行图集，原始素材保留。

图集仅裁 alpha=0 外圈，frames.json 恢复源画布偏移和脚底；九宫格保持完整尺寸。建筑母版的分格裁片额外使用显式主体矩形，避免邻格碎片进入部件；这个制作裁切与运行图集透明裁边是两个步骤。

当前资源白名单共 10 个文件，合计 1,824,832 字节。微信发布将 `.mc` 改名为 `.mc.bin`，内容哈希保持一致；发布器另生成分包 `game.js` 和 `fileconfig.json`。主包 1,651,834 字节，村庄分包 1,825,083 字节，总计 3,476,917 字节，这是导出目录原始字节，未包含平台上传压缩测量。

建筑点击气泡：点击左侧民房显示“佟楼”，右侧显示“南楼”，以指角尖端为原点展开、收起，总计 2 秒。新增 `22×22` 九宫格主体与 `20×14` 指角，仍合入现有 UI 图集；制作源及完整提示词在 [source/ui/anchored-tip](source/ui/anchored-tip/README.md)，确认稿、实际渲染和检查报告在 [preview/anchored-tip](preview/anchored-tip/README.md)，实现见 [技术文档 26](../doc/tech/26_建筑点击气泡.md)。

屏中 Tip 已共用该米黄主体九宫格，不带指角，正文为棕橙色 `#9a591f`，保留两秒淡入淡出。旧 `panel_tip` 只保留源素材，退出发布图集，资源白名单减少 2,093 字节。地图村民点击详情不增加图片资源，最新 Tip 及各类人物详情实绘和检查报告见 [villager-interaction](preview/villager-interaction/README.md)，实现见 [技术文档 27](../doc/tech/27_地图村民详情与共享Tip.md)。

排行入口图文间距已调整，奖杯大小保留，“排行”与奖杯、底框分开留白；仅修改布局参数，原图和图集不变。最新长短屏实绘见 [ranking-entry](preview/ranking-entry/README.md)。

村名与道路路牌：母版与提示词在 `source/decorations/`，共同使用 88×52 底图和独立中文；“文明里村”显示宽 140，“友谊路”显示宽 120，均为设计像素。文字与位置配置在 `VillageSceneConfig.VILLAGE_PROPS`，与牌体共用遮挡。复用底图不增加运行素材，仍为两页图集。村名牌首次实绘见 [village-sign](preview/village-sign/README.md)，最新双路牌实绘见 [compact-header](preview/compact-header/README.md)，规则见 [技术记录24](../doc/tech/24_精英姓名与文明里村路牌.md)。

村内花果：原伐木树复用两簇红果，两个角落各增加一棵 84/86 宽的树，分别带一簇约 10 像素的浅色花和黄果。树木参照原伐木树 90 宽修正了与成年村民的比例，花果保持小点缀。树与花果全部复用现有运行素材，不增位图；相对挂点、大小和透明度记录在 `VillageSceneConfig.VILLAGE_PROPS.canopyDetails`，花果与树一起遮挡。具体参数见 [场景交付记录](../doc/tech/22_场景音频与图文排版交付.md)，最新实绘继续归档到 [compact-header](preview/compact-header/README.md)。

村内松树：在两棵花果圆树之外，再复用 `deco_tree_pine` 放置两棵 88 宽的松树，分别位于左下草地和右上农田外侧，与圆树错位。树形略高，保留中央活动区。只调整场景配置，不新增素材或图集页。
