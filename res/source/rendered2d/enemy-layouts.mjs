/** 2026-11-16批准的十类怪物制作参数，统一96单位画布。
 * foot是身体地面投影，不是前伸脚尖；stride是一整个左右步循环的逻辑步幅。
 * poses记录身体偏移及头/肩挂点，禁止对单帧Alpha框重新缩放或逐帧挪动阴影。
 * 输出须经Laya RefineHdEnemyAttachments原生保存独立.lh，再发布。
 */
export const enemyMotionProfiles = {
    enemy_raider: {foot:84,stride:30}, enemy_runner: {foot:82,stride:34},
    enemy_armored: {foot:82,stride:24}, enemy_boar: {foot:86,stride:24},
    enemy_disruptor: {foot:84,stride:28}, enemy_chief: {foot:86,stride:24},
    enemy_commander: {foot:86,stride:24}, enemy_wolfking: {foot:86,stride:30},
    enemy_tuskking: {foot:86,stride:20}, enemy_shaman: {foot:86,stride:24}
};
/** 独立接地影在96单位动画根画布内，始终位于所有Frame之前。
 * 复用shadow_actor母画布实测Alpha中心(98.56,140.46)/192；保持1.0.24宽度、压扁比例和透明度。
 * 尺寸随怪物根节点缩放，不能再在地图层按另一个坐标重画，也不能把阴影烘焙到身体帧里。
 */
export const enemyContactShadow = { frame: 'shadow_actor', centerX: 98.56 / 192, centerY: 140.46 / 192, heightRatio: .6, alpha: .5 };
const shadowWidths = { enemy_raider: .48, enemy_runner: .4, enemy_armored: .48, enemy_boar: .62, enemy_disruptor: .44,
    enemy_chief: .6, enemy_commander: .56, enemy_wolfking: .62, enemy_tuskking: .66, enemy_shaman: .56 };
/** 原生制作种子使用的固定底层节点；导出读取编辑器保存的节点，运行不重复计算这份布局。 */
export function productionEnemyShadow(kind) {
    // Laya原生序列化将Sprite矩形取整；先固定整数尺寸，再将Alpha中心贴足底，误差最多半个画布单位。
    const width = Math.round(96 * shadowWidths[kind]), height = Math.round(width * enemyContactShadow.heightRatio);
    return { name: 'ContactShadow', frame: enemyContactShadow.frame, x: Math.round(48 - width * enemyContactShadow.centerX),
        y: Math.round(enemyMotionProfiles[kind].foot - height * enemyContactShadow.centerY), width, height, alpha: enemyContactShadow.alpha };
}
const profiles = {
    enemy_raider: {"poses":[[0,0,48,23,48,49],[0,0,48,23,48,49],[0,0,48,22,48,48],[0,0,48,23,48,49],[0,0,48,23,48,49],[0,0,48,23,48,49]],"parts":{"banner":["shoulder",20,-38,38,true]}},
    enemy_runner: {"poses":[[0,0,48,28,48,52],[0,0,48,28,48,52],[0,0,48,27,48,51],[0,0,48,28,48,52],[0,0,48,28,48,52],[0,0,48,28,48,52]],"parts":{"feathers":["head",-30,-13,16,true]}},
    enemy_armored: {"poses":[[0,0,48,26,48,52],[0,0,48,26,48,52],[0,0,48,25,48,51],[0,0,48,26,48,52],[0,0,48,26,48,52],[0,0,48,26,48,52]],"parts":{"banner":["shoulder",17,-40,36,true]}},
    enemy_boar: {"poses":[[0,0,48,55,48,36],[0,0,48,55,48,36],[0,0,48,54,48,35],[0,0,48,55,48,36],[0,0,48,55,48,36],[0,0,48,55,48,36]],"parts":{}},
    enemy_disruptor: {"poses":[[0,0,48,29,48,50],[0,0,48,29,48,50],[0,0,48,28,48,49],[0,0,48,29,48,50],[0,0,48,29,48,50],[0,0,48,29,48,50]],"parts":{}},
    enemy_chief: {"poses":[[0,0,48,22,48,48],[0,0,48,22,48,48],[0,0,48,21,48,47],[0,0,48,22,48,48],[0,0,48,22,48,48],[0,0,48,22,48,48],[0,0,48,21,48,47],[0,0,48,22,48,48]],"parts":{"banner":["shoulder",24,-33,32,true]}},
    enemy_commander: {"poses":[[0,0,48,26,48,48],[0,0,48,26,48,48],[0,0,48,25,48,47],[0,0,48,26,48,48],[0,0,48,26,48,48],[0,0,48,26,48,48],[0,0,48,25,48,47],[0,0,48,26,48,48]],"parts":{}},
    enemy_wolfking: {"poses":[[0,0,48,56,48,28],[0,0,48,56,48,28],[0,0,48,55,48,27],[0,0,48,56,48,28],[0,0,48,56,48,28],[0,0,48,56,48,28],[0,0,48,55,48,27],[0,0,48,56,48,28]],"parts":{}},
    enemy_tuskking: {"poses":[[0,0,48,50,48,24],[0,0,48,50,48,24],[0,0,48,49,48,23],[0,0,48,50,48,24],[0,0,48,50,48,24],[0,0,48,50,48,24],[0,0,48,49,48,23],[0,0,48,50,48,24]],"parts":{}},
    enemy_shaman: {"poses":[[0,0,48,30,48,50],[0,0,48,30,48,50],[0,0,48,29,48,49],[0,0,48,30,48,50],[0,0,48,30,48,50],[0,0,48,30,48,50],[0,0,48,29,48,49],[0,0,48,30,48,50]],"parts":{}},
};

/** 编辑器和运行时共享 .lh 的矩形与层级；可选配饰节点默认隐藏，由具体组合选中。 */
export function productionEnemyFrames(clip) {
    const profile = profiles[clip.mapping];
    if (!profile || profile.poses.length !== clip.frameCount) throw new Error('怪物逐帧校准缺失:' + clip.mapping);
    return clip.frameIds.map((id, i) => {
        const [x, y, hx, hy, sx, sy] = profile.poses[i];
        const parts = Object.entries(profile.parts).map(([name, [anchor, dx, dy, size, behind]]) => ({
            name: 'Accessory_' + name, frame: 'enemy_acc_' + name, x: (anchor === 'head' ? hx : sx) + dx,
            y: (anchor === 'head' ? hy : sy) + dy, width: size, height: size, visible: false, behind
        }));
        const nodes = behind => parts.filter(p => p.behind === behind).map(({ behind, ...node }) => node);
        return { name: 'Frame' + i, width: 96, height: 96, visible: i === 0, children: [
            ...nodes(true), { name: 'Body', frame: id, x, y, width: 96, height: 96 }, ...nodes(false),
            { name: 'HeadSocket', x: hx, y: hy, width: 0, height: 0 },
            { name: 'BackSocket', x: sx, y: sy, width: 0, height: 0 }
        ] };
    });
}
