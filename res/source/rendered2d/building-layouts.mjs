/** 高清建筑128逻辑画布的制作布局。只是贴图、挂点和范围，不参与升级价格/战斗。
 * 每类一个prefab，四个完整结构主体对应1/4/8/12级，其余等级增加结构件。
 * 所有档位保持(64,120)足点；静止底座不镜像，弩机使用独立左右原图。
 */
const picture = (name, frame, x, y, width, height) => ({ name, frame, x, y, width, height });
const region = (name, x, y, width, height) => ({ name, x, y, width, height, visible: false });
const component = (name, part, x, y, width, height) => picture(name, 'hd_part_' + part, x, y, width, height);
const major = [1, 4, 8, 12];
export function productionBuildings() {
    const result = {};
    for (const kind of ['HOUSE', 'FARM', 'LOGGING', 'GATE', 'ARROW', 'STONE', 'SLOW']) {
        const variants = [];
        for (let stage = 1; stage <= 12; stage++) for (const rooms of kind === 'HOUSE' ? [1, 2, 3] : [1]) {
            const tier = stage >= 12 ? 3 : stage >= 8 ? 2 : stage >= 4 ? 1 : 0, step = stage - major[tier];
            const nodes = [], bodyFrame = `hd_${kind.toLowerCase()}_body_${tier}`;
            let footprint = [12, 99, 104, 21], above = null;
            if (kind === 'HOUSE') {
                const size = rooms > 1 ? 101 : 116, x = rooms > 1 ? 7 : 6, y = 120 - size * 15 / 16;
                if (rooms === 3) nodes.push(picture('RearWing', `hd_house_wing_${tier}`, 66, 43, 58, 58));
                nodes.push(picture('MainHouse', bodyFrame, x, y, size, size));
                if (rooms >= 2) nodes.push(picture('SideWing', `hd_house_wing_${tier}`, 78, 75, 46, 46));
                if (step >= 1) nodes.push(component('WallTimbers', 'brace', 16, 86, 18, 24));
                if (step >= 2) nodes.push(component('PorchLantern', 'lantern', 84, 70, 15, 26));
                if (step >= 3) nodes.push(component('RoofEmblem', 'crest', 43, 38, 30, 18));
                footprint = [8, 98, 112, 22];
            } else if (kind === 'FARM') {
                nodes.push(picture('CropGround', bodyFrame, 0, 0, 128, 128)); footprint = [0, 0, 0, 0];
                if (step >= 1) nodes.push(component('GrainCrate', 'grain', 8, 80, 21, 24));
                if (step >= 2) nodes.push(component('GrainCrate2', 'grain', 14, 50, 18, 21));
                if (step >= 3) nodes.push(component('CrateBrace', 'brace', 12, 84, 18, 20));
                if (stage >= 5) above = { name: 'AboveGround', x: 104, y: 93, width: 0, height: 0,
                    children: [component('WaterWheel', 'wheel', -22, -43, 44, 44)] };
            } else if (kind === 'LOGGING') {
                nodes.push(picture('Workshop', bodyFrame, 4, 7.5, 120, 120));
                if (step >= 1) nodes.push(component('TimberBracing', 'brace', 22, 84, 28, 29));
                if (step >= 2) nodes.push(component('SawWheel', 'wheel', 84, 79, 28, 33));
                if (step >= 3) nodes.push(component('WorkshopEmblem', 'crest', 42, 43, 30, 18));
            } else if (kind === 'GATE') {
                nodes.push(picture('GateStructure', bodyFrame, 0, 0, 128, 128));
                nodes.push(picture('GateDoors', `hd_gate_doors_${tier}`, 38, 67, 52, 54));
                if (step >= 1) nodes.push(component('DoorRivet', 'rivet', 48, 83, 14, 13));
                if (step >= 2) nodes.push(component('GateEmblem', 'crest', 45, 47, 38, 20));
                if (step >= 3) nodes.push(component('GateBanner', 'banner', 99, 78, 17, 30));
                footprint = [10, 96, 108, 24];
            } else {
                // 主体整图保留木石结构与光照，武器另外绘制/动画。
                const bodySize = [104, 112, 119, 124][tier];
                nodes.push(picture('TowerStructure', bodyFrame, (128 - bodySize) / 2, 120 - bodySize * 15 / 16, bodySize, bodySize));
                if (step >= 1) {
                    if (kind === 'STONE') nodes.push(component('StoneButtressLeft', 'foundation', 25, 95, 19, 25), component('StoneButtressRight', 'foundation', 84, 95, 19, 25));
                    else if (kind === 'SLOW') nodes.push(component('ColumnPlateLeft', 'rivet', 38, 81, 11, 13), component('ColumnPlateRight', 'rivet', 81, 81, 11, 13));
                    else nodes.push(component('Reinforcement', 'brace', 42, 80, 36, 35));
                }
                if (step >= 2) nodes.push(component('HonorBanner', 'banner', 20, 71, 18, 34));
                if (step >= 3) nodes.push(component('FrontEmblem', 'crest', 49, 81, 27, 19));
                const deck = kind === 'ARROW' ? [53, 42, 34, 25][tier] : kind === 'STONE' ? [64, 56, 48, 40][tier] : [43, 33, 25, 16][tier];
                const weapon = { name: 'Weapon', x: 64, y: deck + 8, width: 80, height: 44, anchorX: .5, anchorY: 1, clip: 'attack', children: [] };
                if (kind === 'ARROW') for (const facing of ['Right', 'Left']) {
                    const children = [], pair = tier === 3;
                    for (let n = 0; n < (pair ? 2 : 1); n++) children.push(component('Crossbow' + n, 'bow_' + facing.toLowerCase(), pair ? n * 34 + 3 : 8, pair ? 8 : 0, pair ? 39 : 64, pair ? 34 : 44));
                    children.push({ name: 'Muzzle', x: facing === 'Right' ? 72 : 8, y: pair ? 20 : 15, width: 0, height: 0 });
                    weapon.children.push({ name: 'Facing' + facing, x: 0, y: 0, width: 80, height: 44, visible: facing === 'Right', children });
                } else {
                    weapon.children.push(component(kind === 'STONE' ? 'Sling' : 'CrystalCore', kind === 'STONE' ? 'sling' : 'crystals', kind === 'STONE' ? 9 : 23, 0, kind === 'STONE' ? 62 : 34, 44));
                    weapon.children.push({ name: 'Muzzle', x: 40, y: kind === 'STONE' ? 24 : 9, width: 0, height: 0 });
                }
                nodes.push(weapon);
                footprint = [22, 100, 84, 20];
            }
            const children = [{ name: 'Body', x: 64, y: 120, width: 128, height: 128, anchorX: .5, anchorY: 15 / 16, clip: 'upgrade', children: nodes },
                // 包含最高寒塔、1.08倍升级峰值与武器后坐；导航仍只使用独立Footprint。
                region('VisualBounds', -12, -44, 152, 178), region('Footprint', ...footprint), region('SortOrigin', 64, 120, 0, 0)];
            if (above) children.push(above, region('AboveFootprint', 91, 85, 26, 8));
            variants.push({ name: `${kind}_${stage}_${rooms}`, width: 128, height: 128, visible: stage === 1 && rooms === 1, children });
        }
        result[kind] = { name: kind, width: 128, height: 128, children: variants };
    }
    return result;
}
