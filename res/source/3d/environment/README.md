# 村落真实 3D 环境制作源

本目录保存 Blender 4.5 制作源和导出统计。造型依据已确认的《代代守村》风格化 3D 效果图及防御塔升级设计稿；箭塔为木架弩台，石塔为圆石投石台，寒塔为木石凉亭。

## 文件与重建

- 每个 `.blend` 是独立、可编辑的原始工程，保留木梁、门窗、石块、屋檐等单个网格。
- `manifest.json` 记录每个 GLB 的字节数、节点数、三角数，以及真实顶点计算的 `bounds` / `levelBounds`；尺寸顺序为宽、高、深。四阶段三角数是分别显示时的成本，运行时不能同时显示四阶段。
- `../../../tools/3d/build-environment.py` 为入口，`env_buildings.py` 和 `env_props.py` 为建筑与环境配方。
- 导出目录为 `res/editor/BuildingWorkshop/assets/world3d/environment/`。原始 `.blend` 不随游戏发布。
- 临时渲染和日志统一在下载目录 `daidai-3d-implementation-20261113/environment/`。

```bash
/Users/happyelements/Downloads/daidai-3d-implementation-20261113/tools/Blender.app/Contents/MacOS/Blender \
  --background \
  --python /Users/happyelements/Documents/pro/res/tools/3d/build-environment.py \
  -- --render-dir /Users/happyelements/Downloads/daidai-3d-implementation-20261113/environment
```

添加 `--sample` 仅重建 ARROW、TREE_OAK 小样。整套重新构建会覆盖本轮所属的源模型和 GLB，因此对美术手工调整应先更新配方或另存工程。

`--props-only` 只渲染装饰组合，不覆盖模型。`--output-root <目录>` 可在独立目录构建候选，`--skip-renders` 跳过预览。执行 `python3 res/tools/3d/env_validate.py` 可只读检查 GLB 格式、四阶段、射口挂点、顶点/索引数据及对应源文件。当前 21 个 GLB 共 1,023,432 字节，实际每阶段三角数及渲染节点数见 `manifest.json`。

`env_compare.py <原目录> <候选目录>` 可按世界坐标逐三角、逐材质比较改造前后的表面。新增资产时显式传 `--allow-new`，工具会列出没有基线的新增项，其余模型仍严格比较。

## 坐标与接入约定

Blender 使用 Z 向上、正面朝 -Y；GLB 转换为 Y 向上、正面朝 +Z。地面原点为 `(0, 0, 0)`。基础建筑占地约 2 个模型单位，不对应游戏导航单位；接入时应按既有建筑预留区统一换算。高级民居有侧翼，不能依据模型外轮廓扩大寻路障碍。

七个建筑文件均只有一个类型根节点，其下包含 `Level1`、`Level4`、`Level8`、`Level12`。编辑器中四阶段默认重叠，检查时只显示其中一个；运行时也只激活当前所选阶段。具体等级到阶段的映射由游戏现有可视配置负责，本资源不定义升级价格或玩法上限。

Blender 对同名对象会添加数字后缀。每个语义空节点另存 `role` 自定义属性；导出后 GLB 恢复该属性对应的节点名，因此每个等级内均能通过相同的子路径访问。

| 文件 | 结构和独立控制点 |
| --- | --- |
| ARROW | `Level*/Body`、`Level*/Weapon`、`Level*/Weapon/Muzzle`；武器绕 Y 轴转向 |
| STONE | 上述塔结构，以及 `Weapon/ThrowArm`；投石臂可绕本地 X 轴运动 |
| SLOW | 上述塔结构，`Weapon` 中为晶石组 |
| HOUSE | `Body/DwellingModule`、高级侧翼和上层；`RoomSocket0/1` 是房间扩建挂点，人口房间数仍来自业务状态 |
| GATE | `Body/GateDoors` 包含门板、横梁和门环，原点不变；`HealthAnchor` 独立，立柱和屋顶不跟随受损倾斜 |
| FARM | `Ground` 与 `AboveGround` 分开；高级 `AboveGround/Waterwheel` 可绕本地 Y 轴旋转 |
| LOGGING | `Body`、`WorkSocket`；高级 `Body/SawBlade` 可单独转动 |

各阶段的 `SortOrigin` 表示稳定地面原点。`FootprintMin/Max` 仅为 1.6 × 1.4 基础单位的作者参考标记，不能作为碰撞或导航权威数据。真实 3D 遮挡交由统一 Scene3D 深度缓冲处理。

## 可复用环境部件

| 文件 | 用途 |
| --- | --- |
| TREE_OAK | 不规则圆叶团，源中保留 35 个叶簇；导出 Body 合为 5 个材质渲染节点，有 4 个 DecorationSocket 挂点 |
| TREE_PINE | 四层松树冠，导出为 3 个材质渲染节点，有 3 个 DecorationSocket 挂点 |
| FRUIT_APPLE / FLOWER | 独立苹果、花朵；可实例化在挂点上，花的默认法线朝上，树冠应用时需适当转向 |
| GRASS / ROCKS | 七叶草簇与三块小石，不含贴片透明纹理 |
| PAD | 中心空心的九石低环，专用于未建塔位，不复用 ROCKS 石堆 |
| LOG_PILE | 五根木头的堆放体，浅色端面，专用于木堆装饰，不复用 LOGGING 作坊 |
| BUSH | 三团低矮圆叶灌木，不复用尖叶 GRASS |
| WALL | 可拼木栅栏，带 AttachLeft / AttachRight 端点 |
| SIGN | 暖木村牌，TextAnchor 放置“文明里村”等运行时文字 |
| CAMPFIRE | 石圈、木柴与独立 Flame 根；时间驱动应复用游戏暂停及倍速规则 |
| TORCH | 柱式火把，真实火焰网格 |
| PATH | 两米参考路段，PathStart / PathEnd；实际道路曲线仍以 GameConfig.PATH 为唯一来源 |

## 体积与材质策略

所有材质为不带贴图的哑光 PBR 纯色材质。大木梁和石块使用一段倒角；细小装饰不增加倒角面。导出将网格平移到自身中心，并精确复用相同顶点、拓扑、平滑设置及材质的数据块；差异位置保存在节点变换中。纯色材质不使用 UV，因此导出移除 UV 流。共享仅使用核心 glTF 的网格引用，不依赖压缩扩展。

最初 18 类模型占 3,654,056 字节；现在包含新增石环、木堆、灌木的 21 类模型共 1,023,432 字节，旧模型的所有阶段三角数相同，轮廓保持一致。为减少原生预制体文本和运行时节点，整株麦苗、屋顶、窗框、箭塔栏杆、石塔石层等组合成可复用刚体模块。FARM 四阶段总节点由 764 降至 119，HOUSE 由 505 降至 166。

树草与建筑使用不同导出策略：静态树叶和草叶按材质合并整棵 Body，保留根与挂点，TREE_OAK 每棵 5 个渲染节点、TREE_PINE 为 3 个、GRASS 为 2 个。源 `.blend` 仍保留叶簇，只有导出合并。不能以包体减少推断运行时绘制次数也已减少；Laya 原生导出和微信场景统计仍需实测。

正式重建默认启用共享几何、刚体模块和静态树草合并。`--no-patch-modules`、`--no-assembly-patches`、`--no-static-foliage` 以及 `--compact` 仅用于历史诊断比较，不用于正式包。

木色按参考深木 `#9C5B2B`、亮梁 `#D99A4B` 转换为线性色值。示例图使用 Blender 灯光及 AgX，不能当作微信真机最终光照证明；Laya 导入、正交相机、阴影和性能仍需整合侧验证。
