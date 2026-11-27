import { GameState, isExploring, Person, Tower } from "../game/GameState";

/** doc/tech/46：地图最多20人，业务人口仍按住宅全量结算。白天实景只有6个田间站点、
 * 5棵可伐木树（保留1棵供轮换），不因扩建生成重叠工人；夜间不受生产站点限制。
 */
export const RESIDENT_DISPLAY = { limit: 20, farmers: 6, loggers: 4 } as const;

/** 稳定选取地图演员，不复制或改写村民数据；正在庆祝的夫妻作为整体选择。 */
export class VisibleResidents {
    private run: number | null = null;
    private selected: string[] = [];
    private families = new Set<string>();
    select(state: GameState, towers: Tower[], celebrating: readonly string[], focus?: string): Person[] {
        const fresh = this.run !== state.run;
        if (fresh) { this.selected = []; this.families.clear(); this.run = state.run; }
        const people = state.people.filter(p => !isExploring(state, p.id));
        const groups = new Map<string, Set<string>>();
        for (const p of people) groups.set(p.id, new Set([p.id]));
        const join = (ids: readonly string[]) => {
            const united = new Set<string>();
            for (const id of ids) for (const member of groups.get(id) || []) united.add(member);
            for (const id of united) groups.set(id, united);
        };
        const newcomers = fresh ? [] : state.families.filter(f => !this.families.has(f.id)).reduce<string[]>((ids, f) => ids.concat(f.partners), []);
        for (const f of state.families) if (f.partners.some(id => celebrating.includes(id) || newcomers.includes(id))) join(f.partners);
        this.families = new Set(state.families.map(f => f.id));
        const byId = new Map(people.map(p => [p.id, p]));
        const priority = [...(focus ? [focus] : []), ...celebrating, ...newcomers, ...towers.reduce<string[]>((ids, t) => t.operator ? ids.concat(t.operator) : ids, []), ...this.selected, ...people.map(p => p.id)];
        const chosen = new Set<string>(), visited = new Set<Set<string>>();
        let farmers = 0, loggers = 0;
        for (const id of priority) {
            const group = groups.get(id);
            if (!group || visited.has(group)) continue;
            visited.add(group);
            const members = [...group].map(key => byId.get(key)!);
            const f = members.filter(p => p.job === "FARM").length, l = members.filter(p => p.job === "LOGGING").length;
            if (chosen.size + group.size > RESIDENT_DISPLAY.limit || (state.phase !== "NIGHT" &&
                (farmers + f > RESIDENT_DISPLAY.farmers || loggers + l > RESIDENT_DISPLAY.loggers))) continue;
            members.forEach(p => chosen.add(p.id)); farmers += f; loggers += l;
        }
        // 保留已有演员的池顺序，避免无关状态刷新导致人物交换节点、点击目标变化。
        this.selected = [...this.selected.filter(id => chosen.delete(id)), ...chosen];
        return this.selected.map(id => byId.get(id)!);
    }
}
