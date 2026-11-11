/** 可序列化的 uint32 随机流；家庭与世界分别持有状态，不使用渲染时间决定游戏结果。 */
export class SeededRandom {
    constructor(public state: number) {}
    next(): number { return this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0; }
    range(n: number): number {
        if (!Number.isInteger(n) || n < 1 || n > 0x100000000) throw new Error("随机范围无效");
        // 接受区间分成 n 个等宽桶，避开 LCG 低位在固定抽样步长下锁定继承/精英结果的问题。
        // 拒绝区间与原算法相同，每个整数对应同样多的原始值；改变抽样规则须升级配置版本。
        const bucket = Math.floor(0x100000000 / n), limit = bucket * n;
        let v: number; do { v = this.next(); } while (v >= limit);
        return Math.floor(v / bucket);
    }
    choices<T>(values: T[], n: number): T[] {
        const a = values.slice();
        for (let i = 0; i < n; i++) { const j = i + this.range(a.length - i); [a[i], a[j]] = [a[j], a[i]]; }
        return a.slice(0, n);
    }
}
