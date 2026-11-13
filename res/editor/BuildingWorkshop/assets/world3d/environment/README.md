# 环境 GLB 导入资源

本目录是本轮真实 3D 环境的 Laya 编辑器输入，包含七类建筑的四阶段模型及森林、道路、农田周边装饰。每种建筑应生成独立的 Laya 原生预制体。

完整配方、可编辑 `.blend`、坐标和命名约定见 `res/source/3d/environment/README.md`。请从 `res/tools/3d/build-environment.py` 重建，避免只修改导出结果。

接入要求：每个建筑根下只启用一个 `Level1/4/8/12`；武器围绕 `Weapon` 转向，弹丸起点取 `Weapon/Muzzle` 的世界坐标；树冠花果使用独立模型挂到 `DecorationSocket*`。统一 Scene3D 深度遮挡，不能用旧 2D 排序掩盖真实 3D 交叠。

GLB 不含相机、灯光、外部贴图或自动播放动画。灯光、暂停、倍速和运行时动画由游戏场景统一驱动。目录中的 `.meta`、`.lh` 等导入元数据和原生预制体由 Laya 编辑器生成，不由 Blender 脚本覆盖。

当前 21 个 GLB 共 1,023,432 字节。重复刚体模块引用同一网格，整株麦苗、屋顶、窗框等保留模块粒度；树草 Body 已按材质合并，TREE_OAK 每棵 5 个渲染节点。导出 Laya 原生资源时需要保持共享关系。精确宽高深及各阶段边界见源目录 `manifest.json` 的 `bounds` / `levelBounds`，不要用旋转后的局部 AABB 外扩结果给整栋建筑标定尺寸。

静态映射须使用独立资源：空塔位为 `PAD`，木头堆为 `LOG_PILE`，圆叶灌木为 `BUSH`。`ROCKS`、`LOGGING`、`GRASS` 分别仍用于石堆、作坊、草簇。
