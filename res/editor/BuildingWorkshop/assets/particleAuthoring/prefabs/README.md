# 独立粒子预制体

每个 `.lh` 是一个 Sprite 加一个 ShurikenParticle2DRenderer。使用 LayaAir IDE 3.4.2 直接打开编辑，保留 `.meta` 与材质引用。

| 所属包 | 文件 |
| --- | --- |
| base | `button_ready.lh` |
| characters | `elite_ring.lh` |
| battle | `hit_arrow.lh`、`hit_stone.lh`、`hit_ice.lh`、`hit_gate.lh` |

命中为单次 burst，红色按钮环绕与精英脚底圈为持续发射。1.0.13 已移除拖尾及升级粒子对应的 4 个预制体与元数据；建筑自己的升级时间轴仍保留。原始参数来自上级 recipe；日常手工调整后直接运行资源转换，无需重新执行覆盖性的搭建菜单。
