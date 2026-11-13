# 原始资源和制作依据

asset_recipe.json定义每项资源的源图、裁切、尺寸、pivot、九宫格和runtime状态；generation_records.json保存来源与哈希。animations/static/buildings/emotes分别存人物动作、静态母版、建筑拆件和表情；audio存音频制作源；concepts存早期设计；archive保留已弃用素材。各版本prompts文件是对应母版的完整提示词，按版本追溯，不直接进入游戏。

[ui/](ui/README.md) 保存新增界面组件母版与提示词，目前包含建筑点击气泡。对应的确认稿和实际游戏截图分类保存在 `../preview/anchored-tip/`。

[enemies/](enemies/README.md) 保存新增怪物和配件原图、配准输入及制作规格；每项资源在 asset_recipe.json 明确 bundle 归属。
