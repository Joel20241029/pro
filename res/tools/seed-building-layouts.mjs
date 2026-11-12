import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 首次搭建/明确重做时才运行；之后 .lh 是唯一布局源，日常构建不覆盖编辑器人工调整。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../editor/BuildingWorkshop/assets/buildingAuthoring');
const layouts = [];
const part = (name, frame, x, y, width, height) => ({ name, frame: frame.startsWith('part_') ? frame : 'module_' + frame, x, y, width, height });
const box = (name, x, y, width, height) => ({ name, x, y, width, height });
for (const kind of ['HOUSE', 'FARM', 'LOGGING', 'GATE', 'ARROW', 'STONE', 'SLOW']) {
    for (let stage = 1; stage <= 12; stage++) for (const rooms of kind === 'HOUSE' ? [1, 2, 3] : [1]) {
        const tier = Math.floor((stage - 1) / 4), step = (stage - 1) % 4;
        const nodes = [], add = (...args) => nodes.push(part(...args));
        const roof = stage < 4 ? 'thatch' : stage < 8 ? 'tile' : 'slate';
        let footprint = box('Footprint', 22, 99, 84, 21), above = null;
        if (kind === 'HOUSE') {
            const w = rooms > 1 ? 64 : 80, left = rooms > 1 ? 18 : 24;
            const tall = stage >= 7, wallTop = tall ? 68 : 65 - step * 2;
            add('Foundation', 'foundation', 18, 105, 92, 15);
            add('MainWall', 'plaster', left, wallTop, w, 113 - wallTop);
            add('Door', 'door', left + w * .4, 80, 27, 35);
            add('Window', 'window', left + 5, 82, 20, 21);
            add('MainRoof', roof, left - 9, wallTop - 33, w + 18, 45);
            if (tall) {
                add('UpperRoom', 'plaster', left + 7, 39, w - 8, 37);
                add('UpperWindow', 'window', left + 17, 46, 22, 23);
                add('UpperRoof', roof, left - 5, 13, w + 15, 42);
                add('UpperBalcony', 'porch_rail', left + 4, 68, w - 3, 17);
                if (stage >= 11) { add('TopGableWall', 'plaster', left + 23, 36, 28, 24); add('TopGableWindow', 'window', left + 29, 42, 14, 15); add('TopGableRoof', roof, left + 16, 25, 43, 21); }
            } else if (stage >= 3) add('Porch', 'porch', left + 14, 82, w - 10, 32);
            if (step === 1) add('SideAwning', 'porch', left - 3, 82, 26, 28);
            if (step === 2 && !tall) { add('GableWall', 'plaster', left + 18, wallTop - 18, 30, 24); add('GableRoof', roof, left + 12, wallTop - 30, 43, 27); }
            if (step === 3 && tall) add('Porch', 'porch', left + 11, 85, w - 6, 29);
            if (rooms >= 2) {
                add('WingWall', 'plaster', 80, 82, 30, 32); add('WingDoor', 'door', 87, 91, 16, 24);
                add('WingRoof', roof, 74, 64, 44, 31);
            }
            if (rooms === 3) {
                const y = tall ? 16 : 32;
                add('ExpansionRoom', 'plaster', left + 10, y + 13, 35, 29);
                add('ExpansionWindow', 'window', left + 18, y + 21, 15, 15);
                add('ExpansionRoof', roof, left + 2, y, 51, 29);
            }
        } else if (kind === 'FARM') {
            footprint = box('Footprint', 0, 0, 0, 0);
            const columns = tier === 0 ? 2 : 3, rows = stage === 1 ? 2 : 3;
            const pw = 103 / columns, ph = 76 / rows;
            for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++)
                add(`Plot_${r}_${c}`, 'field', 12 + c * pw, 37 + r * ph, pw - 3, ph + 3);
            if (stage >= 3) add('Channel', 'trough', 10, step % 2 ? 110 : 91, 108, 10);
            if (tier > 0) add('MiddleChannel', 'trough', 10, step % 2 ? 61 : 84, 108, 8);
            if (tier === 2) add('SideChannel', 'trough', 10, 37, 108, 8);
            // 水车放在右侧垄沟，顶边不跨村墙；独立脚底/底座让人物能从其前后经过。
            if (stage >= 5) above = { name: 'AboveGround', sort: { x: 104, y: 93 }, footprint: box('Footprint', 91, 85, 26, 8), nodes: [part('Wheel', 'wheel', 82, 49, 44, 44)] };
        } else if (kind === 'LOGGING') {
            const tall = stage >= 9, top = tall ? 62 : 67 - tier * 5 - step;
            add('Foundation', 'foundation', 18, 105, 92, 15);
            add('WorkBay', 'workshop', 24, top, 78, 113 - top);
            add('Roof', roof, 16, top - 30, 96, 43);
            add('Logs', 'logs', 67, 88, 37, 27);
            if (stage >= 3) add('SawBench', 'saw', 27, 88, 38, 29);
            if (step === 1) add('LoadingPorch', 'porch', 13, 79, 44, 36);
            if (step === 2) add('TimberRack', 'logs', 17, 91, 42, 25);
            if (step === 3) add('WorkingCanopy', 'porch', 40, 71, 67, 43);
            if (tall) {
                add('Loft', 'plaster', 41, 32, 46, 34);
                add('LoftWindow', 'window', 53, 43, 17, 17);
                add('LoftRoof', stage === 12 ? 'pagoda' : 'slate', 32, 13, 66, 35);
            }
            if (stage >= 7) add('Wheel', 'wheel', 80, 69, 31, 39);
        } else if (kind === 'GATE') {
            footprint = box('Footprint', 12, 100, 104, 20);
            add('Foundation', 'foundation', 11, 107, 106, 13);
            add('Arch', tier === 0 ? 'woodgate' : 'stonegate', 22, 68, 84, 47);
            add('GateDoors', 'door', 44, 78, 40, 37);
            add('Roof', roof, 13, 39, 102, 43);
            if (stage >= 8) {
                add('WatchRoom', 'plaster', 36, 50, 57, 27);
                add('WatchWindow', 'window', 49, 55, 14, 15);
                add('UpperRoof', stage >= 11 ? 'pagoda' : 'slate', 24, 29, 81, 33);
            }
            if (step === 1) { add('LeftPillar', 'masonry', 16, 87, 19, 28); add('RightPillar', 'masonry', 93, 87, 19, 28); }
            if (step === 2) add('PorchRoof', roof, 24, 62, 80, 30);
            if (step === 3) { add('LeftBanner', 'part_banner', 15, 73, 15, 29); add('RightBanner', 'part_banner', 98, 73, 15, 29); }
        } else if (kind === 'ARROW') {
            const deckY = tier === 0 ? 62 - step * 3 : tier === 1 ? 48 - step * 2 : 39;
            const width = tier === 0 ? 66 + step * 3 : tier === 1 ? 78 + step * 2 : [86, 90, 84, 94][step];
            add('Foundation', 'foundation', 22, 105, 84, 15);
            add('TimberStructure', 'lattice', 26, deckY + 3, 76, 112 - deckY);
            if (tier > 0) add('SecondFloor', 'floor', 22, 77, 84, 17);
            if (step === 2) add('LowerBalcony', 'balcony', 25, 86, 78, 21);
            add('Platform', 'floor', 64 - width / 2, deckY, width, 20);
            if (tier === 2) add('ReinforcedBase', 'masonry', 39, 91, 50, 22);
            // 发射口在独立武器节点中，随方向/动画变换；前栏杆在武器之后盖住底座。
            const weapons = stage >= 11 ? 2 : 1, weaponW = weapons === 2 ? 42 : 56 + tier * 3;
            const weaponNodes = [];
            for (let i = 0; i < weapons; i++) weaponNodes.push(part('Bow' + i, 'ballista', weapons === 2 ? 5 + i * 35 : 11, 0, weaponW, 39));
            weaponNodes.push(box('Muzzle', weapons === 2 ? 80 : 11 + weaponW * .95, 19, 0, 0));
            nodes.push({ name: 'Weapon', x: 64, y: deckY + 11, width: 86, height: 39, pivotX: 43, pivotY: 39, children: weaponNodes });
            add('FrontRailing', 'balcony', 64 - width / 2, deckY + 10, width, 22);
            if (stage >= 6) { add('BannerLeft', 'part_banner', 18, 64, 17, 30); add('BannerRight', 'part_banner', 94, 64, 17, 30); }
        } else if (kind === 'STONE') {
            const top = tier === 0 ? 77 - step * 2 : tier === 1 ? 65 - step * 2 : 54 - step;
            const w = tier === 2 ? 92 + step * 2 : 76 + tier * 4 + step;
            add('Footing', 'foundation', 20, 104, 88, 16);
            add('RoundTower', 'round_body', 64 - w / 2, top, w, 116 - top);
            if (tier === 2) add('MidRing', 'foundation', 20, 92, 88, 13);
            add('RoundPlatform', 'battlement', tier === 2 ? 12 : 18, top - 7, tier === 2 ? 104 : 92, 27);
            nodes.push({ name: 'Weapon', x: 64, y: top + 9, width: 66, height: 49, pivotX: 33, pivotY: 49,
                children: [part('Sling', 'sling', 0, 0, 66, 49), box('Muzzle', 33, 27, 0, 0)] });
            if (step === 1) add('ThickBase', 'foundation', 20, 102, 88, 18);
            if (step === 2) { add('LeftBrace', 'masonry', 22, 94, 16, 21); add('RightBrace', 'masonry', 90, 94, 16, 21); }
            if (step === 3) add('FrontCrest', 'part_crest', 53, 91, 22, 24);
        } else if (kind === 'SLOW') {
            const roofY = tier === 0 ? 50 - step * 2 : tier === 1 ? 41 - step : 31 - step;
            add('Footing', 'foundation', 24, 105, 80, 15);
            add('Pavilion', 'workshop', 34, roofY + 26, 61, 86 - roofY);
            if (tier > 0) add('LowerEave', 'canopy_teal', 18, 79, 92, 31);
            if (tier === 2) add('UpperRoom', 'workshop', 39, 59, 52, 30);
            add('MainCanopy', stage >= 4 ? 'canopy_teal' : 'canopy_thatch', 16, roofY, 96, 36);
            if (tier === 2) add('MiddleTier', 'canopy_teal', 20, 55, 88, 31);
            if (step === 1) add('Balcony', 'balcony', 29, 90, 70, 18);
            if (step === 2) add('MiddleEave', 'canopy_teal', 26, roofY + 30, 76, 25);
            if (step === 3) { add('BannerLeft', 'part_banner', 17, 81, 16, 28); add('BannerRight', 'part_banner', 95, 81, 16, 28); }
            const crystalW = tier === 0 ? 24 : tier === 1 ? 34 : 42;
            nodes.push({ name: 'Weapon', x: 64, y: roofY + 10, width: crystalW, height: 31, pivotX: crystalW / 2, pivotY: 31,
                children: [part('Crystal', 'crystal', 0, 0, crystalW, 31), box('Muzzle', crystalW / 2, 6, 0, 0)] });
            add('CoreCrest', 'part_crest', 53, 92, 22, 23);
        }
        layouts.push({ id: `${kind}_${stage}_${rooms}`, kind, stage, rooms, nodes, footprint, above,
            // 静止构图与动画包围盒另由转换器根据真实部件/旋转轨迹校验。
            visual: box('VisualBounds', -4, -10, 136, 138), sort: { x: 64, y: 120 } });
    }
}
fs.mkdirSync(root, { recursive: true });
fs.writeFileSync(path.join(root, 'layout-seeds.json'), JSON.stringify({ canvas: 128, layouts }, null, 2) + '\n');
console.log(`Seeded ${layouts.length} variants for seven native prefabs; use Laya BuildVillageBuildings.`);
