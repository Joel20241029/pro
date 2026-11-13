# 原生粒子 Shader

`VillageParticle.shader` 基于项目使用的 LayaAir 3.4.2 原生 Particle2D shader，保留顶点/片元逻辑与引擎 include，使用独立名称避免覆盖引擎注册。

发布时 shader 文本归入底包 particles.json，由 ShaderParser 注册一次。需要同时启用 `laya.particleCommon` 与 `laya.particle` 模块；不能把引擎 include 当作未提供的远程资源。
