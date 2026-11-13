import { HD2D_PROBE as P } from "./Hd2dProbeConfig";
import { HD2D_ENVIRONMENT as E } from "./Hd2dEnvironmentConfig";
import { Hd2dProbeEnvironment } from "./Hd2dProbeEnvironment";
import { Hd2dProbeMotion } from "../hd2dAuthoring/Hd2dProbeMotion";
import { Hd2dProbeViewport } from "../hd2dAuthoring/Hd2dProbeViewport";

interface ProbeTexture { id: string; width: number; height: number; bytes: number; }

/** Native Laya probe, deliberately separate from gameplay and old building prefabs. */
@IEditorEnv.regClass()
export class Hd2dProbeScene {
    static async build(manifest: { assets: ProbeTexture[]; pngBytes: number; decodedRgbaBytes: number }, output: string) {
        const textures: Record<string, Laya.Texture> = {};
        for (const item of manifest.assets) {
            const texture = await Laya.loader.load("hd2dAuthoring/textures/" + item.id + ".png", Laya.Loader.IMAGE);
            if (!texture) throw new Error("HD 小样贴图缺失: " + item.id);
            texture.bitmap.filterMode = Laya.FilterMode.Bilinear;
            textures[item.id] = texture;
        }
        const attack = await Laya.loader.load("buildingAuthoring/animations/attack.mc") as Laya.AnimationClip2D;
        if (!attack) throw new Error("原生攻击动画缺失");
        const image = (id: string, name: string, x: number, y: number, w: number, h: number) => {
            const node = new Laya.Sprite(); node.name = name; node.texture = textures[id];
            if (!node.texture) throw new Error("未声明的 HD 小样: " + id);
            node.pos(x, y).size(w, h); return node;
        };
        const saved: string[] = [];
        for (const tower of P.towers) {
            const root = new Laya.Sprite(); root.name = tower.kind; root.size(128, 128);
            for (const layer of tower.layers) {
                const node = image(layer.image, layer.name, layer.x, layer.y, layer.w, layer.h);
                if ("px" in layer) node.pivot(layer.px, layer.py);
                root.addChild(node);
                if (layer.name === "Weapon") {
                    const animator = node.addComponent(Laya.AnimatorClip2D); animator.autoPlay = false; animator.clip = attack;
                }
            }
            // Retain the semantic marker names for later integration. These probe
            // bounds do not constitute the full production building contract.
            for (const spec of [
                { name: "Footprint", x: 22, y: 95, w: 84, h: 24 },
                { name: "VisualBounds", x: 2, y: -12, w: 124, h: 136 },
                { name: "SortOrigin", x: 64, y: 116, w: 0, h: 0 },
                { name: "Muzzle", x: 64, y: 14, w: 0, h: 0 }
            ]) {
                const marker = new Laya.Sprite(); marker.name = spec.name;
                marker.pos(spec.x, spec.y).size(spec.w, spec.h); marker.visible = false; root.addChild(marker);
            }
            const path = "hd2dAuthoring/prefabs/" + tower.kind + ".lh";
            await IEditorEnv.CreateAssetUtil.createPrefab(root, path); saved.push(path); root.destroy(true);
        }
        const scene = new Laya.Scene(); scene.name = "高清二维材质与拆件验证"; scene.size(P.width, P.height);
        const grass = new Laya.Sprite(); grass.name = "GrassTiles";
        grass.size(P.width, P.height); scene.addChild(grass);
        for (let y = 0; y < P.height; y += 512) for (let x = 0; x < P.width; x += 512) {
            grass.addChild(image("grass", "Grass_" + x + "_" + y, x, y, 512, 512));
        }
        // User explicitly permitted a road image when native strokes retain sharp
        // inner bends. Source alpha covers all 505 sampled simulation positions;
        // see design/hd2d/parts/road-coverage.json. No gameplay route is changed.
        scene.addChild(image("road_sprite", "SmoothRoad", 0, 0, P.width, P.roadHeight));
        // Only world roots participate in ground sorting. Ground shadows stay
        // underneath them and the probe's labels/buttons remain above them.
        const shadows = new Laya.Sprite(); shadows.name = "GroundShadows"; scene.addChild(shadows);
        const world = new Laya.Sprite(); world.name = "World"; scene.addChild(world);
        const hud = new Laya.Sprite(); hud.name = "ProbeHud"; scene.addChild(hud);
        const environment = Hd2dProbeEnvironment.build(world, shadows, textures);
        const text = (value: string, x: number, y: number, w: number, fontSize: number) => {
            const node = new Laya.Text(); node.text = value; node.fontSize = fontSize; node.color = "#573a23";
            node.bold = true; node.align = "center"; node.valign = "middle"; node.size(w, fontSize * 1.7).pos(x, y);
            hud.addChild(node); return node;
        };
        text("高清二维 · 原生小场景", 0, 15, P.width, 32);
        text("验证材质、圆弯道路与拆件 · 非游戏成品", 0, 65, P.width, 20);
        const checks: any[] = [];
        const weapons: Laya.Sprite[] = [];
        for (const tower of P.towers) {
            const prefab = await Laya.loader.load("hd2dAuthoring/prefabs/" + tower.kind + ".lh", Laya.Loader.HIERARCHY) as Laya.Prefab;
            if (!prefab) throw new Error("预制体未成功保存: " + tower.kind);
            const root = prefab.create() as Laya.Sprite; root.pos(tower.x - 76.8, tower.y - 144).scale(1.2, 1.2); world.addChild(root);
            const origin = root.getChildByName("SortOrigin") as Laya.Sprite;
            root.zOrder = Math.round(root.y + origin.y * root.scaleY);
            const weapon = root.getChildByName("Weapon") as Laya.Sprite;
            const animator = weapon.getComponent(Laya.AnimatorClip2D);
            animator.gotoAndStop(0); const start = weapon.rotation;
            animator.gotoAndStop(.5); const peak = weapon.rotation;
            animator.gotoAndStop(1); const end = weapon.rotation;
            // Existing native attack clip begins pulled back (-18 degrees) and
            // settles at its zero-degree rest pose; it is not a loop.
            if (start === peak || Math.abs(end) > .001) throw new Error("原生武器动画未产生独立动作: " + JSON.stringify({ kind: tower.kind, start, peak, end, clip: !!animator.clip }));
            checks.push({ kind: tower.kind, start, peak, end, bodyRotation: (root.getChildByName("Body") as Laya.Sprite).rotation });
            weapons.push(weapon);
        }
        const motions: Hd2dProbeMotion[] = [environment.motion];
        for (const person of P.people) {
            const prefix = person.image + (person.image === "baby" ? "_idle_" : "_walk_");
            const actor = image(prefix + "1", person.name, person.x, person.y, person.size, person.size);
            actor.pivot(person.size / 2, person.size * person.pivotY); actor.zOrder = Math.round(person.y); world.addChild(actor);
            const shadow = image("env_shadow", person.name + "Shadow",
                person.x - person.size * E.actorShadow.widthRatio / 2,
                person.y - person.size * E.actorShadow.heightRatio / 2,
                person.size * E.actorShadow.widthRatio, person.size * E.actorShadow.heightRatio);
            shadow.alpha = E.actorShadow.alpha; shadows.addChild(shadow);
            const motion = actor.addComponent(Hd2dProbeMotion);
            motion.frames = [1, 2, 3, 4].map(n => textures[prefix + n]);
            motion.fps = person.fps; motions.push(motion);
        }
        const enemy = image("raider_0", "RaiderFrontWalk", 360, 285, 54, 78);
        enemy.pivot(27, 76.4); enemy.zOrder = 285; world.addChild(enemy);
        const enemyMotion = enemy.addComponent(Hd2dProbeMotion);
        enemyMotion.frames = [textures.raider_0, textures.raider_1]; motions.push(enemyMotion);
        text("男女、孩子、老人四帧 · 婴儿呼吸 · 同规格试样", 25, 900, 670, 20);
        // Workshop uses UI2. Legacy Image exists inside the editor but is excluded
        // from its standalone preview. GImage reads the source texture's sizeGrid.
        const button = new Laya.GImage(); button.name = "HdButton"; button.autoSize = false;
        button.src = "hd2dAuthoring/textures/button.png";
        button.pos(190, 954).size(340, 62); hud.addChild(button);
        const buttonText = text("按钮清晰度小样", 190, 965, 340, 28); buttonText.color = "#fff9e7";
        scene.addComponent(Hd2dProbeViewport);
        await IEditorEnv.CreateAssetUtil.createScene(scene, "Hd2dProbe.ls");
        for (const motion of motions) motion.autoPlay = false;
        const fs = IEditorEnv.require("fs"), BufferClass = IEditorEnv.require("buffer").Buffer;
        fs.mkdirSync(output, { recursive: true });
        Laya.stage.addChild(scene);
        // Four actual native samples; the two-frame enemy cycles twice.
        for (const [index, time] of [0, .5, 1, .5].entries()) {
            for (const weapon of weapons) weapon.getComponent(Laya.AnimatorClip2D).gotoAndStop(time);
            for (const motion of motions) motion.seekFrame(index % motion.frames.length);
            await new Promise<void>(resolve => Laya.systemTimer.frameOnce(2, null, resolve));
            const canvas = scene.drawToCanvas(P.width, P.height, 0, 0);
            fs.writeFileSync(output + "/动态小场景_" + index + ".png", BufferClass.from(canvas.source.toDataURL("image/png").split(",")[1], "base64"));
        }
        // Readable before/after evidence, not a new game movement behavior.
        // +/-12 logical pixels puts the same actor close to each prop's ground
        // origin, so the screenshots exercise genuine overlapping silhouettes.
        const male = world.getChildByName("MaleOfflineWalk") as Laya.Sprite;
        const maleShadow = shadows.getChildByName("MaleOfflineWalkShadow") as Laya.Sprite;
        const original = { x: male.x, y: male.y, z: male.zOrder, sx: maleShadow.x, sy: maleShadow.y };
        const occlusionChecks: any[] = [];
        for (const prop of environment.occluders) for (const [side, offset] of [["behind", -12], ["front", 12]] as const) {
            male.pos(prop.x, prop.y + offset); male.zOrder = Math.round(male.y);
            maleShadow.pos(male.x - maleShadow.width / 2, male.y - maleShadow.height / 2);
            await new Promise<void>(resolve => Laya.systemTimer.frameOnce(2, null, resolve));
            const actorIndex = world.getChildIndex(male), propIndex = world.getChildIndex(prop);
            if ((side === "behind") !== (actorIndex < propIndex)) throw new Error("脚底遮挡顺序错误: " + prop.name);
            const file = "occlusion_" + prop.name + "_" + side + ".png";
            const canvas = scene.drawToCanvas(P.width, P.height, 0, 0);
            fs.writeFileSync(output + "/" + file, BufferClass.from(canvas.source.toDataURL("image/png").split(",")[1], "base64"));
            occlusionChecks.push({ prop: prop.name, side, actorIndex, propIndex, actorY: male.y, propY: prop.y, file });
        }
        male.pos(original.x, original.y); male.zOrder = original.z; maleShadow.pos(original.sx, original.sy);
        const report = { status: "native_probe_not_visual_acceptance", prefabs: saved, animationChecks: checks,
            pngBytes: manifest.pngBytes, decodedRgbaBytes: manifest.decodedRgbaBytes, roadMode: "independent_image",
            motionFrames: motions.map(m => ({ name: m.owner.name, count: m.frames.length, fps: m.fps })),
            occlusionChecks, environment: { trees: E.trees.length, signs: E.signs.length, rocks: E.rocks.length,
                fireLayers: ["Base", "FireFlame", "FrontStones"], detachedGroundShadows: true,
                shadowStatus: "shared_contact_approximation_not_final_model_shadows" },
            gameplayTouched: false, particlesRemovedFromGame: false };
        fs.writeFileSync(output + "/native-report.json", JSON.stringify(report, null, 2));
        scene.destroy(true); return report;
    }
}
