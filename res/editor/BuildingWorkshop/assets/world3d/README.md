# 真实 3D 世界原始工程

本目录属于 LayaAir 3.4.2 的 BuildingWorkshop 原始编辑工程。环境、角色、敌人均为真实网格；角色和敌人的动作来自骨骼动画。UI 不在本目录。不得用图片面片冒充世界模型。

| 目录 | 内容和用途 |
| --- | --- |
| environment | 21 种环境 GLB 源模型及各自独立的 prefabs/*.lh；包含独立空塔石环 PAD、木堆 LOG_PILE、灌木 BUSH，建筑的阶段部件保存在各自模型中 |
| characters | 五种村民 GLB、导入纹理和独立原生预制体；成年男女包含工作动作和工具骨骼挂点 |
| enemies | 十种敌人 GLB、导入纹理和独立原生预制体 |
| effects | 四种命中和精英脚底圈的原生三维网格粒子；不包含攻击拖尾或升级粒子 |
| WorldModelWorkshop.ts | 编辑器主进程导入与三个资源包导出入口 |
| WorldModelWorkshopScene.ts | 实际节点检查、网格高度计算、原生依赖闭包导出和男角色动作验证 |

## 唯一正式导入流程

在编辑器资源数据库完成 GLB 导入后，使用 `Editor.scene.createNodeByAsset` 创建真正的资源节点。它保留模型导入器生成的网格、材质、纹理和动作子资产 UUID。设置默认 idle 后，调用编辑器 `createPrefab`，每种模型分别保存到所属目录的 `prefabs/<名称>.lh`。

不能直接用运行时 `Laya.loader.load(GLB).create()` 再调用 `CreateAssetUtil.createPrefab` 替代这个流程：实测这条路径的动态动画没有可序列化的来源，保存后会缺少 clip；临时网格也可能在再次导入时报错。失败试验已归档到下载目录，不属于正式资源。

## 正式导出

命令格式：

```sh
layaair run -p <BuildingWorkshop绝对路径> --script=WorldModelWorkshop.buildAll --script-args="<下载目录中的输出路径> base,characters,battle"
```

最后一个参数可以选择 `base,characters` 或 `battle`，以避免读取其他人正在编辑的资源。工具使用官方 `IEditorEnv.ExportAssetTool` 遍历依赖并转换 UUID；不手写 LH，不直接解析 library 文件拼接发布资源。

每个包输出 `manifest.json`（模型 id、LH 相对路径、真实网格高度、动作名、特效和全文件清单）及 `native-export-manifest.json`（原生 UUID 和依赖明细）。base 包含环境；characters 包含村民与精英圈；battle 包含敌人与四种命中。两包共用的小粒子网格和材质各自保留，确保独立加载。发布只取清单中的运行资源，不附带 GLB、Blender、元数据和编辑器脚本。

安全扩展名导出会将 `.shader` 改为 `.shader.txt`，清单已经对应真实输出文件名。材质可能反序列化为通用 `Material`，即便其 shader 是 Unlit；染色应使用公开的 `getColor/setColor('u_AlbedoColor')`，并克隆实例材质。

## 验证边界

`WorldModelWorkshop.verifyMale <下载目录>` 验证原生 LH 的网格、16 骨骼、idle/walk/chop 不同时间的实际骨骼矩阵变化，以及材质可独立克隆改红。CLI 的 GPU 读回若全部为零，会在报告中明确记录 `hasRenderedPixels:false`，不可把这类黑图当作视觉验收。最终显示、动作幅度、工具握持、遮挡和相机比例必须在真正浏览器或微信设备的生产场景中复验。
