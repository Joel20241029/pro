import { BattleSimulation, Enemy, Shot } from "../src/game/BattleSimulation";
import { ENEMIES, PADS, RULE, TOWERS, TowerKind } from "../src/game/GameConfig";
import { createGame, applyCommand } from "../src/game/VillageRules";
import { FIXED_NIGHT, WAVE } from "../src/config/DefenseConfig";

let passed = 0;
function ok(value: unknown, reason: string): asserts value { if (!value) throw new Error(reason); }
function test(name: string, f: () => void) { f(); passed++; console.log("PASS", name); }
const kinds: TowerKind[] = ["ARROW", "STONE", "SLOW"];
/** 中性操作员排除远见、弓术、精英和村规加成，只检查塔位本身。 */
function battleAt(index: number, kind: TowerKind) {
    const s = createGame(17);
    s.people.forEach(p => { p.traits = ["trait_frugal"]; p.quality = "COMMON"; });

    s.towers = PADS.map((_, i) => ({ kind: i === index ? kind : null, level: i === index ? 1 : 0, operator: i === index ? s.people[0].id : null }));
    applyCommand(s, { type: "NIGHT" });
    // 只核验塔位射程，让单个测试靶走完整条路。
    delete s.night!.activeHero;
    s.wave = { ...s.wave!, budget: ENEMIES.enemy_raider.cost, affix: "NONE", entries: [{ kind: "enemy_raider", tick: 0, appearanceSeed: 1 }] };
    return new BattleSimulation(s);
}
/** 高耐久测试靶从入口完整走到城门，让后排塔也有目标；仅测试夹具增加 HP，不修改正式敌人数值。 */
function durableRunner(): Enemy {
    return { seq: 100, appearanceSeed: 1, kind: "enemy_runner", progress: 0, hp: 1000000, maxHp: 1000000, speed: ENEMIES.enemy_runner.speed * FIXED_NIGHT.enemySpeed * 1.1, slow: 0, slowTicks: 0, walkDistance: 0, born: 0, summoned: 0 };
}
function collectShots(battle: BattleSimulation): Shot[] {
    const shots: Shot[] = [];
    while (!battle.outcome && battle.tick < 6000) {
        const tick = battle.tick; battle.step();
        for (const shot of battle.shots.filter(s => s.tick === tick)) {
            const origin = PADS[shot.tower];
            ok(Math.hypot(shot.x - origin.x, shot.y - origin.y) <= TOWERS[shot.kind].range + 1e-7, "unboosted shot exceeded its configured range");
            shots.push(shot);
        }
    }
    ok(battle.outcome !== null, "battle failed to terminate");
    return shots;
}

test("Every pad can fire all three tower types at a real enemy passing along the path", () => {
    for (let i = 0; i < PADS.length; i++) for (const kind of kinds) {
        const shots = collectShots(battleAt(i, kind));
        ok(shots.length > 0, `pad ${i} / ${kind} never fired`);
        ok(shots.every(s => s.tower === i && s.kind === kind), "a disabled tower fired");
    }
});

test("Every pad attacks even a durable FAST runner before it leaves that tower's range", () => {
    for (let i = 0; i < PADS.length; i++) for (const kind of kinds) {
        const battle = battleAt(i, kind); battle.base.wave!.entries = []; battle.enemies.push(durableRunner());
        const shots = collectShots(battle);
        ok(shots.length > 0, `pad ${i} / ${kind} never fired on the fastest runner`);
    }
});

test("All five staffed towers participate when one durable enemy crosses the complete path", () => {
    const battle = battleAt(0, "ARROW");
    battle.base.towers = PADS.map((_, i) => ({ kind: kinds[i % kinds.length], level: 1, operator: battle.base.people[i].id }));
    battle.base.wave!.entries = []; battle.enemies.push(durableRunner());
    const shots = collectShots(battle), participating = new Set(shots.map(s => s.tower));
    ok(participating.size === PADS.length, `only ${participating.size} pads participated`);
});

test("Relocated towers still require an operator before they can attack", () => {
    for (let i = 0; i < PADS.length; i++) {
        const battle = battleAt(i, "ARROW"); battle.base.towers[i].operator = null;
        ok(collectShots(battle).length === 0, "an unstaffed tower fired");
        const gateDamage = Math.ceil(ENEMIES.enemy_raider.gate * (WAVE.ordinaryGateScale * FIXED_NIGHT.ordinaryGateDamage));
        ok(battle.gate === RULE.gateMax - gateDamage, "the enemy did not reach the gate");
    }
});
console.log(`${passed} tower coverage checks passed`);
