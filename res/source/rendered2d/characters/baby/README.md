# 中性婴儿离线制作源

状态：躺卧呼吸四帧候选，已具备真实离线渲染源，尚未通过完整美术与正式游戏验收。

浅绿奶油色襁褓，保持性别中性；躺卧每秒 2 帧轻微呼吸，不增加行走业务。

## 文件职责

- `reference.png`：本次模型所用参考图。
- `baby_q_raw.glb`：用户已授权的 Hyper3D 原始 PBR 输出，未减面、未缩贴图；只用于离线制作。
- `baby_inspect.blend` 与 `model-inspection.json`：归一化模型、固定相机/灯光和几何、2048 贴图检查记录。
- `source-manifest.json`：来源、追踪标识、文件和制作脚本 SHA-256；不保存凭证和签名下载地址。
- 提示词统一保存在上级 `generation-prompts.json`，输出母片保存在 `res/design/hd2d/directions/baby/`。

- `baby_idle_probe.blend`：可编辑躺卧、胸部与头部骨骼及四个姿势；第 1、3 帧同为中性姿势，不以哈希全部不同作为动作验收。
- `idle-report.json`：胸部变化、头部稳定、接地高度、输入与脚本哈希。

## 重建与接入

用 Blender 4.5.16 LTS 执行 `res/tools/hd2d/inspect-character.py`，参数依次为原始 GLB、下载目录中的输出目录、身份 `baby`。

随后执行 `render-baby-idle.py`，参数为检查工程和下载目录中的输出目录。

所有 Blender 调用加 `--background --python-exit-code 1 --python 脚本 -- 参数`。脚本不改输入工程，不写正式游戏包。完整方向在浏览器对照页检查；原生 Laya 小场景播放向下行走或婴儿躺卧。模型体积不等于微信包体，正式游戏只使用后续验收通过的二维图集。

## 未完成

完整劳动/休息动作、最终材质精修、独立地影和正式游戏身份/方向映射仍按技术文档 32 验收。运行时继续二维；本次没有改玩法、岗位、性别、寿命或存档。
