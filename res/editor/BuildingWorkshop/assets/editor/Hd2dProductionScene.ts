/** 在Laya原生编辑器实例化、动画抽样并保存七类建筑与十类怪物预制体。 */
@IEditorEnv.regClass()
export class Hd2dProductionScene {
    static async build(seeds: any, recipe: any, output: string) {
        const fs = IEditorEnv.require('fs'), BufferClass = IEditorEnv.require('buffer').Buffer;
        fs.mkdirSync(output, { recursive: true });
        const upgrade = await Laya.loader.load('buildingAuthoring/animations/upgrade.mc') as Laya.AnimationClip2D;
        const attack = await Laya.loader.load('buildingAuthoring/animations/attack.mc') as Laya.AnimationClip2D;
        const textures: Record<string, Laya.Texture> = {};
        for (const item of recipe.assets.filter((a: any) => ['building-parts', 'enemies', 'enemy-parts'].includes(a.category))) {
            const family = item.category === 'building-parts' ? 'buildingAuthoring' : 'enemyAuthoring';
            const texture = await Laya.loader.load(`${family}/textures/${item.id}.png`, Laya.Loader.IMAGE);
            if (!texture) throw new Error('高清制作纹理加载失败:' + item.id);
            textures[item.id] = texture;
        }
        const create = (data: any): Laya.Sprite => {
            const node = new Laya.Sprite(); node.name = data.name;
            if (data.frame) node.texture = textures[data.frame];
            for (const prop of ['x', 'y', 'width', 'height', 'anchorX', 'anchorY', 'scaleX', 'scaleY', 'rotation', 'alpha', 'visible']) if (data[prop] !== undefined) (node as any)[prop] = data[prop];
            for (const child of data.children || []) node.addChild(create(child));
            if (data.clip) { const animator = node.addComponent(Laya.AnimatorClip2D); animator.autoPlay = false; animator.clip = data.clip === 'upgrade' ? upgrade : attack; animator.gotoAndStop(1); }
            return node;
        };
        const prefabs: string[] = [];
        for (const [family, values] of [['buildingAuthoring', seeds.buildings], ['enemyAuthoring', seeds.enemies]] as [string, any[]][]) for (const data of values) {
            const root = create(data), file = `${family}/prefabs/${data.name}.lh`;
            await IEditorEnv.CreateAssetUtil.createPrefab(root, file); prefabs.push(file); root.destroy(true);
        }
        const scene = new Laya.Scene(); scene.name = '高清完整建筑等级验收'; scene.size(1920, 1370);
        scene.graphics.drawRect(0, 0, 1920, 1370, '#a7be7b');
        const text = (value: string, x: number, y: number) => { const t = new Laya.Text(); t.text = value; t.fontSize = 16; t.color = '#38271d'; t.align = 'center'; t.pos(x, y).size(160, 24); scene.addChild(t); };
        const animationChecks: any[] = [], bounds: any[] = [];
        let row = 0;
        for (const data of seeds.buildings) for (const rooms of data.name === 'HOUSE' ? [1, 2, 3] : [1]) {
            for (let stage = 1; stage <= 12; stage++) {
                const variant = data.children.find((v: any) => v.name === `${data.name}_${stage}_${rooms}`), node = create(variant);
                node.visible = true; node.pos((stage - 1) * 160 + 16, row * 150 + 4); scene.addChild(node);
                text(`${data.name} ${stage}/${rooms}`, (stage - 1) * 160, row * 150 + 128);
                const body = node.getChildByName('Body') as Laya.Sprite;
                const b = body.getSelfBounds(new Laya.Rectangle(), true); bounds.push({ name: node.name, x: b.x, y: b.y, width: b.width, height: b.height });
                if (stage === 1 && ['ARROW', 'STONE', 'SLOW'].includes(data.name)) {
                    const weapon = body.getChildByName('Weapon') as Laya.Sprite, animator = weapon.getComponent(Laya.AnimatorClip2D);
                    animator.gotoAndStop(0); const start = weapon.rotation; animator.gotoAndStop(.35); const middle = weapon.rotation; animator.gotoAndStop(1);
                    if (start === middle || weapon.rotation !== 0 || body.rotation !== 0) throw new Error('塔动画/静止主体不正确:' + data.name);
                    animationChecks.push({ name: data.name, start, middle, end: weapon.rotation, bodyRotation: body.rotation });
                }
            }
            row++;
        }
        await IEditorEnv.CreateAssetUtil.createScene(scene, 'Hd2dProductionBuildings.ls');
        const save = (node: Laya.Sprite, w: number, h: number, name: string) => {
            const canvas = node.drawToCanvas(w, h, 0, 0);
            fs.writeFileSync(output + '/' + name, BufferClass.from(canvas.source.toDataURL('image/png').split(',')[1], 'base64'));
        };
        save(scene, 1920, 1370, '建筑108变体.png'); scene.destroy(true);
        const enemies = new Laya.Scene(); enemies.size(960, 600); enemies.graphics.drawRect(0, 0, 960, 600, '#a7be7b');
        const enemyNodes = seeds.enemies.map((data: any, i: number) => { const node = create(data); node.pos(i % 5 * 192 + 32, Math.floor(i / 5) * 270 + 32).scale(1.4, 1.4); enemies.addChild(node); return node; });
        for (let frame = 0; frame < 4; frame++) {
            for (const node of enemyNodes) {
                const count = node.numChildren - 2;
                for (let i = 0; i < count; i++) (node.getChildAt(i) as Laya.Sprite).visible = i === frame % count;
            }
            save(enemies, 960, 600, `怪物帧_${frame}.png`);
        }
        await IEditorEnv.CreateAssetUtil.createScene(enemies, 'Hd2dProductionEnemies.ls'); enemies.destroy(true);
        return { prefabs, buildingVariants: bounds.length, enemyKinds: enemyNodes.length, animationChecks, bounds };
    }
}
