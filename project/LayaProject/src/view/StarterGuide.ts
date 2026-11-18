import { tacticDefinition, SUMMON_TACTIC } from "../config/TacticConfig";
import { StoragePort } from "../storage/SaveStore";
import { GameLayout } from "./GameLayout";
import { SpriteFrames } from "./SpriteFrames";
import { UiWidgets } from "./UiWidgets";
import { C } from "./UiTheme";
import { STARTER_LESSONS } from "./config/StarterGuideConfig";

/** 设备已显示到的引导波次。跳过时记到最后一波，与村落存档独立。 */
const KEY = "daidai_village.starter_guide";
/** 720 逻辑宽度下的提示卡，底部与守夜按钮错开。显示时间按前台帧推进。 */
const CARD = { width: 600, inset: 20, portrait: 70, gap: 16, seconds: 8, actionHeight: 54 };
/** 42% 纯黑仍保留地图细节。逻辑像素留白与金边只影响显示，点击沿用原入口。 */
const SPOT = { shade: "rgba(0,0,0,0.42)", edge: "#ffe29d", inset: 8, line: 3 };

export class StarterGuide {
    readonly node = new Laya.Sprite();
    readonly spotlight = new Laya.Sprite();
    private topLeft = new Laya.Point();
    private bottomRight = new Laya.Point();
    private cutout = "";
    private seen: number | null = null;
    private activeWave = 0;
    private remaining = 0;

    constructor(private storage: StoragePort, private art: SpriteFrames, private ui: UiWidgets) {
        this.node.name = "ZhizhuoStarterGuide";
        this.node.mouseEnabled = true;
        this.node.mouseThrough = true;
        this.node.visible = false;
        this.spotlight.name = "ZhizhuoSpotlight";
        this.spotlight.mouseEnabled = false;
        this.spotlight.visible = false;
    }

    hide() {
        if (!this.node.visible) return;
        this.node.visible = false;
        this.spotlight.visible = false;
        this.node.destroyChildren();
        this.activeWave = 0;
    }

    tick(wave: number | null, layout: GameLayout, seconds: number, target?: Laya.Sprite) {
        if (wave === null || wave < 1 || wave > STARTER_LESSONS.length) { this.hide(); return; }
        if (this.activeWave !== wave) this.hide();
        if (this.seen === null) {
            this.seen = 0;
            try {
                const seen = Number(this.storage.read(KEY));
                if (Number.isInteger(seen) && seen >= 0 && seen <= STARTER_LESSONS.length) this.seen = seen;
            } catch (error) { console.warn("[智卓引导] 无法读取查看记录", error); }
        }
        if (wave > this.seen) this.show(wave);
        if (!this.node.visible) return;
        this.layoutCard(layout, target);
        this.remaining -= seconds;
        if (this.remaining <= 0) this.hide();
    }

    private layoutCard(layout: GameLayout, target?: Laya.Sprite) {
        const root = this.node.parent as Laya.Sprite;
        const x = (root.width - this.node.width) / 2, y = layout.footerTop - this.node.height - CARD.gap;
        this.node.pos(x, y);
        this.spotlight.visible = false;
        if (!target?.visible) return;
        target.localToGlobal(this.topLeft.setTo(0, 0), false, root);
        target.localToGlobal(this.bottomRight.setTo(target.width, target.height), false, root);
        const left = Math.max(0, this.topLeft.x - SPOT.inset), top = Math.max(0, this.topLeft.y - SPOT.inset);
        const right = Math.min(root.width, this.bottomRight.x + SPOT.inset), bottom = Math.min(root.height, this.bottomRight.y + SPOT.inset);
        if (right <= left || bottom <= top) return;
        if (x < right && x + this.node.width > left && y < bottom && y + this.node.height > top) {
            const above = top - CARD.gap - this.node.height;
            this.node.y = above >= layout.safeTop ? above : bottom + CARD.gap;
        }
        this.spotlight.visible = true;
        const bounds = [root.width, root.height, left, top, right, bottom].join(",");
        if (bounds === this.cutout) return;
        this.cutout = bounds;
        const g = this.spotlight.graphics;
        g.clear();
        g.drawRect(0, 0, root.width, top, SPOT.shade);
        g.drawRect(0, bottom, root.width, root.height - bottom, SPOT.shade);
        g.drawRect(0, top, left, bottom - top, SPOT.shade);
        g.drawRect(right, top, root.width - right, bottom - top, SPOT.shade);
        g.drawRect(left, top, right - left, bottom - top, null, SPOT.edge, SPOT.line);
    }

    private saveSeen(wave: number) {
        this.seen = wave;
        try { this.storage.write(KEY, String(wave)); }
        catch (error) { console.warn("[智卓引导] 无法保存查看记录", error); }
    }

    private show(wave: number) {
        const lesson = STARTER_LESSONS[wave - 1], { width, inset, portrait, gap, actionHeight } = CARD;
        const paper = new Laya.Sprite();
        paper.mouseEnabled = false;
        this.node.addChild(paper);
        this.ui.image(this.node, tacticDefinition(SUMMON_TACTIC).icon, inset, inset, portrait);
        const textX = inset + portrait + gap, textWidth = width - textX - inset;
        this.ui.label(this.node, "智卓", textX, 12, textWidth, 29, C.timber, true, 40);
        const text = this.ui.label(this.node, lesson.text, textX, 56, textWidth, 27, C.ink, false, 200);
        text.height = Math.ceil(text.textHeight) + 4;
        const actionTop = Math.max(inset + portrait, text.y + text.height) + gap;
        const height = actionTop + actionHeight + inset;
        this.art.panel(paper, "panel_card", width, height);
        this.ui.button(this.node, "跳过引导", inset, actionTop, 166, () => {
            this.saveSeen(STARTER_LESSONS.length);
            this.hide();
        }, C.muted, actionHeight);
        this.ui.button(this.node, "知道了", width - inset - 146, actionTop, 146, () => this.hide(), C.green, actionHeight);
        this.node.size(width, height);
        this.activeWave = wave;
        this.remaining = CARD.seconds;
        this.node.visible = true;
        this.saveSeen(wave);
    }
}
