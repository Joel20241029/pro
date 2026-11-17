# 矮身 Q 版村民

`approved-proportions.png` 为本版确认稿。全员统一大头、矮身比例。成年女性改穿裤装，胖男取消草帽，精英取消披风。通过不同发色、短发轮廓、发饰和服装区分角色。头像、站姿与各动作统一使用角色原始材质和压暗前的布光。

## 源文件

- 各角色目录包含独立参考裁图、原始 GLB 模型、可编辑 Blender 工程、透明 PNG 母片和测量报告。
- `renders.json` 保存各动作的帧序列、脚底锚点、画布倍率和落刃帧。八类可移动角色均有八向站姿与六帧步态。六类成人的横劈为五帧，种田、照料和挥剑各四帧。摇篮婴儿使用固定足点和四拍呼吸循环。
- `rig-landmarks.json` 保存每位角色的关节标定。各目录的 `rig-profile.json` 与行走报告保存生成所用的绑骨参数、步幅和足点。
- `labor-poses.json` 保存动作姿势和工具安装角度。劳动报告记录落刃帧、刃口坐标、持握和相交检查。
- `authoring/` 保存动作渲染与摇篮呼吸脚本，以及从标定生成绑定模板的脚本。生成绑定模板时，使用 Downloads 下的制作区，让脚本同级保留 `rig-landmarks.json` 和 `models/`。走路绑定和八向相机复用 `res/tools/hd2d/bind-walk-character.py` 与相邻 `v3/authoring/render-eight-directions.py`。

## 接入

用 `res/tools/hd2d/prepare-production.mjs` 导入母片，将制作配方同步为 `res/source/asset_recipe.json`，再用 `res/tools/build-resources.mjs --sync` 生成图集。两个工具的 `--work` 均使用 Downloads 下的制作目录。头像、行走和劳动随进村资源下载，挥剑随守夜资源下载。

现有内部身份键继续使用。黄色胖男仍用 `straw` 键，以对应现有角色选择和动画索引。
