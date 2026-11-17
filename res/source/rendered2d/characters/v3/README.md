# 第三版村民美术

造型以 `approved-v3.png` 为准。四种普通成年村民、两种精英、儿童和老人分别制作八个朝向。儿童、老人和摇篮里的婴儿各共用一套造型。游戏按已有村民编号、年龄和精英身份选择角色，生产数值和人员资格沿用现行规则。

## 资源结构

- `renders.json` 记录每组动作采用的帧、播放速率、足点和落斧帧。
- 每个角色目录中的 `.glb` 是原始模型，`.blend` 是 Blender 制作工程。`walk/`、`labor/` 和 `baby/rest/` 保存透明母片。
- `rig-profile.json` 保存角色骨骼、权重范围和足底行程。`direction-report.json`、`chop-report.json` 与 `farm-care-report.json` 保存各向关节和工具检查数据。
- `authoring/` 保存离线渲染脚本，`labor-poses.json` 保存动作参数。游戏加载发布后的二维图集。

## 帧与光照

行走每向六帧，左右脚各有落脚、抬脚和经过三个阶段。按实际显示尺寸比较四帧和六帧时，八类角色用六帧的相邻画面最大差均下降。横劈保留五帧，种田、照料和一次性挥剑各用四帧。婴儿用三张图组成四步呼吸循环。

镜头和照明固定，转动角色与工具。劳动动作扩充画布容纳工具外缘，绘制缩放抵消扩大后的取景。用相同足点切换动作，影子仍跟随地面坐标。落刃帧驱动树干回弹，锄头落点按同一地面求解。

## 重建

先运行 `res/tools/hd2d/prepare-production.mjs --work <Downloads 内目录>`，再把导入产生的 `production_recipe.json` 同步到 `res/source/asset_recipe.json`。通过 `res/tools/build-resources.mjs --work <Downloads 内目录> --sync` 生成图集。村庄阶段载入头像、行走与劳动，守夜阶段按现有流程下载挥剑资源。
