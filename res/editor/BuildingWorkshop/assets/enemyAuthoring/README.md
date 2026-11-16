# 高清二维怪物制作源

五种小怪、五种首领各一个原生prefab。当前小怪6帧、首领8帧，共70帧；正面高清母稿位于 `res/source/rendered2d/generated/enemies/rework/`。

根画布为96×96。每类的SortOrigin与整轮步幅由 `res/source/rendered2d/enemy-layouts.mjs` 分别记录；不能再将所有类型统一为(48,92)，也不能按每帧最低脚尖或透明裁框重新对齐。主体保持共同画布注册，可选旗帜和羽饰的矩形与前后层级保存在每个Frame下，默认隐藏。

先执行 `res/tools/hd2d/prepare-production.mjs` 和 `prepare-native-prefabs.mjs`，再在Laya中运行 `工具 / RefineHdEnemyAttachments`。此操作使用原生CreateAssetUtil保存十个独立prefab、逐帧证据和总览场景，不修改建筑。也可通过编辑器原生 `Editor.scene.runScript('Hd2dEnemyRefinementScene.build', seeds, recipe, output)` 执行同一入口。

根节点的第一个子节点为 `ContactShadow`，复用 `shadow_actor`，与全部 Frame 共用同一个 SortOrigin 和父变换。阴影独立于身体贴图，切帧、缩放、镜像及受击变色时保持接地。阴影矩形由原生编辑器保存为整数，Alpha中心与足点误差不超过半个96画布单位；不要逐帧追随前伸脚尖。

`res/tools/build-enemy-layouts.mjs`读取实际 `.lh` 导出版本4合同，包含阴影、帧、配件、足点与步幅；不要手改生成的布局JSON。仅调整挂点时只需运行 `prepare-native-prefabs.mjs` 和怪物原生菜单，不重新采样身体图片，也不要运行全量BuildHd2dProduction菜单。编辑工程、原图和证据不随游戏发布。

完整设计、模拟与验证记录见 [长期经营与怪物重制](../../../../../doc/tech/46_长期经营与怪物重制.md)。
