import { Person } from "../game/GameState";

/** 出生阶段的一条纯视觉提示。时长和间隔使用白天场景秒，不改变成长或照料。 */
export const CRY = { delayAfterBirth: .35, firstRepeat: 14, repeat: 18, duration: 1.5, size: 51 } as const;

export class NewbornCry {
    current: string | null = null;
    elapsed = 0;
    private children: string[] | null = null;
    private newborn: string | undefined;
    private last: string | undefined;
    private wait: number = CRY.firstRepeat;

    sync(people: readonly Person[]) {
        const children = people.filter(p => !p.adult && p.growth === 0).map(p => p.id);
        if (this.children) {
            const added = children.find(id => !this.children!.includes(id));
            if (added) { this.newborn = added; this.wait = CRY.delayAfterBirth; }
        }
        this.children = children;
        if (this.newborn !== undefined && !children.includes(this.newborn)) this.newborn = undefined;
        if (this.current !== null && !children.includes(this.current)) this.dismiss();
    }
    dismiss() { this.current = null; this.elapsed = 0; }
    advance(seconds: number, quiet: boolean, visible: (id: string) => boolean) {
        this.wait -= seconds;
        if (this.current !== null) {
            this.elapsed += seconds;
            if (this.elapsed >= CRY.duration || !visible(this.current)) this.dismiss();
        }
        if (quiet && !this.current && this.wait <= 0) {
            const candidates = this.children?.filter(visible) ?? [];
            const id = this.newborn && visible(this.newborn) ? this.newborn :
                candidates.find(id => id !== this.last) ?? candidates[0];
            if (id) {
                this.current = this.last = id;
                this.elapsed = 0;
                if (id === this.newborn) this.newborn = undefined;
                this.wait = CRY.repeat;
            }
        }
    }
}
