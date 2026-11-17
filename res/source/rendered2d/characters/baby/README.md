# 中性婴儿离线制作源

1.0.33 使用带床版本。暖木低栏床、浅绿襁褓，躺卧时每秒 2 帧轻微呼吸。地图婴儿和详情头像使用同一母片。

## 文件职责

- `reference.png`：本次模型所用参考图。
- `baby_q_raw.glb`：用户已授权的 Hyper3D 原始 PBR 输出，未减面、未缩贴图；只用于离线制作。
- `baby_inspect.blend` 与 `model-inspection.json`：归一化模型、固定相机/灯光和几何、2048 贴图检查记录。
- `source-manifest.json`：来源、追踪标识、文件和制作脚本 SHA-256；不保存凭证和签名下载地址。
- 提示词统一保存在上级 `generation-prompts.json`，输出母片保存在 `res/design/hd2d/directions/baby/`。

- `baby_idle_probe.blend`：可编辑躺卧、胸部与头部骨骼及四个姿势；第 1、3 帧同为中性姿势，不以哈希全部不同作为动作验收。
- `idle-report.json`：胸部变化、头部稳定、接地高度、输入与脚本哈希。
- `baby_cradle.blend`：保留原婴儿模型、绑定及摄影棚，新增可编辑木床、床垫和床腿。时间轴保留四个呼吸姿势。
- `cradle-report.json`：四帧接触高度、实际床脚锚点与制作参数。正式裁切从该锚点计算，母片在 `res/design/hd2d/directions/baby/`，同步贴图在 `res/editor/BuildingWorkshop/assets/hd2dAuthoring/`。

## 重建与接入

用 Blender 4.5.16 LTS 执行 `res/tools/hd2d/inspect-character.py`，参数依次为原始 GLB、下载目录中的输出目录、身份 `baby`。

随后执行 `render-baby-idle.py`，参数为检查工程和下载目录中的输出目录。

所有 Blender 调用加 `--background --python-exit-code 1 --python 脚本 -- 参数`。脚本向指定目录输出床中母片、报告与可编辑工程。正式图集通过 `prepare-production.mjs` 和 `build-resources.mjs` 更新，运行时读取二维图集。
