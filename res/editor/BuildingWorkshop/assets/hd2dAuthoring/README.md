# 高清二维原生验证资源

本目录属于 Laya 制作工程的小场景，不进入生产游戏或微信导出目录。

## 内容

- `textures/`：由高清原图按明确配方裁切、平滑缩放得到的试验贴图；`texture-manifest.json` 记录尺寸、SHA-256、PNG 总字节与估算 RGBA 解码内存。
- `prefabs/ARROW.lh`、`STONE.lh`、`SLOW.lh`：三种塔分别一个预制体。由 Laya 原生 `CreateAssetUtil.createPrefab` 保存，主体、武器及必要前栏独立。
- `Hd2dProbeMotion.ts`：仅供小场景使用的序列帧播放与确定性采样组件；成年男女、孩子与老人均为四帧行走，婴儿四帧呼吸，正面山匪两帧，火焰四帧。老人每秒 4 帧，婴儿 2 帧，其余 6 帧。
- `Hd2dProbeViewport.ts`：仅在独立预览中等比缩放、居中并裁剪固定画布，不修改共享工程分辨率；不在编辑器取证时执行。
- 环境制作逻辑在 `../editor/Hd2dProbeEnvironment.ts`，纯表现数值在 `../editor/Hd2dEnvironmentConfig.ts`。圆树、松树各自带装饰子节点，路牌文字是本体子节点；火堆底座、火焰、前排石头依次叠放。

原图与逐项来源保存在 `res/design/hd2d/environment/`，可编辑 Blender 火堆和苹果源在 `res/source/rendered2d/environment/`。五类村民的骨骼源与检查报告分别在 `res/source/rendered2d/characters/`。场景按地影、世界物体、操作文字三层组织，世界物体使用落地点排序；塔需将 `SortOrigin` 换算至根坐标后排序。

## 重建与查看

1. 在仓库根运行 `node res/tools/hd2d/build-probe-assets.mjs`。
2. 打开 `res/editor/BuildingWorkshop/BuildingWorkshop.laya`。
3. 等待原生脚本编译后，执行菜单“工具 → BuildHd2dProbe”。
4. 打开 `assets/Hd2dProbe.ls` 并运行预览。验证图和报告输出到下载目录 `daidai-hd2d-20261113/native/`。
5. 执行 `node res/tools/hd2d/verify-probe.mjs /Users/happyelements/Downloads/daidai-hd2d-20261113/native`，更新可交付的检查记录和截图。

按钮使用本工程已启用的 UI2 `GImage`，图片导入配置保留完整纵向渐变，仅横向拉伸中部。不得替换成只在编辑器进程存在、独立预览未加载的旧版 `Image`。

当前公共旋转片段仅在采样阶段验证武器层独立性，保存场景中的武器不自动播放，尚非最终射击动作。独立预览连续播放五类村民、山匪和火焰；四类行走只接入向下视角，完整四向另在对照页检查。原生采样另外输出树、路牌和火堆各前后两张遮挡图；临时摆位在保存场景后执行，不改变保存的角色位置。成年劳动和老人休息等动作仍待制作。现有柔影只是近似，完整投影、建筑高级轮廓、占地、正式游戏接入、粒子移除及手机验证都另行验收。
