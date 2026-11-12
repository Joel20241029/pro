interface BuildingSeedNode {
    name: string; frame?: string; x: number; y: number; width?: number; height?: number;
    pivotX?: number; pivotY?: number; children?: BuildingSeedNode[];
}
interface BuildingSeed {
    id: string; kind: string; nodes: BuildingSeedNode[]; footprint: BuildingSeedNode; visual: BuildingSeedNode;
    sort: { x: number; y: number }; above?: { name: string; sort: { x: number; y: number }; footprint: BuildingSeedNode; nodes: BuildingSeedNode[] };
}
/** 使用编辑器公开的 Prefab 序列化器，禁止手写 .lh 或调用动画私有字段。 */
@IEditorEnv.regClass()
export class BuildingWorkshopScene {
    static async build(seeds: { layouts: BuildingSeed[] }) {
        const clip = await Laya.loader.load("buildingAuthoring/animations/upgrade.mc") as Laya.AnimationClip2D;
        const attack = await Laya.loader.load("buildingAuthoring/animations/attack.mc") as Laya.AnimationClip2D;
        if (!clip || !attack) throw new Error("缺少原生建筑动画");
        const results: string[] = [];
        const create = async (data: BuildingSeedNode, parent: Laya.Sprite) => {
            const node = new Laya.Sprite(); node.name = data.name;
            node.pos(data.x, data.y).size(data.width || 0, data.height || 0).pivot(data.pivotX || 0, data.pivotY || 0);
            if (data.frame) {
                node.texture = await Laya.loader.load("buildingAuthoring/textures/" + data.frame + ".png", Laya.Loader.IMAGE);
                if (!node.texture) throw new Error("缺少建筑部件:" + data.frame);
            }
            parent.addChild(node);
            for (const child of data.children || []) await create(child, node);
            if (data.name === "Weapon") { const animator = node.addComponent(Laya.AnimatorClip2D); animator.autoPlay = false; animator.clip = attack; }
        };
        for (const kind of Array.from(new Set(seeds.layouts.map(l => l.kind)))) {
            const root = new Laya.Sprite(); root.name = kind; root.size(128, 128);
            for (const layout of seeds.layouts.filter(l => l.kind === kind)) {
                const variant = new Laya.Sprite(); variant.name = layout.id; variant.size(128, 128); root.addChild(variant);
                variant.visible = root.numChildren === 1;
                const body = new Laya.Sprite(); body.name = "Body"; body.size(128, 128).pos(64, 120).pivot(64, 120); variant.addChild(body);
                for (const node of layout.nodes) await create(node, body);
                const animator = body.addComponent(Laya.AnimatorClip2D); animator.autoPlay = false; animator.clip = clip;
                for (const marker of [layout.footprint, layout.visual, { name: "SortOrigin", ...layout.sort }]) {
                    await create(marker, variant); (variant.getChildByName(marker.name) as Laya.Sprite).visible = false;
                }
                if (layout.above) {
                    const above = new Laya.Sprite(); above.name = "AboveGround"; above.size(128, 128).pos(layout.above.sort.x, layout.above.sort.y).pivot(layout.above.sort.x, layout.above.sort.y); variant.addChild(above);
                    for (const node of layout.above.nodes) await create(node, above);
                    const a = above.addComponent(Laya.AnimatorClip2D); a.autoPlay = false; a.clip = clip;
                    await create({ ...layout.above.footprint, name: "AboveFootprint" }, variant);
                    (variant.getChildByName("AboveFootprint") as Laya.Sprite).visible = false;
                }
            }
            await IEditorEnv.CreateAssetUtil.createPrefab(root, "buildingAuthoring/prefabs/" + kind + ".lh");
            root.destroy(true); results.push(kind);
        }
        return { prefabs: results, variants: seeds.layouts.length };
    }
    /** 读取已经由编辑器保存的 .lh，在原生渲染器中生成可复核预览；不读取种子代替成品。 */
    static async preview(output: string) {
        const fs = IEditorEnv.require("fs"), BufferClass = IEditorEnv.require("buffer").Buffer;
        fs.mkdirSync(output, { recursive: true });
        const kinds = ["HOUSE", "FARM", "LOGGING", "GATE", "ARROW", "STONE", "SLOW"];
        const labels = ["民居", "农田", "伐木场", "城门", "箭塔", "石塔", "寒塔"];
        const scene = new Laya.Scene(); scene.name = "建筑升级预览"; scene.size(1000, 1700);
        scene.graphics.drawRect(0, 0, 1000, 1700, "#e9e0c6");
        const text = (value: string, x: number, y: number, w: number) => {
            const n = new Laya.Text(); n.text = value; n.fontSize = 24; n.color = "#4a3421"; n.bold = true; n.align = "center"; n.size(w, 40).pos(x, y); scene.addChild(n);
        };
        text("Laya 原生拼装 · 四档主体对比", 0, 16, 1000);
        const evidence = [];
        for (let row = 0; row < kinds.length; row++) {
            const prefab = await Laya.loader.load("buildingAuthoring/prefabs/" + kinds[row] + ".lh", Laya.Loader.HIERARCHY) as Laya.Prefab;
            for (let col = 0; col < 4; col++) {
                const level = [1, 4, 8, 12][col], root = prefab.create() as Laya.Sprite;
                for (let i = 0; i < root.numChildren; i++) (root.getChildAt(i) as Laya.Sprite).visible = false;
                const variant = root.getChildByName(`${kinds[row]}_${level}_1`) as Laya.Sprite; variant.visible = true;
                root.pos(26 + col * 245, 64 + row * 225).scale(1.5, 1.5); scene.addChild(root);
                const body = variant.getChildByName("Body") as Laya.Sprite;
                const animation = body.getComponent(Laya.AnimatorClip2D);
                animation.gotoAndStop(0); const start = body.scaleY;
                animation.gotoAndStop(.5); const peak = body.scaleY;
                animation.gotoAndStop(1);
                evidence.push({ id: variant.name, start, peak, end: body.scaleY, playing: animation.isPlaying, children: body.numChildren });
                text(labels[row] + " · " + level + "级", col * 245, 254 + row * 225, 245);
            }
        }
        await IEditorEnv.CreateAssetUtil.createScene(scene, "BuildingPreview.ls");
        const canvas = scene.drawToCanvas(1000, 1700, 0, 0);
        fs.writeFileSync(output + "/建筑升级_原生编辑器预览.png", BufferClass.from(canvas.source.toDataURL("image/png").split(",")[1], "base64"));
        fs.writeFileSync(output + "/native-validation.json", JSON.stringify(evidence, null, 2));
        scene.destroy(true);
        return { preview: output, variants: evidence.length };
    }
}
