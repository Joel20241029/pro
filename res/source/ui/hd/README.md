# 高清轻量 UI 原始资源

本目录对应 2026-11-13 已确认保留的《代代守村》高清 UI。世界表现已决定恢复原二维图集和序列帧，UI 不随之回退为旧像素皮肤；实施状态见 [技术记录 31](../../../../doc/tech/31_恢复二维场景与序列帧.md)。图标与皮肤使用 Laya 原生矢量绘制，源文件就是可编辑的绘图代码，不需要另外维护一份 PNG 母版。

## 源文件

- `project/LayaProject/src/view/UiSurface.ts`：象牙白面板、细琥珀边、绿色与琥珀按钮、轻内高光、禁用态、Tip 底板。
- `project/LayaProject/src/view/UiGlyphs.ts`：64 逻辑像素母版的麦穗、木材、村民、家庭、建设、家谱、奖杯、爱心、婴儿、盾牌、日志、箭、石块、冰晶及战斗操作图标。
- `project/LayaProject/src/view/UiTheme.ts`：统一文字与状态色、字号、控件间距。
- `project/LayaProject/src/view/UiWidgets.ts`：图文整体居中、按压面层和控件组装。

以上路径均相对仓库根目录。皮肤通过 `SpriteFrames.panel` 接入；通用图标通过 `UiWidgets.image` 接入。人物头像恢复原二维人物帧，由 `SpriteFrames.portraitId` 映射既有年龄与性别素材；姓名、性别及年龄说明仍读取原人物数据。`portraits/` 中的 3D 模型渲染头像仅保留试验追溯，不进入运行白名单。

## 调整规则

1. 保持面板和按钮细边，不能重新加外部黑阴影或像素锯齿厚框。
2. 图标坐标在 64 × 64 母版内编辑，显示尺寸由调用方决定；不要为同一图标的尺寸变体复制图片。
3. 按钮图标必须放在 `buttonFace` 中，与文字一起按压；动态文案变化后使用 `alignButtonIcon` 重新居中。
4. 图形使用 `drawRoundRect`、`drawPath`、`drawPoly`、`drawCircle` 等已在本地 Laya 3.4.2 类型定义核实的接口。不使用整屏背景图或新增大中文字体。
5. 资源增量以最终构建为准。本方案没有新增运行时 UI 位图，原生图形仍会产生绘制指令与运行内存，不能将“不新增 PNG”理解为零性能成本。

## 旧位图退出运行图集清单

下列 24 个旧帧已由原生图形覆盖。图集打包器和 `ResourceManifest` 同步迁移后可不再打入运行包；保留历史源图，不直接删除整张图集。

```text
panel_anchored_tip
panel_anchored_tip_tail
panel_button_disabled
panel_button_gold
panel_button_green
panel_button_red
panel_card
panel_parchment
panel_portrait_frame
icon_arrow
icon_baby
icon_build
icon_family
icon_food
icon_heart
icon_house
icon_logging
icon_population
icon_shield
icon_slow
icon_stone
icon_trophy
icon_view
icon_wood
```

`icon_journal`、`icon_pause`、`icon_play`、`icon_speed`、`icon_king_heart` 是新矢量标识，不需要添加同名 PNG。锚定气泡尾巴由 `UiSurface.drawUiTipTail` 生成，与主体共用颜色；仍沿用原来的指角尺寸和缩放原点。

设计图与中间验证产物位于本机下载目录 `daidai-ui-hd-concept-20261113/` 和 `daidai-3d-implementation-20261113/ui/`，不进入发布包。
