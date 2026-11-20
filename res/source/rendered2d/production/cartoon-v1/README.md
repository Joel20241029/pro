# 卡通美术重制

`approved-concept.png` 记录村庄环境和界面的卡通方向。`masters/simple/style-approved.png` 记录人物与怪物的简线方向。角色继续按 1.0.88 已有的发型、衣着、种族、武器和朝向绘制。

| 位置 | 内容 |
| --- | --- |
| `masters/simple/` | 简线角色母图，含七种四向村民、老人、幼儿、三种巡防、十种怪物、配饰及启动画。 |
| `masters/` | 村庄建筑、地图装饰、图标的母图，以及上一稿的历史母图 |
| `registration.json` | 上一版逻辑画布内的素材裁框坐标，用于保留显示范围和脚点 |
| `frames/` | 渲染后的 571 张正式 PNG 输入，统一由资源配方打入图集 |
| `render-report.json` | 每张正式帧的画布、母版路径与 SHA-256 |

运行 `python3 res/tools/hd2d/render-cartoon.py` 生成正式帧、更新配方及启动与分享素材。加 `--actors-only` 可只更新角色、角色相关图标和特效。行走由 `cartoon_gait.py` 依据髋、肩和足部的支撑、摆动阶段离线生成。村民用对侧摆臂，四足怪用错开的前后足落点。每组动作共用固定的躯干位置、画面尺度与地面锚点。怪物使用 `masters/simple/enemies-front.png`，腿部标记以这一页的像素位置为准。建筑局部动画继续按部件生成，地形按 `RoadGeometry.ts` 的走廊绘制并逐行验证。

`motion-quality.json` 保存视觉步距和命中特效贴图尺寸。攻击形状以三倍源尺寸绘制后下采样，微信战斗特效页单独采用 4×4 ASTC。尺寸配置只影响源纹理，播放时长、点击范围和战斗数值由运行时现有规则决定。

步态参考 [Animation Mentor 人形行走教程](https://www.animationmentor.com/blog/tutorial-animating-human-walk-cycle/) 和 [明尼苏达大学兽医学院四足动物步态](https://vanat.ahc.umn.edu/gaits/index.html)。

之后运行 `node res/tools/build-resources.mjs --work <Downloads内任务目录> --sync`。图集保留精灵 ID、帧序、画布和九宫格数据。历史制作源留在原目录。
