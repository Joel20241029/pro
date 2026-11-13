/** 用实际 Laya 渲染验证乘色、独立配件、镜像与共同脚底；不依赖滤镜或私有字段。 */
@IEditorEnv.regClass()
export class EnemyWorkshopScene {
    static async build(seeds: { canvas: number; pivot: { x: number; y: number }; enemies: { kind: string; head: { x: number; y: number }; back: { x: number; y: number } }[] }) {
        const saved = [];
        for (const seed of seeds.enemies) {
            const root = new Laya.Sprite(); root.name = seed.kind; root.size(seeds.canvas, seeds.canvas);
            for (let i = 0; i < 4; i++) {
                const frame = new Laya.Sprite(); frame.name = "Frame" + i; frame.visible = i === 0; frame.size(seeds.canvas, seeds.canvas); root.addChild(frame);
                for (const [name, id] of [["TintBody", `${seed.kind}_walk_0${i}_tint`], ["FixedDetails", `${seed.kind}_walk_0${i}`]]) {
                    const node = new Laya.Sprite(); node.name = name; node.size(seeds.canvas, seeds.canvas);
                    node.texture = await Laya.loader.load("enemyAuthoring/textures/" + id + ".png", Laya.Loader.IMAGE);
                    if (!node.texture) throw new Error("缺少怪物帧:" + id);
                    frame.addChild(node);
                }
                for (const [name, point] of [["HeadSocket", seed.head], ["BackSocket", seed.back]] as const) {
                    const node = new Laya.Sprite(); node.name = name; node.pos(point.x, point.y); node.visible = false; frame.addChild(node);
                }
            }
            const foot = new Laya.Sprite(); foot.name = "SortOrigin"; foot.pos(seeds.pivot.x, seeds.pivot.y); foot.visible = false; root.addChild(foot);
            const bounds = new Laya.Sprite(); bounds.name = "VisualBounds"; bounds.size(seeds.canvas, seeds.canvas); bounds.visible = false; root.addChild(bounds);
            await IEditorEnv.CreateAssetUtil.createPrefab(root, "enemyAuthoring/prefabs/" + seed.kind + ".lh");
            root.destroy(true); saved.push(seed.kind);
        }
        return { prefabs: saved, frames: saved.length * 4, nativeSerializer: true };
    }
    static async spike(output: string) {
        const fs = IEditorEnv.require("fs"), BufferClass = IEditorEnv.require("buffer").Buffer;
        const texture = await Laya.loader.load("enemyAuthoring/textures/spike-body.png", Laya.Loader.IMAGE) as Laya.Texture;
        const accessory = await Laya.loader.load("enemyAuthoring/textures/spike-accessory.png", Laya.Loader.IMAGE) as Laya.Texture;
        if (!texture || !accessory) throw new Error("缺少怪物组合小样素材");
        const scene = new Laya.Scene(); scene.size(800, 330);
        scene.graphics.drawRect(0, 0, 800, 330, "#e9e0c6");
        const evidence = [];
        for (const [i, color] of ["#ffffff", "#92b8d4", "#d7aa70", "#92b8d4"].entries()) {
            const root = new Laya.Sprite(); root.name = "Variant" + i; root.pos(100 + i * 200, 250); scene.addChild(root);
            const body = new Laya.Sprite(); body.name = "Body"; root.addChild(body);
            body.graphics.drawImage(texture, -64, -120, 128, 128, color);
            const item = new Laya.Sprite(); item.name = "Accessory"; item.texture = accessory; item.size(40, 40).pivot(20, 40).pos(0, -84); root.addChild(item);
            if (i === 3) root.scaleX = -1;
            scene.graphics.drawLine(root.x - 65, root.y, root.x + 65, root.y, "#bd6847", 2);
            const label = new Laya.Text(); label.text = ["原色", "冷色＋挂件", "暖色＋挂件", "整体镜像"][i]; label.fontSize = 22; label.color = "#493420"; label.align = "center"; label.size(190, 40).pos(i * 200 + 5, 275); scene.addChild(label);
            evidence.push({ color, mirror: root.scaleX, foot: root.localToGlobal(new Laya.Point(0, 0), true, scene), attachment: item.localToGlobal(new Laya.Point(20, 40), true, scene) });
        }
        await IEditorEnv.CreateAssetUtil.createScene(scene, "EnemyCompositionSpike.ls");
        const canvas = scene.drawToCanvas(800, 330, 0, 0);
        fs.mkdirSync(output, { recursive: true });
        fs.writeFileSync(output + "/composition.png", BufferClass.from(canvas.source.toDataURL("image/png").split(",")[1], "base64"));
        fs.writeFileSync(output + "/composition.json", JSON.stringify(evidence, null, 2));
        scene.destroy(true);
        return { output, variants: evidence.length };
    }
}
