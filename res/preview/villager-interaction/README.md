# 地图村民详情与共享 Tip 实绘

日期：2026-11-12。本目录仅保存设计验收材料，不进入微信发布包。所有图片均由正式 GameView、实际图集在 LayaAir IDE 3.4.2 中渲染，不是设计拼图或手机截图。

当前人物详情实绘已更新为纵向居中排版：头像在中轴，状态和双亲/来历位于下方，精英加成与按钮保留间距。背景图片、头像素材和面板尺寸不变；完整本轮输出另存于 `~/Downloads/daidai-person-center-20261112/native/`。

## 目录内容

- `游戏实绘_*_屏中Tip_*.png`：共享米黄主体九宫格与棕橙色文字，长短文案及长短屏代表图。
- `游戏实绘_*_点击村民_*.png`：成人、精英、老人、孩子、婴儿，以及守夜中打开的个人详情。人物属性、位置和年龄为内存验收夹具，未修改正式开局规则。
- `interaction-check.json`：4 种规格的 8 组昼夜交互结果，包含命中、身份、遮挡、面板阻挡及暂停恢复。
- `game-render-check.json`：全部 40 张实绘的索引，本目录保留其中 8 张。完整图在 `~/Downloads/daidai-person-click-20261112/native/`。

## 复现入口

先编译正式 TypeScript 到 `~/Downloads/daidai-building-editor-20261112/test-suite/src/`，再打开 `res/editor/BuildingWorkshop` 原始 Laya 工程，执行 `工具 / CheckVillageInteraction`。测试代码位于该工程的 `assets/editor/PersonClickCheckScene.ts`，复用 `BuildingGameCheckScene.ts` 的画面规格和截图流程。

验证使用真实引擎命中链，再向原生命中节点派发按下、抬起和点击事件；不代表手机物理触摸或微信真机结果。业务回归另有 156 项检查通过，细节见 [技术文档 27](../../../doc/tech/27_地图村民详情与共享Tip.md)。

底板母版、裁切和配方说明见 [共享 Tip 制作源](../../source/ui/anchored-tip/README.md)。建筑气泡继续带指角并从尖端缩放，屏中 Tip 只使用主体并维持淡入淡出。
