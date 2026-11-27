import { PreparationState } from "../platform/ResourcePreparation";
import { C } from "./UiTheme";

const themes = {
    launcher: { text: C.ink, background: C.paper, trim: C.outline, fill: C.fern },
    panel: { text: C.ink, background: C.blueArt, trim: C.lockedRim, fill: C.blue }
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
        this.copy.wordWrap = false;
        this.copy.overflow = Laya.Text.SHRINK;
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
        const percent = Math.floor(Math.max(0, Math.min(1, state.progress)) * 100);
        const text = state.phase === "UNSUPPORTED" ? state.error
            : state.phase === "FAILED" ? title + "未完成 · 点击重试"
            : state.phase === "DECODE" ? "下载完成 · 正在载入素材"
            : state.phase === "READY" ? "准备完成"
            : (state.slow ? "网络较慢 · " : title + " · ") + percent + "%";
        if (text !== this.copy.text) this.copy.text = text;
        if (percent === this.shownPercent) return;
        this.shownPercent = percent;
        const skin = themes[this.theme], height = 17, y = 39;
        this.graphics.clear();
        this.graphics.drawRoundRect(0, y, this.progressWidth, height, 8, 8, 8, 8, skin.background, skin.trim, 2);
        const fill = Math.max(0, this.progressWidth - 6) * percent / 100;
        if (fill > 0) {
            const x = 3, insetY = y + 3, fillHeight = height - 6;
            const radius = fillHeight / 2;
            if (fill < fillHeight) this.graphics.drawCircle(x + fill / 2, insetY + radius, fill / 2, skin.fill);
            else this.graphics.drawRoundRect(x, insetY, fill, fillHeight, radius, radius, radius, radius, skin.fill);
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
