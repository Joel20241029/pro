# 二维预制体转换数据

当前发布高清二维四包，不发布粒子。1.0.17 的 `enemies.json` 为合同版本 2：每帧保存主体图片及显示补偿、每个可选配饰的矩形与前后层级，足底仍由统一原点固定。它由实际 Laya 怪物 `.lh` 导出，不手工修改；对应配置、编辑器保存入口和验证见 [怪物移动与配饰校准](../../doc/tech/38_怪物移动与配饰校准.md)。建筑布局与时间轴继续复用原数据。

## 历史二维回退记录

2026-11-13 已确认恢复原二维图集、序列帧、部件建筑及二维粒子。本目录重新作为二维构建中间数据入口；实施与待验证项见 [技术记录 31](../../doc/tech/31_恢复二维场景与序列帧.md)。这些文件是生成结果，不手工改参数。

## 数据职责

- `buildings.json`：从七个二维建筑 `.lh` 提取当前等级与房数变体、部件、范围、足底和发射口。运行时只创建当前变体。
- `building_upgrade.mc`、`building_attack.mc`：编辑器原生共享时间轴，发布后缀沿用 `.mc.bin`，跟随游戏视觉时钟采样。
- `enemies.json`：从十个二维怪物 `.lh` 提取身体、细节帧、配件挂点、共同足底和源哈希。
- `particles_base.json`：大王之心可用时的鲜红按钮环绕。
- `particles_characters.json`：精英村民脚底圈。
- `particles_battle.json`：四类攻击命中效果，不含攻击拖尾与建筑升级粒子。

请修改 `res/editor/BuildingWorkshop/assets/` 下的 buildingAuthoring、enemyAuthoring、particleAuthoring 源，再运行 `res/tools/build-resources.mjs --work <Downloads任务目录> --sync`。构建将所需文件分配到 base、characters、battle，正式发布仍以 `manifest.json.runtimeWhitelist` 为准，不递归复制 native 目录。

world3d 原生模型闭包已停止采用。`res/source/3d/` 与 world3d 编辑源可保留追溯，但不能混入当前二维白名单。回退期间尚未重新构建的文件不代表已验证可发布，不能把历史生成结果当作本轮验收。
