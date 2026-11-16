# UI 制作源

本目录保存界面组件的原始母版和生成提示词，不进入微信发布包。运行资源由根目录 `asset_recipe.json` 统一裁切、缩小和装入图集。

| 目录 | 用途 |
| --- | --- |
| [anchored-tip](anchored-tip/README.md) | 建筑气泡和屏中 Tip 共用的九宫格主体，以及建筑气泡独立指角的母版 |
| [circular-footer](circular-footer/README.md) | 已确认的底部中央圆形守夜按钮效果图、透明底板与独立月亮盾牌母图 |
| [night-controls](night-controls/README.md) | 守夜三按钮确认稿、无字暖金圆钮和独立冠心母图，以及技能三态绘制规则 |

旧版通用面板的制作源仍在 `../static/`。修改资源时先改制作源或配方，再执行资源构建；不要直接编辑图集成品。
