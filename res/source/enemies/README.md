# 怪物原始母版

这里是本轮新增 5 套底型和 6 个共享配件的制作源，不进入微信包。原有 5 套底型继续从 `../animations/` 的母版取帧，全部统一拆成身体染色层与原色细节层。

| 文件 | 用途 |
| --- | --- |
| woodland_bases_v1.png | image_gen 原图，1122×1402，5 行×4 帧；依次为野猪、铁甲统领、疾风狼王、獠牙兽王、山魈长老 |
| accessories_v1.png | image_gen 生成并编辑后的透明配件原图，1536×1024；头带、鹿角、羽饰、背旗、叶饰、面具 |
| prepared/ | 同行统一缩放、单元格中心对齐、脚底配准后的 96×96 制作输入；不是手绘母版 |
| production-brief.md | 可继续生成与调整的制作要求；来源哈希见上层 generation_records.json |

运行配方在 `../asset_recipe.json`，原生预制体在 `../../editor/BuildingWorkshop/assets/enemyAuthoring/prefabs/`。不得直接覆盖图集后丢弃母版。

重建顺序：执行 `node res/tools/prepare-enemy-sources.mjs`，必要时在 Laya 中编辑并保存对应 .lh，再执行 `build-resources.mjs --work <Downloads内目录> --sync`。母版采用显式 alpha≥240 导入以剔除半透明光晕；运行图集只裁掉完全透明外圈，两个步骤不同。
