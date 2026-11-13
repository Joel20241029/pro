# male高清二维制作源

当前正式来源：`rig-profile.json`、`male_walk_probe.blend`、`male_direction_probe.blend`。四向各八帧行走，加每向一张双脚落地站姿；图片在 `res/design/hd2d/directions/male/`。运行时按实际路程推进周期，预览帧率仅用于素材页。

`foot-validation.json` 验证八姿态和站姿的脚底刚性、落地、足轴；`walk-probe.json` 保留实际姿态与杖尖数据。成年男女劳动动作仍在labor，老人另有rest；不以行走帧替代工作。

完整说明见 [高清制作总说明](../../README.md)。下方为早期四帧试验历史，不代表现行帧数与接入状态。

## 历史制作记录

# 男村民离线行走制作源

状态：四向行走候选，已修复鞋底被小腿拉扁的问题；尚未接入正式游戏。

## 文件职责

- `reference.png`：已确认的大头、短身、蓝衣男村民方向。
- `male_q_raw.glb`：原始高精模型，保留 19,470 顶点、35,003 三角面和三张 2048 PBR 贴图，未经减面。
- `rig-profile.json`：从原模型测量的骨骼位置、刚性鞋底范围、步幅和锚点。
- `male_inspect.blend`、`model-inspection.json`：归一化模型、相机、灯光及材质检查。
- `male_walk_probe.blend`、`walk-probe.json`：16 骨骼、腿部 IK、四个姿态和逐脚接地记录。
- `male_direction_probe.blend`、`direction-report.json`：四向根，以及整套骨骼和 IK 一起转向的验证。
- `foot-validation.json`：鞋底权重、刚性残差、脚骨缩放、方向和逐脚接地检查。
- `source-manifest.json`：来源追踪、文件和当前共享脚本哈希，不含凭证。

当前母片在 `res/design/hd2d/directions/male/`，四向各四帧，512×512。Laya 试样使用向下四帧的 256×256 派生图，以每秒 6 帧播放。

## 鞋底修正依据

旧权重让鞋底同时受脚掌、小腿和大腿影响；其中一侧低位鞋区平均约 54.9% 权重来自脚掌之外，弯膝时产生扁扭。脚骨方向、四元数与 IK 缩放未发现相应错误，因此保留原静止脚骨方向，不强行改成单位四元数。

当前鞋底刚性跟随对应脚骨，鞋帮到裤腿保留过渡，两只脚分别接地。四帧鞋底刚性残差最大约 `2.72e-8` 个单位身高，脚骨缩放误差小于 `3.2e-6`。这些数据证明鞋底没有再被拉扁；自然步态仍须结合四向连播观察。

## 重建流程

使用 `res/tools/hd2d/` 中的共享脚本。Blender 4.5.16 LTS 调用形式为 `--background --python-exit-code 1 --python 脚本 -- 参数`：

1. `inspect-character.py`：原始 GLB、下载目录输出路径、`male`。
2. `bind-walk-character.py`：检查工程、本目录规约、下载目录输出路径。
3. `render-character-directions.py`：四姿态工程、同一规约、下载目录方向输出路径。
4. `verify-character-feet.py`：四姿态工程、同一规约、下载目录报告路径。

旧男村民专用脚本已可恢复地归档到 `/Users/happyelements/Downloads/daidai-hd2d-20261113/male-legacy-authoring/`。修复前工程与方向帧在下载目录 `models/male-shoe-fix/source-before/`、`directions-before/`，不得用于当前重建。

## 未完成

耕作、伐木、照料、自然停姿、最终投影和正式游戏方向映射仍待完成。原模型及 Blender 工程只用于制作，不进入微信包。
