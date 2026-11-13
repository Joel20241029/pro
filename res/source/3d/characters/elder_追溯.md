# elder 原始模型追溯

生成日期：2026-11-13。

## 造型与参考

中性老人，灰白短发、无胡须、无女性发髻，温和皱纹面孔、灰绿布衣；正面 A pose、双手空持，无拐杖。

使用内置 imagegen 生成独立透明参考图，沿用 `male_reference.png` 的圆润风格化 3D 比例、材质和柔和光照。仅把本项目 AI 生成参考图发送至用户已授权的 animal-mediakit 网关与 Hyper3D。

- 参考图：`elder_reference.png`。
- 原始模型：`elder_raw.glb`，保留服务原始输出，尚未减面、缩纹理或绑定骨骼。
- 模型风格约束：单体、无文字、无地面、无场景或手持道具。

## 生成记录

- CLI：animal-mediakit 1.37.107；供应商：volcengine。
- 模型：hyper3d-gen2-260112。
- Task ID：`cgt-20261113085056-zn5vj`。
- Trace ID：`ff238a17803c5a87e1aac21a1714ea28`。
- 参数：`--material Shaded --mesh-mode Quad --face-count 10000 --format glb`。
- 本资产仅提交一次，成功后未重复计费提交。
- 提示词：Single gender-neutral elderly villager short gray white hair no beard no feminine bun sage gray green tunic front A pose empty separated hands two separated legs no cane no props no base
- 原始大小：3421080 字节。
- SHA-256：`472a9b335a478fc9f72ecb05240480c99f9dd8d32653e11886f1b22fd8256caf`。

## 本地验收

使用 Blender 4.5.16 后台导入原始 GLB，渲染前后视图并人工检查。单一网格，完整主体，无多脸、缺腿或无关夹带物。双手和双腿完整且分离，正面和背面没有重复面孔。

- 顶点：12179；Blender 导入后多边形：21314。请求 10000 为上游 Quad 目标；GLB 实际三角化面数以此检查为准。
- 纹理：2048×2048 Shaded 贴图；该原始文件不应直接作为最终小游戏包资源。
- 渲染、结构 JSON、CLI 结果及日志：`/Users/happyelements/Downloads/daidai-3d-implementation-20261113/villagers/`，文件前缀 `elder_`。
- 后续由运行时资产工序减面、缩纹理、绑定和动作验收；这里没有修改骨骼、游戏代码或打包配置。

## 运行资源与真实骨骼

原始模型保留不变，另存可编辑 `elder.blend` 与运行 `res/editor/BuildingWorkshop/assets/world3d/characters/elder.glb`。

- 运行大小：196932 字节；真实蒙皮骨数：16；蒙皮顶点：2371。
- 动作：idle, walk。成人/儿童/老人待机已烘焙自然下垂手臂，非 A pose 播放。婴儿专用躺姿、Breath/Head 蒙皮和两秒呼吸循环。
- 儿童使用独立肩、颈、髋、膝挂点；女村民发辫按纹理区域与接缝权重平滑，避免套用手臂权重。
- 保留 512×512 单张 JPEG 贴图；已从同一真实模型比较 256 贴图胸像，眼睛、眉毛和嘴部在 256 贴图下明显模糊，因此未继续降低。
- 材质使用 `KHR_materials_unlit`；正面与动作样图来自真实 Blender 渲染。
- SHA-256：`79a66cf587cf34dc875df55ecb416b054893114ca280b5057e279975eb4eacdc`。
- 工具：无工作工具。
- 验收目录：`/Users/happyelements/Downloads/daidai-3d-implementation-20261113/villagers/rig-check/`。结构、权重归一、骨索引、动作列表、工具隐藏状态经 `res/tools/3d/validate-characters.py` 验证。
- 真 3D 胸像：`res/source/ui/hd/portraits/elder.png`，256×256 RGBA。

重建入口：`res/tools/3d/prepare-character.py`；共享人形绑定：`character_rig.py`；婴儿绑定：`baby_rig.py`；工作工具：`character_props.py`；头像渲染：`render-character-portraits.py`。运行参数保存在原始和运行验收 JSON 中。
