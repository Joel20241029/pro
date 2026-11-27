import { AnchoredTip } from "./AnchoredTip";
import { SpriteFrames } from "./SpriteFrames";
import { HUD } from "./config/HudConfig";

/** 白天主界面可操作时才累计。周期只影响引导，点按仍走已有守夜确认。 */
const REMINDER = { firstSeconds: 30, repeatSeconds: 45, visibleSeconds: 2.5 } as const;

export class StartNightReminder extends AnchoredTip {
    private day = 0;
    private remaining: number = REMINDER.firstSeconds;
    private button: Laya.Sprite | null = null;
    private bounds = new Laya.Rectangle();
    constructor(art: SpriteFrames) {
        super(art, 316, 62, 24, true, REMINDER.visibleSeconds);
        this.name = "StartNightReminder";
    }
    reset() {
        this.remaining = REMINDER.firstSeconds;
        this.hide();
    }
    tick(day: number, button: Laya.Sprite | null, seconds: number) {
        if (this.day !== day) { this.day = day; this.reset(); }
        this.button = button;
        if (!button) { this.hide(); return; }
        this.remaining -= seconds;
        if (this.remaining <= 0) {
            this.remaining = REMINDER.repeatSeconds;
            this.show("准备好了？点这里开始守夜", () => {
                const node = this.button!;
                // 气泡仍对准守夜圆钮中轴，指角停在底栏上沿，避开守夜预告。
                this.bounds.setTo(0, -HUD.footer.start.y, node.width, node.height);
                return { node, bounds: this.bounds };
            });
        }
        this.advance(seconds);
    }
}
