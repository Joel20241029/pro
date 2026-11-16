# 战技入口原图

`scroll.png` 是“战技”入口的透明卷轴原图，与已确认的明亮田园 UI 风格配套。原图保留供后续调整，不直接随包发布。

- 生成日期：2026-11-14。
- 生成方式：ImageGen，参照 `res/design/tactics/01_守村战技界面方案.png` 新制独立图标。
- 原始生成文件：`exec-d6ede2b9-9cb1-453b-aa35-a8786ac7ed49.png`。
- 正式资源标识：`icon_tactic_scroll`，基础包。
- 制作入口：`res/tools/hd2d/prepare-production.mjs`，按透明边裁切后归一到 96×96；运行时入口显示 44 逻辑像素，覆盖两倍采样。
- 图标本身不含文字、按钮、背景或地面阴影；“战技”文字由程序排版，图标随按钮一起按压。

生成提示词：

> Create one isolated game UI icon: the warm cream rolled parchment scroll with golden brown leather band used on the left-side 战技 badge of this reference design board. Match the approved bright pastoral miniature 3D-to-2D game rendering quality: clean rounded silhouette, smooth warm paper shading, crisp brown/golden edges, roll openings visible, small subtle highlights, no excessive texture. Single scroll angled diagonally lower-left to upper-right, tightly centered in a square with about 12 percent transparent margin. No badge, no card, no text, no letters, no symbols, no floor, no ground shadow, no other objects. The output must have a real transparent alpha background and remain very legible when sampled to 96 pixels. This is a standalone original production icon, not a crop of the reference.
