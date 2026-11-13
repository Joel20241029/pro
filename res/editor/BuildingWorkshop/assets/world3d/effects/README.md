# 世界 3D 粒子源资源

本目录保留可直接在 LayaAir 3.4.2 编辑器打开的原生粒子工程资源。范围沿用 1.0.13：四种命中和精英脚底常驻环，没有攻击拖尾、升级粒子或环境粒子。UI 的“大王之心”按钮粒子继续由原 2D UI 模块负责。

| 目录 / 文件 | 用途 |
| --- | --- |
| `prefabs/hit_arrow.lh` | 箭矢命中的浅金碎粒，6 粒、0.24 秒 |
| `prefabs/hit_stone.lh` | 石块命中的土色碎粒，10 粒、0.43 秒 |
| `prefabs/hit_ice.lh` | 寒塔命中的冰蓝碎粒，8 粒、0.38 秒 |
| `prefabs/hit_gate.lh` | 城门受击的木色碎粒，8 粒、0.4 秒 |
| `prefabs/elite_ring.lh` | 精英村民脚底金色粒子环，20 粒/秒、每粒 0.6 秒 |
| `meshes/fragment.lm` | 所有效果复用的 1 单位立方体网格，粒子大小在各预制体中配置 |
| `materials/fragment.lmat` | 原生 `PARTICLESHURIKEN` 材质，透明混合、正常深度测试、不写深度 |
| `WorldParticle3DWorkshopScene.ts` | 原生创建、保存和解码验证入口；使用编辑器 `CreateAssetUtil`，不是手写预制体 JSON |

所有发射器均为 `ShurikenParticleRenderer` 的 Mesh 渲染模式。碎粒具有真实三维几何并接受世界遮挡，不在全局 UI 顶层绘制。无需增加 PNG 贴图，也没有将整张二维人物图伪装成三维粒子。

## 制作与参数

参数唯一源是 `project/LayaProject/src/view/config/WorldParticle3DConfig.ts`，单位比例来自 `World3DConfig.ts` 的 `WORLD_3D.pixelsPerUnit`，本次为 48。编辑器入口直接导入这两份配置。改动配方后需重新执行原生制作并核对预制体。

使用编辑器场景脚本 `WorldParticle3DWorkshopScene.build` 生成资源。保存完成后由编辑器主进程执行 `Editor.assetDb.flushChanges()`，等网格导入完成，再调用 `WorldParticle3DWorkshopScene.verify(outputDirectory)`。验证产物必须写入下载文件夹。

本次 CLI 入口及验证报告放在 `/Users/happyelements/Downloads/daidai-3d-implementation-20261113/effects/`。`build-native.ts` 是临时调用入口；目录内这份原生制作脚本和配置才是可持续维护的源文件。

## 运行接入

运行类为 `project/LayaProject/src/view/three/WorldParticles3D.ts`。构造参数为主场景 `Scene3D`、同场景 `WorldProjection`、已加载的 `ReadonlyMap<string, Laya.Prefab>`。Map 中的键对应上述五个效果名称，可以在人物/战斗分包准备后分别填入。

- `burst(id, x, y, height = 0)`：x/y 为当前 Stage 逻辑坐标，height 为地面以上世界单位高度。由真实命中或撞门事件调用，不能改动伤害结算时机。
- `beginPeople()` → 多次 `ring(personId, x, y, scale)` → `endPeople()`：先回收离场身份，再绑定新人物。`ring` 不返回 UI 节点；其三维节点只属于 Scene3D。
- `advance(delta, combatSpeed, active)`：delta 为真实秒。命中随战斗倍速，精英常驻环保持原人物表现时钟；active 为 false 时原生模拟暂停。
- `clearBattle()` 只清命中，`reset()` 同时清人物环，`destroy()` 销毁本模块实例及其独立材质，不销毁调用方场景或共享原始资源。

引擎模块需要 `laya.d3` 与 `laya.particle3D`。4 种命中预制体归战斗资源，精英环归人物资源，公共网格/材质按资源构建依赖规则处理。本模块不修改项目模块开关，不单独发布微信包。

## 时间、遮挡与资源释放

3D 原生 `stop()` 只停止发射，不能单独用它清除残粒。运行类回收时先禁用发射，再 `stop()` 与 `simulate(0, true)` 清空；重新播放只初始化一次，之后使用 `simulate(dt, false)` 手动推进。每次模拟结束保持原生 pause，避免系统自动更新再推进一次。

每个实例克隆独立材质，避免受击染色或其他实例改色互相污染。命中池总数最多为现有 `RULE.effectCap`（32），人物环最多为 `RULE.populationCap`（20）；切换命中类型时可回收空闲旧类型，不额外扩大实例总上限。深度测试遵循同一个世界相机；粒子不启用投影或接收阴影。

精英环发射面由 XY 旋转到 XZ，放在地面上方 0.035 世界单位。原生 `customBounds` 没有保存在本版 `.lh` 中，运行类在实例化后设置对称三维包围盒，避免环平面推导导致错误裁剪。

## 已验证范围

通过真实 Laya 3D 相机与原生 .lh 解码验证五个效果：0.1 秒时发射数量为 6、10、8、8、2；暂停四个渲染帧后模拟时间不变；再次手动推进 0.15 秒后时间恰为 0.25 秒；清理后残粒为零；克隆材质互不影响。这里的数量检查在顶点上传后读取，不能用尚未上传的 `aliveParticleCount` 判断是否发射。

这些检查证明原生发射和生命周期，不等于已经完成整体场景视觉验收或手机性能测试。最终须在父场景集成后确认遮挡、比例、命中挂点和真机表现。
