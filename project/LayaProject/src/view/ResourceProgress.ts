import { PreparationState } from "../platform/ResourcePreparation";

const themes = {
    launcher: { text: "#fff1ce", background: "#183121", trim: "#ac8a4b", fill: "#f1c764" },
    panel: { text: "#fff4d1", background: "#33471f", trim: "#bba057", fill: "#f1c764" }
} as const;

/** 只在整数百分比或提示变化时改绘制，守夜等待期间保持列表和按钮原位。 */
export class ResourceProgress extends Laya.Sprite {
    private readonly copy = new Laya.Text();
    private shownPercent = -1;
    private progressWidth = 0;
    constructor(private readonly theme: keyof typeof themes) {
        super();
        this.name = "ResourceProgress";
        this.mouseEnabled = this.copy.mouseEnabled = false;
        this.copy.name = "ResourceProgressText";
        this.copy.fontSize = 26;
        this.copy.color = themes[theme].text;
        this.copy.align = "center";
        this.copy.valign = "middle";
        this.addChild(this.copy);
    }

    setWidth(width: number) {
        if (width === this.progressWidth) return;
        this.progressWidth = width;
        this.shownPercent = -1;
        this.size(width, 62);
        this.copy.size(width, 38);
    }

    render(title: string, state: PreparationState) {
        const percent = Math.floor(state.progress * 100);
        const text = state.phase === "FAILED" ? title + "未完成 · 点击重试"
            : state.phase === "DECODE" ? "下载完成 · 正在载入素材"
            : state.phase === "READY" ? "准备完成"
            : (state.slow ? "网络较慢 · " : title + " · ") + percent + "%";
        if (text !== this.copy.text) this.copy.text = text;
        if (percent === this.shownPercent) return;
        this.shownPercent = percent;
        const skin = themes[this.theme], height = 16, y = 42;
        this.graphics.clear();
        this.graphics.drawRoundRect(0, y, this.progressWidth, height, 8, 8, 8, 8, skin.background, skin.trim, 2);
        const fill = (this.progressWidth - 6) * percent / 100;
        if (fill > 0) {
            const radius = Math.min(5, fill / 2);
            this.graphics.drawRoundRect(3, y + 3, fill, 10, radius, radius, radius, radius, skin.fill);
        }
    }

    watch(title: string, state: PreparationState) {
        const render = () => this.render(title, state);
        render();
        Laya.timer.frameLoop(1, this, render);
    }

    destroy(destroyChild = true) {
        Laya.timer.clearAll(this);
        super.destroy(destroyChild);
    }
}
