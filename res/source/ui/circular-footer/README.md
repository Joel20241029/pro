# 圆形守夜按钮制作源

本目录保存用户确认的底部中央圆钮设计及正式素材，供后续美术迭代。母图与设计稿不进入发布包。

| 文件 | 用途 |
| --- | --- |
| `approved-design.png` | 已确认的布局、字号关系与配色效果图 |
| `round-button-and-shield.png` | 透明母图：左侧无字绿色金边圆钮，右侧独立月亮盾牌 |
| `generation.json` | 生成工具、提示词摘要、引用图与发布尺寸 |

导入入口为 [prepare-production.mjs](../../../tools/hd2d/prepare-production.mjs)。输出为 `button_night_round`（384×384）和 `icon_night_shield`（128×128），均归属 `base` 包。自 1.0.122 起，主按钮和守夜战技共用 `button_heart_round`。主按钮继续引用居中的盾牌，文字由 Laya 渲染。

裁框与透明阈值写在导入脚本中；先重新导入、复制 `production_recipe.json` 到 `source/asset_recipe.json`，再运行 `build-resources.mjs --work <Downloads目录> --sync`，使图集、源图、元数据与 `ResourceManifest.ts` 同步。

四个次级菜单继续使用既有 `panel_card`、村民/家庭/建设/家谱图标及原生矢量红点。运行布局与字号见 `project/LayaProject/src/view/config/HudConfig.ts`，颜色复用 `UiTheme.ts`，组装见 `GameHud.ts`。以上路径相对仓库根目录。

本轮说明与验证见 [36 圆形守夜主按钮](../../../../doc/tech/36_圆形守夜主按钮.md)。
