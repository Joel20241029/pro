# 男村民原始与运行资源追溯

2026-11-13，由已授权的内置 imagegen 参考经 animal-mediakit 网关提交 Hyper3D，一次成功，未重复提交。原始文件 `male_raw.glb` 来自 Downloads/source，保留服务返回原件；参考为 `male_reference.png`。

- Task ID：`cgt-20261113083516-fmqkw`。
- Trace ID：`c173fcab3a2b639b80d53b3ffc8f42ee`。
- 模型：hyper3d-gen2；Shaded；Quad；face-count 10000；GLB；原始约 3.2 MB。
- 最初由主任务减至约 3000 三角面、512 贴图并完成真实 16 骨蒙皮，动作 idle/walk/farm/chop/care。
- 本次仅补 ToolAxe / ToolHoe；修改前源与运行文件保存在 Downloads/daidai-3d-implementation-20261113/villagers/male-before-tools。补工具前后 Body POSITION / WEIGHTS 浮点数据逐值相同，未改脸型、身高或原动作。
- 工具先以非零缩放导出，再只把 GLB JSON 的可见根 scale 写为 0，避免零父矩阵让子网格塌缩；ToolAxeMount / ToolHoeMount 保留真实手骨挂点。
- 运行大小与动作见 `runtime-manifest.json`。不收录最早试验检查图到源资源目录。
