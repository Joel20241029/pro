# 村民 3D 资源源工程

本目录保留五种村民的独立参考、服务原始 GLB、可编辑 Blender 骨骼工程和生成追溯。原始模型和 `.blend` 不能直接放入微信包。

- `*_reference.png`：内置 imagegen 生成的透明单体参考。
- `*_raw.glb`：Hyper3D 原始返回，保留完整建模与 2048 贴图。
- `{male,female,child,elder,baby}.blend`：减面、512 贴图、蒙皮和动作的可编辑源。
- `*_追溯.md`：任务 ID、来源、约束和验收记录。
- `runtime-manifest.json`：构建读取的五角色列表，字段为 id、height、clips、file、bytes。height 是最终 GLB Body 网格的实际 Y 向高度，婴儿已经躺下，不能再旋转 90 度。

运行 GLB 位于 `res/editor/BuildingWorkshop/assets/world3d/characters/`。头像位于 `res/source/ui/hd/portraits/`，五张均为真实模型渲染的 256×256 RGBA 胸像，不是重新生成的 AI 头像。

## 动作和接入约定

| 角色 | 动作 | 骨数 |
| --- | --- | --- |
| male / female | idle、walk、farm、chop、care | 16 |
| child / elder | idle、walk | 16 |
| baby | idle，躺姿两秒呼吸 | 3 |

成人、儿童、老人已经使用自然垂臂的 rest，不需要额外把 A pose 手臂转下。儿童使用自己的肩、颈、髋和膝挂点；老人保留中性短发无胡须；女村民发辫与衣料相接处做了权重平滑。

男、女各有 `ToolAxeMount`、`ToolHoeMount` 挂在右手骨下，并各自包含 `ToolAxe`、`ToolHoe` 可见根。运行时递归查找可见根：chop 仅把 ToolAxe 的 scale 设为 `(1,1,1)`，farm 仅把 ToolHoe 设为 `(1,1,1)`；其他动作两者均为 `(0,0,0)`。不要改 Mount 的缩放、位置或旋转。

工具导出时必须先以非零根缩放导出，再由 `hide_exported_tools` 只修改 GLB JSON 的两个可见根。直接让 Blender 导出零父缩放会令子网格变换塌缩，运行时只放大根不能恢复工具。

## 可重建脚本

全部脚本在 `res/tools/3d/`，Blender 入口设置了 `sys.dont_write_bytecode=True`。

- `prepare-character.py`：原始模型减面、贴图缩小、绑定、动作、源文件和 GLB 导出。
- `character_rig.py`：人形比例、权重、自然 rest 和动作。
- `baby_rig.py`：婴儿躺姿、Breath/Head 蒙皮与呼吸。
- `character_props.py`：掌心工作工具、导出隐藏根处理。
- `add-character-tools.py`：向已有已核对模型补工具，不重建身体。
- `render-character-portraits.py`：只读五个 `.blend` 渲染头像，以及 256 贴图对比；不保存模型。
- `validate-characters.py`：只读检查 GLB 头、蒙皮权重、骨索引、动作、工具根和非零工具子变换。

512 与 256 贴图对比后保留 512：在 256 像素胸像中，降至 256 贴图会明显模糊眉眼与嘴部。每模型仅一张 JPEG，材质为 `KHR_materials_unlit`。

原生 Blender 动作图、贴图对比和验证报告在 `/Users/happyelements/Downloads/daidai-3d-implementation-20261113/villagers/`。这些证明真实网格、蒙皮和动作；Laya 原生导入、动画切换、工具根缩放及真机表现由整合验收进一步确认。
