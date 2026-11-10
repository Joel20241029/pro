/** 三条可序列化的 uint32 随机流；LCG 参数来自技术文档，不使用渲染时间决定游戏结果。 */
export class SeededRandom {
    constructor(public state: number) {}
    next(): number { return this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0; }
    range(n: number): number {
        if (!Number.isInteger(n) || n < 1 || n > 0x100000000) throw new Error("随机范围无效");
        const limit = Math.floor(0x100000000 / n) * n;
        let v: number; do { v = this.next(); } while (v >= limit);
        return v % n;
    }
    choices<T>(values: T[], n: number): T[] {
        const a = values.slice();
        for (let i = 0; i < n; i++) { const j = i + this.range(a.length - i); [a[i], a[j]] = [a[j], a[i]]; }
        return a.slice(0, n);
    }
}
