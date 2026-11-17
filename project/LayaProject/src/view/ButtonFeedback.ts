/** 720 逻辑画布下的按压比例与松手毫秒数。只改变按钮图文层，命中区域和操作时机沿用原入口。 */
const JELLY = { wide: 1.065, low: .89, releaseMs: 230 } as const;

export function reboundButton(face: Laya.Sprite) {
    Laya.Tween.killAll(face);
    Laya.Tween.create(face).duration(JELLY.releaseMs)
        .to("scaleX", 1).to("scaleY", 1).ease(Laya.Ease.elasticOut);
}

export function replayButtonPress(button: Laya.Sprite) {
    const face = button.getChildByName("buttonFace") as Laya.Sprite;
    face.scale(JELLY.wide, JELLY.low);
    reboundButton(face);
}

/** ScrollList 和地图热区共用拖动取消规则。只有带 face 的按钮播放果冻。 */
export function bindButtonClick(target: Laya.Sprite, action: (event: Laya.Event) => void, face?: Laya.Sprite) {
    const pressed = new Set<number>();
    target.mouseEnabled = true;
    if (face) face.pivot(target.width / 2, target.height / 2).pos(target.width / 2, target.height / 2);
    const reset = () => {
        pressed.clear();
        if (!face) return;
        Laya.Tween.killAll(face);
        face.scale(1, 1);
    };
    const release = () => { if (face && !pressed.size) reboundButton(face); };
    target.on(Laya.Event.MOUSE_DOWN, target, (e: Laya.Event) => {
        pressed.add(e.touchId);
        if (!face) return;
        Laya.Tween.killAll(face);
        face.scale(JELLY.wide, JELLY.low);
    });
    target.on(Laya.Event.MOUSE_UP, target, (e: Laya.Event) => { if (pressed.delete(e.touchId)) release(); });
    target.on(Laya.Event.MOUSE_OUT, target, (e?: Laya.Event) => {
        // 列表拖动已取消引擎点击，立即恢复按压层，避免手指上下拖动时卡在压扁状态。
        if (!e) { reset(); return; }
        if (pressed.delete(e.touchId)) {
            Laya.InputManager.cancelClick(e.touchId);
            release();
        }
    });
    target.on(Laya.Event.UNDISPLAY, target, reset);
    target.on(Laya.Event.CLICK, target, action);
}
