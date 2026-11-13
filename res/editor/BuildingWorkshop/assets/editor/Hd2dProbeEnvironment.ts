import { HD2D_ENVIRONMENT as E } from "./Hd2dEnvironmentConfig";
import { Hd2dProbeMotion } from "../hd2dAuthoring/Hd2dProbeMotion";

/** Isolated composition rules for environment art and front/back evidence. */
export class Hd2dProbeEnvironment {
    static build(world: Laya.Sprite, shadows: Laya.Sprite, textures: Record<string, Laya.Texture>) {
        const sprite = (id: string, name: string, height: number) => {
            const texture = textures[id];
            if (!texture) throw new Error("环境试样贴图缺失: " + id);
            const node = new Laya.Sprite(); node.name = name; node.texture = texture;
            node.size(height * texture.width / texture.height, height); return node;
        };
        const groundRoot = (name: string, x: number, y: number) => {
            const node = new Laya.Sprite(); node.name = name; node.pos(x, y);
            node.zOrder = Math.round(y); world.addChild(node); return node;
        };
        const occluders: Laya.Sprite[] = [];
        for (const tree of E.trees) {
            const root = groundRoot(tree.name, tree.x, tree.y);
            const body = sprite(tree.image, "TreeBody", tree.height);
            const pivot = E.treePivot[tree.image as keyof typeof E.treePivot];
            body.pos(-body.width * pivot.x, -body.height * pivot.y); root.addChild(body);
            for (const ornament of tree.decorations) {
                const detail = sprite(ornament.image, "CanopyDecoration", ornament.height);
                detail.pos(body.x + body.width * ornament.x - detail.width / 2,
                    body.y + body.height * ornament.y - detail.height / 2);
                root.addChild(detail);
            }
            const shadow = sprite("env_shadow", tree.name + "Shadow", tree.height * E.treeShadow.heightRatio);
            shadow.width = body.width * E.treeShadow.widthRatio;
            shadow.pos(tree.x + E.treeShadow.offsetX - shadow.width / 2,
                tree.y + E.treeShadow.offsetY - shadow.height / 2);
            shadow.alpha = E.treeShadow.alpha; shadows.addChild(shadow);
            if (tree.name === "OakNearRoad") occluders.push(root);
        }
        for (const sign of E.signs) {
            const root = groundRoot(sign.name, sign.x, sign.y);
            const board = sprite("env_sign", "WoodenBoard", sign.height);
            board.pos(-board.width / 2, -board.height); root.addChild(board);
            const label = new Laya.Text(); label.name = "Inscription"; label.text = sign.text;
            label.fontSize = E.signText.fontSize; label.bold = true; label.color = E.signText.color;
            label.align = "center"; label.valign = "middle"; label.wordWrap = false;
            label.pos(board.x + board.width * E.signText.x, board.y + board.height * E.signText.y);
            label.size(board.width * E.signText.width, board.height * E.signText.height);
            root.addChild(label);
            if (sign.name === "FriendshipRoadSign") occluders.push(root);
        }
        for (const rock of E.rocks) {
            const root = groundRoot(rock.name, rock.x, rock.y);
            const body = sprite("env_rocks", "Stones", rock.height);
            body.pos(-body.width / 2, -body.height); root.addChild(body);
        }
        const fire = E.campfire;
        const root = groundRoot("Campfire", fire.x, fire.y);
        for (const [id, name] of [["env_campfire", "Base"], ["env_campfire_front", "FrontStones"]]) {
            const layer = sprite(id, name, fire.height);
            layer.width = fire.width; layer.pos(-fire.width / 2, -fire.height);
            root.addChild(layer);
        }
        const flame = sprite("env_flame_1", "FireFlame", fire.flameHeight);
        flame.pivot(flame.width / 2, flame.height * fire.flamePivotY).pos(0, fire.flameBottom);
        root.addChildAt(flame, 1);
        const motion = flame.addComponent(Hd2dProbeMotion);
        motion.frames = [1, 2, 3, 4].map(frame => textures["env_flame_" + frame]);
        motion.fps = fire.fps;
        occluders.push(root);
        return { motion, occluders };
    }
}
