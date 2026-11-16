# 守夜三按钮制作源

本目录保存 1.0.16 守夜底栏的已确认设计和正式制作源。母图与设计稿不进入微信包。

| 文件 | 用途 |
| --- | --- |
| `approved-design.png` | 用户确认的三按钮布局、配色、字号关系和技能三态 |
| `gold-button-and-heart.png` | 透明母图：左为无字暖金圆钮，右为独立红心与金冠 |
| `generation.json` | 生成工具、参考图、提示词摘要与发布尺寸 |

导入入口为 [prepare-production.mjs](../../../tools/hd2d/prepare-production.mjs)。输出 `button_heart_round`（384×384）和 `icon_crowned_heart`（128×128），均归属 `base`。圆钮保持完整方形画布、等比绘制，不使用九宫格。文字由 Laya 渲染，不烘焙到图片中。

两侧卡片复用现有奶油皮肤，暂停、继续、倍速沿用原生矢量；深色暂停与继续图标和倍速使用同一木棕色。灰态通过 Laya `ColorFilter.gray()` 处理底图和冠心，文字保持清晰；倒计时环由 `Graphics.drawLines` 绘制，不增加状态图片或粒子。

重建流程：重新导入 → 同步 `source/rendered2d/production_recipe.json` 为 `source/asset_recipe.json` → 运行 `build-resources.mjs --work <Downloads目录> --sync` → 重新构建微信工程并检查主包。不要单独修改发布图集。

主包图集采用逐像素验证的无损 PNG 重编码。构建前按 [资源工具说明](../../../tools/README.md) 安装固定版本依赖；本资源仍保持 384/128 发布尺寸，不降低采样或颜色精度。

表现入口为 `project/LayaProject/src/view/NightControls.ts`，尺寸和颜色参数见 `view/config/HudConfig.ts`；路径相对仓库根目录。状态规则、验证和发布回执见 [37 守夜三按钮与 1.0.16](../../../../doc/tech/37_守夜三按钮与1.0.16.md)。
