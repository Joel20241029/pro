# female高清二维制作源

当前正式来源：`rig-profile.json`、`female_walk_probe.blend`、`female_direction_probe.blend`。四向各八帧行走，加每向一张双脚落地站姿；图片在 `res/design/hd2d/directions/female/`。运行时按实际路程推进周期，预览帧率仅用于素材页。

`foot-validation.json` 验证八姿态和站姿的脚底刚性、落地、足轴；`walk-probe.json` 保留实际姿态与杖尖数据。成年男女劳动动作仍在labor，老人另有rest；不以行走帧替代工作。

完整说明见 [高清制作总说明](../../README.md)。下方为早期四帧试验历史，不代表现行帧数与接入状态。

## 历史制作记录

# 成年女村民离线制作源

状态：四向各四帧行走候选，已具备真实离线渲染源，尚未通过完整美术与正式游戏验收。

橘色衣服、束发与橘色发带；身体、脸与脚同向。

## 文件职责

- `reference.png`：本次模型所用参考图。
- `female_q_raw.glb`：用户已授权的 Hyper3D 原始 PBR 输出，未减面、未缩贴图；只用于离线制作。
- `female_inspect.blend` 与 `model-inspection.json`：归一化模型、固定相机/灯光和几何、2048 贴图检查记录。
- `source-manifest.json`：来源、追踪标识、文件和制作脚本 SHA-256；不保存凭证和签名下载地址。
- 提示词统一保存在上级 `generation-prompts.json`，输出母片保存在 `res/design/hd2d/directions/female/`。

- `rig-profile.json`：按本模型测量的骨骼、刚性鞋底、权重范围、步幅、帧率及地面锚点；不是男村民坐标的直接拷贝。
- `female_walk_probe.blend`、`walk-probe.json`：四个步态、左右鞋底高度和输入哈希；老人额外记录杖尖和刚性杖顶点。
- `female_direction_probe.blend`、`direction-report.json`：统一方向根、四向渲染与整套骨骼/IK 刚体转向误差。
- `foot-validation.json`：四个保存姿势的鞋底刚性、脚骨缩放、目标朝向和落地检查；报告保留输入哈希，连续步态另在对照页查看。

## 重建与接入

用 Blender 4.5.16 LTS 执行 `res/tools/hd2d/inspect-character.py`，参数依次为原始 GLB、下载目录中的输出目录、身份 `female`。

随后执行 `bind-walk-character.py`，参数为检查工程、该身份 `rig-profile.json` 和下载目录中的输出目录；最后执行 `render-character-directions.py`，参数为步态工程、同一规约和方向输出目录。

所有 Blender 调用加 `--background --python-exit-code 1 --python 脚本 -- 参数`。脚本不改输入工程，不写正式游戏包。完整方向在浏览器对照页检查；原生 Laya 小场景播放向下行走或婴儿躺卧。模型体积不等于微信包体，正式游戏只使用后续验收通过的二维图集。

## 未完成

完整劳动/休息动作、最终材质精修、独立地影和正式游戏身份/方向映射仍按技术文档 32 验收。运行时继续二维；本次没有改玩法、岗位、性别、寿命或存档。
