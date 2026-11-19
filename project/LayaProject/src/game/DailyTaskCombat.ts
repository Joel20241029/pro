import type { CombatFeedback, Enemy } from "./BattleSimulation";
import { ENEMIES, EnemyKind } from "./GameConfig";

/** Captures rule outcomes, independent of presentation timing and frame speed. Only winning nights credit these counters. */
export class DailyTaskCombat {
    readonly kills = new Map<EnemyKind, number>();
    readonly casts = new Map<string, number>();
    readonly towers = new Set<number>();
    readonly arrows = new Set<number>();
    readonly frost = new Set<number>();
    gateHits = 0;
    splash = 0;

    cast(id: string) { this.casts.set(id, (this.casts.get(id) ?? 0) + 1); }

    observe(events: readonly CombatFeedback[]) {
        for (const event of events) {
            switch (event.type) {
                case "gate": this.gateHits++; break;
                case "shot":
                    this.towers.add(event.shot.tower);
                    if (event.shot.kind === "ARROW") this.arrows.add(event.target);
                    if (event.shot.kind === "STONE") this.splash = Math.max(this.splash, event.hurt.length);
                    this.countKills(event.hurt);
                    break;
                case "blast":
                case "handSpeed":
                case "mercy":
                case "poison": this.countKills(event.hurt); break;
                case "patrol":
                case "summon": this.countKills([event.enemy]); break;
                case "zhouLove": if (event.cleared) this.countKills(event.targets); break;
            }
        }
    }

    private countKills(enemies: readonly Enemy[]) {
        for (const { kind, hp } of enemies)
            if (hp <= 0) this.kills.set(kind, (this.kills.get(kind) ?? 0) + 1);
    }

    get totalKills() { return [...this.kills.values()].reduce((sum, count) => sum + count, 0); }
    get ordinaryTypes() { return [...this.kills.keys()].filter(kind => !ENEMIES[kind].boss).length; }
    get totalCasts() { return [...this.casts.values()].reduce((sum, count) => sum + count, 0); }
}
