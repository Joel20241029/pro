# 高清 UI 运行资源说明

本版高清 UI 由 Laya 原生矢量指令绘制，本目录不放 PNG 或额外图集。

运行时入口：

- 皮肤：`src/view/UiSurface.ts`，由 `SpriteFrames.panel` 调用。
- 图标：`src/view/UiGlyphs.ts`，由 `UiWidgets.image` 调用。
- 颜色与字号：`src/view/UiTheme.ts`。

源资源说明见 `res/source/ui/hd/README.md`。本目录的说明文件属于开发资料，不应被运行时资源构建复制到微信包。原有未使用 UI 位图是否能删除，应由图集构建阶段按引用清单确认，不能直接整包删除，因为场景、粒子或其他图形可能共用图集。
