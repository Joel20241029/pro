# 高清二维制作源

此目录保留完整可迭代输入，游戏只发布派生二维图集，不发布模型。

| 目录/文件 | 内容 |
| --- | --- |
| `characters/{male,female,child,elder}/` | 各自实测骨骼参数、原模型、walk_probe.blend、足底检查，四向八帧和中立站姿在design/hd2d/directions；成人劳动另在labor |
| `characters/baby/` | 中性婴儿躺卧呼吸，无行走 |
| `environment/` | 火堆离线动画及可编辑制作源 |
| `generated/` | 建筑、怪物、UI等原始生成图；bright_skins为正式全局UI母版，旧skins保留历史 |
| `production-sources.mjs` | 明确选择与裁框、主体档位、UI切边及母图到逻辑尺寸比例 |
| `production_recipe.json` | 导入产物，记录源/输出哈希、画布、脚底、帧数、步幅及分包 |
| `production/` | 分类派生图，不能当作唯一制作源 |
| `native-layout-seeds.json` | Laya明确重制时的初始布局；日常以已保存prefab为准 |

真实模型离线渲染与AI静态图分别记录来源，不把全部AI图片称作实际三维模型输出。四类村民统一画质和转向标准；孩子、老人共享中性外观，不改变存档性别。老人使用较短步幅，脚底和杖尖独立校验。步态是否自然仍须看连续回放和实际游戏，不只看校验哈希。

整体UI（HUD、导航、所有面板、Tips和排行榜外框）遵循08号明亮田园稿，按下时图文共同移动。九宫格只改变背景坐标，不缩放正文。详见 [技术文档32](../../../doc/tech/32_高清预渲染二维美术重制.md)。
