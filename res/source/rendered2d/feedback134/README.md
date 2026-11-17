# 命中序列与村务图标

- `fx_impact_arrow_1.png` 至 `fx_impact_arrow_5.png` 为箭尖接触的暖金尖星和短火星。
- `fx_impact_stone_1.png` 至 `fx_impact_stone_5.png` 为石块散碎和土尘。
- `fx_impact_slow_1.png` 至 `fx_impact_slow_5.png` 为寒塔的碎冰和霜环。
- `icon_baby_cry.png` 为床中婴儿的世界提示。`tag_recommended.png` 和 `tag_favorite.png` 为含「推荐」或「已珍藏」字形的按钮图片。

可编辑的颜色、轨迹、关键帧和叠层保存在 [Pillow 绘制脚本](../../../tools/hd2d/render-night-feedback.py)。运行脚本时将输出目录作为首个参数。命中序列统一使用 80×80 透明画布，接触点位于（40，40），随后通过正式配方裁透明边并导入战斗分包。角色哭脸在人物分包，标签在基础包。共 18 张 PNG，源文件合计 60,079 字节。
