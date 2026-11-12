/** 只供编辑器验收，传入正式 GameView 与内存 GameSession，不访问微信或真实存档。 */
export async function checkVillageInteraction(view: any, game: any, capture: (name: string) => Promise<void>) {
    const state = game.state, village = view.village, world = village.world as Laya.Sprite;
    const originalPeople = JSON.parse(JSON.stringify(state.people));
    const nodeOf = (id: string) => world.getChildByName("person:" + id) as Laya.Sprite;
    const center = (node: Laya.Sprite) => {
        const r = node.getGraphicBounds(false, new Laya.Rectangle());
        return node.localToGlobal(new Laya.Point(r.x + r.width / 2, r.y + r.height / 2));
    };
    const press = (point: Laya.Point) => {
        const local = view.root.globalToLocal(point, true);
        const node = Laya.InputManager.inst.getSpriteUnderPoint(view.root, local.x, local.y);
        if (!node) throw new Error("原生命中为空");
        const event = { touchId: 31, stageX: point.x, stageY: point.y };
        node.event(Laya.Event.MOUSE_DOWN, event);
        return { node, event };
    };
    const release = (down: ReturnType<typeof press>) => {
        down.node.event(Laya.Event.MOUSE_UP, down.event); down.node.event(Laya.Event.CLICK, down.event);
    };
    const place = (id: string, x: number, y: number, hidden = false) => {
        Object.assign(village.motion.get(id), { x, y, insideTower: hidden }); view.updateActors();
    };
    const isolate = (id: string) => {
        state.people.forEach((p: any, i: number) => Object.assign(village.motion.get(p.id), { x: 540 + i * 12, y: view.layout.footerTop - 90, insideTower: false }));
        place(id, 330, view.layout.footerTop - 48);
    };
    const assertPerson = (id: string) => {
        if (view.panels.current?.type !== "person" || view.panels.current.id !== id || !game.pauses.has("CHOICE")) throw new Error("打开了错误的人物或没有暂停");
    };
    if (state.phase === "DAY") {
        view.tip.show("木材不足"); view.tip.advance(.2); await capture("屏中Tip_短文案");
        view.tip.show("材料不足，请先安排村民耕作和伐木，储备足够的粮食与木材后再升级建筑。"); view.tip.advance(.2); await capture("屏中Tip_长文案");
        view.tip.advance(2); if (view.tip.visible) throw new Error("屏中Tip没有按原时长结束");

        Object.assign(state.people[1], { elite: true, name: "旭勇", nights: 18 });
        Object.assign(state.people[2], { nights: 0, elderNights: 3, job: "WAITING", careChild: null });
        Object.assign(state.people[4], { adult: false, growth: 1, elderNights: 0, job: "WAITING", skill: null, careChild: null });
        Object.assign(state.people[5], { adult: false, growth: 0, elderNights: 0, job: "WAITING", skill: null, careChild: null });
        view.refresh();
        for (const [index, label] of [[0, "成人"], [1, "精英"], [2, "老人"], [4, "孩子"], [5, "婴儿"]] as const) {
            const id = state.people[index].id; isolate(id);
            const before = JSON.stringify(state), node = nodeOf(id), at = center(node);
            if (index === 1) node.scaleX = -Math.abs(node.scaleX); // 原生镜像+精英缩放命中。
            const actualPoint = index === 1 ? center(node) : at;
            if (village.pickAt(actualPoint.x, actualPoint.y)?.personId !== id) throw new Error("人物自身范围选中错误");
            release(press(actualPoint)); assertPerson(id);
            if (before !== JSON.stringify(state)) throw new Error("查看详情改变业务数据");
            await capture("点击村民_" + label);
            const blocked = press(actualPoint);
            if (blocked.node.name.startsWith("person:")) throw new Error("详情面板没有拦截地图输入");
            // 只检查遮罩命中，不向面板发CLICK，以免触发里面的业务按钮。
            blocked.node.event(Laya.Event.MOUSE_UP, blocked.event);
            view.panels.close(); if (game.pauses.has("CHOICE")) throw new Error("关闭详情未恢复");
        }
        const first = state.people[0].id, back = state.people[3].id, y = view.layout.footerTop - 48;
        isolate(first); place(back, 330, y - 8);
        const at = center(nodeOf(back)), down = press(at);
        if (down.node !== nodeOf(back)) throw new Error("未覆盖原生命中后景节点的交叠场景");
        release(down); assertPerson(first); view.panels.close();

        isolate(first); place(back, 330, y - 8);
        const held = press(center(nodeOf(back)));
        // 通过活人数组换位触发固定池换人，保留家庭/驻塔引用，避免构造非法业务状态。
        [state.people[3], state.people[2]] = [state.people[2], state.people[3]]; view.refresh();
        release(held); if (view.panels.current) throw new Error("后景源节点换人后旧点击未取消");
        [state.people[3], state.people[2]] = [state.people[2], state.people[3]]; view.refresh();

        isolate(first);
        const tree = world.getChildByName("tree:logging") as Laya.Sprite;
        place(first, tree.x, tree.y - 8);
        const hiddenAt = center(nodeOf(first));
        if (village.pickAt(hiddenAt.x, hiddenAt.y) !== null) throw new Error("前景树木未挡住后面的人");
        release(press(hiddenAt)); if (view.panels.current) throw new Error("点击穿透了树木");

        const house = world.getChildByName("building:house-a") as Laya.Sprite;
        place(first, house.x, house.y - 5);
        release(press(center(nodeOf(first))));
        if (!view.anchoredTip.visible || view.anchoredTip.getChildByName("AnchoredTipText").text !== "佟楼") throw new Error("人物后景点击破坏了民房气泡");
        place(first, house.x, house.y + 12);
        release(press(center(nodeOf(first)))); assertPerson(first);
        if (view.anchoredTip.visible) throw new Error("人物详情未收起民房气泡");
        view.panels.close();

        const farm = world.getChildByName("building:farm") as Laya.Sprite;
        place(first, farm.x - 55, farm.y - 22);
        release(press(center(nodeOf(first)))); assertPerson(first); view.panels.close();
        isolate(first);
        game.dailyRationDate = "2026-11-12"; view.refresh();
        const autoAt = center(nodeOf(first)), autoDown = press(autoAt);
        if (autoDown.node.name.startsWith("person:")) throw new Error("自动口粮面板没有拦截地图");
        autoDown.node.event(Laya.Event.MOUSE_UP, autoDown.event);
        game.dailyRationDate = null; view.refresh();
        state.people = originalPeople; view.refresh();
        return { personKinds: 5, nativeInput: true, modalBlocking: true, autoPanelBlocking: true, mirrorElite: true, overlap: true, poolReuse: true, treeOcclusion: true, houseBubble: true, farmGround: true, pauseResume: true, centerTip: true };
    }
    const id = state.people[4].id; isolate(id);
    const beforeTick = game.battle.tick;
    release(press(center(nodeOf(id)))); assertPerson(id);
    game.update(.1); if (game.battle.tick !== beforeTick) throw new Error("查看详情时战斗仍在推进");
    await capture("点击村民_守夜详情");
    view.panels.close(); game.update(.1);
    if (!game.battle || game.battle.tick <= beforeTick) throw new Error("关闭详情后战斗未恢复");
    isolate(id); const pending = press(center(nodeOf(id)));
    place(id, 330, view.layout.footerTop - 48, true);
    if (nodeOf(id).visible) throw new Error("塔内人物没有隐藏");
    release(pending); if (view.panels.current) throw new Error("进塔后旧点击打开了详情");
    return { nativeInput: true, nightPauseResume: true, towerHidden: true };
}
