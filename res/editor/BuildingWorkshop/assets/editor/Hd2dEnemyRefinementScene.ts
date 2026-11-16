/** 只更新怪物：由 Laya 原生保存逐帧身体和可选配饰矩形，绝不重建建筑。 */
@IEditorEnv.regClass()
export class Hd2dEnemyRefinementScene {
    static async build(seeds: any[], recipe: any, output: string) {
        const fs = IEditorEnv.require('fs'), BufferClass = IEditorEnv.require('buffer').Buffer;
        fs.mkdirSync(output, { recursive: true });
        const textures: Record<string, Laya.Texture> = {};
        const shadowFrame = seeds[0].children.find((n: any) => n.name === 'ContactShadow').frame;
        for (const item of recipe.assets.filter((a: any) => ['enemies', 'enemy-parts'].includes(a.category) || a.id === shadowFrame)) {
            const url = `enemyAuthoring/textures/${item.id}.png`;
            // 同一编辑器会话可以反复验收改稿；必须读取刚导入的源图，不能保存旧纹理缓存。
            Laya.loader.clearRes(url);
            const texture = await Laya.loader.load(url, Laya.Loader.IMAGE);
            if (!texture) throw new Error('怪物纹理加载失败:' + item.id);
            textures[item.id] = texture;
        }
        const create = (data: any): Laya.Sprite => {
            const node = new Laya.Sprite(); node.name = data.name;
            if (data.frame) node.texture = textures[data.frame];
            for (const prop of ['x', 'y', 'width', 'height', 'alpha', 'visible']) if (data[prop] !== undefined) (node as any)[prop] = data[prop];
            for (const child of data.children || []) node.addChild(create(child));
            return node;
        };
        const files: string[] = [], evidence: any[] = [];
        for (const data of seeds) {
            const root = create(data), file = `enemyAuthoring/prefabs/${data.name}.lh`;
            await IEditorEnv.CreateAssetUtil.createPrefab(root, file); files.push(file); root.destroy(true);
            const frames = data.children.filter((n: any) => n.name.startsWith('Frame'));
            const parts = frames[0].children.filter((n: any) => n.name.startsWith('Accessory_')).map((n: any) => n.name);
            const heads = [null, ...parts.filter((n: string) => !['Accessory_banner', 'Accessory_leaves'].includes(n))];
            const backs = [null, ...parts.filter((n: string) => ['Accessory_banner', 'Accessory_leaves'].includes(n))];
            for (let index = 0; index < frames.length; index++) {
                const scene = new Laya.Scene(); scene.size(600, Math.ceil(heads.length * backs.length / 3) * 220);
                scene.graphics.drawRect(0, 0, scene.width, scene.height, '#b7c88d');
                let cell = 0;
                for (const back of backs) for (const head of heads) {
                    // 验收必须绘制根级阴影与当前帧，不能仅截图Body/配饰而漏验实际脚底。
                    const pose = create({ name: data.name, width: 96, height: 96, children: [
                        data.children.find((n: any) => n.name === 'ContactShadow'), frames[index]
                    ] });
                    const frame = pose.getChildByName(frames[index].name) as Laya.Sprite; frame.visible = true;
                    for (let j = 0; j < frame.numChildren; j++) {
                        const part = frame.getChildAt(j) as Laya.Sprite;
                        if (part.name.startsWith('Accessory_')) part.visible = part.name === head || part.name === back;
                    }
                    const x = cell % 3 * 200 + 28, y = Math.floor(cell / 3) * 220 + 16;
                    pose.scale(1.5, 1.5).pos(x, y); scene.addChild(pose);
                    scene.graphics.drawLine(x, y + data.children.find((n: any) => n.name === 'SortOrigin').y * 1.5, x + 144, y + data.children.find((n: any) => n.name === 'SortOrigin').y * 1.5, '#365a7d', 1);
                    const label = new Laya.Text(); label.text = `${head || '-'} / ${back || '-'}`; label.fontSize = 10; label.color = '#312414'; label.align = 'center'; label.pos(cell % 3 * 200, y + 148).size(200, 40); scene.addChild(label);
                    cell++;
                }
                const canvas = scene.drawToCanvas(scene.width, scene.height, 0, 0), name = `${data.name}-${index}.png`;
                fs.writeFileSync(output + '/' + name, BufferClass.from(canvas.source.toDataURL('image/png').split(',')[1], 'base64'));
                evidence.push({ kind: data.name, index, combinations: cell, image: name }); scene.destroy(true);
            }
        }
        const scene = new Laya.Scene(); scene.name = '怪物逐帧挂点与可选配饰'; scene.size(960, 600);
        scene.graphics.drawRect(0, 0, 960, 600, '#a7be7b');
        seeds.forEach((data, i) => { const node = create(data); node.pos(i % 5 * 192 + 32, Math.floor(i / 5) * 270 + 32).scale(1.4, 1.4); scene.addChild(node); });
        await IEditorEnv.CreateAssetUtil.createScene(scene, 'Hd2dProductionEnemies.ls'); scene.destroy(true);
        const report = { files, evidence, frames: evidence.length, samples: evidence.reduce((sum, row) => sum + row.combinations, 0), buildingsTouched: false };
        fs.writeFileSync(output + '/native-report.json', JSON.stringify(report, null, 2)); return report;
    }
}
