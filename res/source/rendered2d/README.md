# 高清二维制作源

此目录保留完整可迭代输入，游戏只发布派生二维图集，不发布模型。

| 目录/文件 | 内容 |
| --- | --- |
| `characters/{male,female,child,elder}/` | 各自实测骨骼参数、原模型、walk_probe.blend、足底检查，四向八帧和中立站姿在design/hd2d/directions；成人劳动另在labor |
| `characters/baby/` | 中性婴儿躺卧呼吸，无行走 |
| `environment/` | 火堆离线动画及可编辑制作源 |
| `generated/` | 建筑、怪物、UI等原始生成图；bright_skins为正式全局UI母版，旧skins保留历史 |
| `production-sources.mjs` | 明确选择与裁框、主体档位、UI切边及母图到逻辑尺寸比例 |
| `runtime-texture-sizes.mjs` | 发布纹理的分类尺寸与独立头像名单；只缩派生画布，保留高清母版和场景显示尺寸 |
| `production_recipe.json` | 导入产物，记录源/输出哈希、画布、脚底、帧数、步幅及分包 |
| `production/` | 分类派生图，不能当作唯一制作源 |
| `native-layout-seeds.json` | Laya明确重制时的初始布局；日常以已保存prefab为准 |
| `enemy-layouts.mjs` | 10 类怪物逐帧身体补偿、头肩挂点、配饰矩形与前后关系；经 Laya 怪物专用菜单保存后才导出 |

真实模型离线渲染与AI静态图分别记录来源，不把全部AI图片称作实际三维模型输出。四类村民统一画质和转向标准；孩子、老人共享中性外观，不改变存档性别。老人使用较短步幅，脚底和杖尖独立校验。步态是否自然仍须看连续回放和实际游戏，不只看校验哈希。

发布纹理于 2026-11-13 按最大显示尺寸重算，目标覆盖 720 逻辑宽对应 1440 物理宽，包含精英体型与建筑升级缩放，再留 5% 余量。完整画布缩放时同步脚底、裁框与步幅，不逐帧重新适配主体；五类静态头像保留原分辨率。大建筑主体、UI 和地图本次不降尺寸。修改场景最大显示尺寸时必须重查 `runtime-texture-sizes.mjs`，依据与验收见 [纹理尺寸与包体优化](../../../doc/tech/33_纹理尺寸与包体优化.md)。

整体UI（HUD、导航、所有面板、Tips和排行榜外框）遵循08号明亮田园稿，按下时图文共同移动。九宫格只改变背景坐标，不缩放正文。详见 [技术文档32](../../../doc/tech/32_高清预渲染二维美术重制.md)。

农田于 2026-11-13 更新为四种作物：后左麦子、后右卷心菜、前左番茄、前右胡萝卜。正式母版为 `generated/buildings/farms_mixed_crops.png`，同名 `.prompt.json` 保存图像编辑工具、参考和完整提示词；旧 `farms_ground.png` 保留作溯源。四列对应既有四档结构，尺寸、脚底、工位、水车和产粮规则不变。修改后仍由 `prepare-production.mjs` 导入四张底图，再按 `res/README.md` 同步配方与构建；不要直接覆盖运行图集或只改编辑器缓存。

草地于 2026-11-13 增强短草叶、根部阴影与疏密层次，正式母版为 `generated/environment/grass_ground_textured.png`，同名 `.prompt.json` 保存参考与完整编辑提示词。`prepare-production.mjs` 导入为既有 `tile_ground_grass`，仍用 512×512 平铺，不新增草丛节点或贴图 ID；`design/hd2d/samples/grass_ground_v2.png` 及历史试验场景保留旧稿。路边石头的尺寸/翻转在 `WorldArtConfig.WORLD_ART.rocks`，林带树尺寸在 `VillageSceneConfig.VILLAGE_PROPS`，均不需要增画图片。

门口横向土路母版为 `generated/environment/gate_lane.png`，同名 `.prompt.json` 保存完整提示词、裁框与透明噪点阈值。参考为 `res/reference/gate_lane_reference.png` 与原有弯路材质；导入为 base 包的 `map_gate_lane`（512×48），由 `WorldArtConfig.WORLD_ART.gateLane` 定位到墙脚，在地面层绘制。路面边缘与草丛已包含在这一张透明图中，不增加路边装饰节点；城外弯路和逻辑路线维持原样。


## 1.0.15 体型与接地调整

怪物场景尺寸增加 12.5%，发布采样同步为小怪 160、一般首领 224、兽王 240；鹿角/羽饰 80，旗帜/叶饰 128。配置在 `runtime-texture-sizes.mjs`，均从保留的高清母版重新导入，原生编辑器引用贴图、配方与正式四包同时更新。仍为 11 页图集，没有新增素材种类。怪物的稳定接地位置和宽度由正式工程 `EnemyVisualConfig` 管理，不修改共同足底或逐帧拉伸。具体记录见 [本轮技术文档](../../../doc/tech/35_操作排序与战斗表现调整.md)。

## 1.0.17 逐帧配饰校准

只调整明确有误的身体配准与配饰，不改上述贴图采样、行走帧数或世界尺寸。野猪两帧 Body 分别补偿 -7/+7 个 96 画布单位，阴影及世界脚点保持稳定；每类、每帧的可选配饰拥有独立矩形，披肩不覆盖武器与手臂。修改 `enemy-layouts.mjs` 后必须通过“工具 / RefineHdEnemyAttachments”保存原生 prefab，再构建四包。不要全量重建已调好的建筑。详见 [技术文档 38](../../../doc/tech/38_怪物移动与配饰校准.md)。

## 1.0.18 放大与道路通行

小怪在 1.0.17 基础上放大 15%、五种 Boss 放大 25%，派生采样同步提高到小怪 176／192、Boss 272／288，配饰按每帧实际矩形重算，叶饰为 272。`prepare-production.mjs` 从原始高清生成稿直接按新画布规范化，保留同组裁框和足点比例，不能放大旧 production 小图；原始稿不改。原生 prefab 布局及 UUID 不变，引用贴图、配方和四包同步更新。

道路 PNG 不改。`res/tools/hd2d/extract-road-corridor.mjs` 从当前 `production/terrain/map_road.png` 的连续土路提取左右边缘，输出正式工程 `RoadGeometry.ts` 和源哈希；新的道路分散行走与索敌共用这份范围。换路图后必须重跑提取及边界回归。尺寸、接地和道路实现见 [技术文档 39](../../../doc/tech/39_怪物接地与道路分散行走.md)。

## 1.0.25 动画内独立接地影

`enemy-layouts.mjs` 统一记录阴影纹理、实测 Alpha 中心和各怪物宽度；`prepare-native-prefabs.mjs` 将 ContactShadow 放在每个怪物根节点的最底层。Laya 原生保存后输出版本4布局，运行把阴影和身体绘在同一变换下，移除地图层的怪物独立阴影池。身体母稿、帧数、采样和建筑 prefab 均保留。只调挂点不需要重跑 prepare-production，避免重采样原图。

## 1.0.37 木材图标

木材图标由 UI 母图的第二格导入。成图阶段裁掉右边三列并补回透明画布，去除与木堆分离的杂点，保留主体的可见像素、原画布和挂点。
