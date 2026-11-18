@IEditorEnv.regClass()
export class VillageMotionScene {
    static async save(crops: Record<string, [number, number, number, number]>) {
        const textures: Record<string, Laya.Texture> = {};
        const ids = [...Object.keys(crops), 'hd_village_window_glow', ...['brace', 'rivet', 'crest', 'banner'].flatMap(name => ['hd_part_' + name, 'hd_village_part_' + name])];
        for (const id of ids) {
            const texture = await Laya.loader.load('buildingAuthoring/textures/' + id + '.png', Laya.Loader.IMAGE) as Laya.Texture;
            if (!texture) throw new Error('未载入村内贴图：' + id);
            textures[id] = texture;
        }
        const at = (parent: Laya.Sprite, name: string) => parent.getChildByName(name) as Laya.Sprite | null;
        const add = (parent: Laya.Sprite, name: string, id: string, x: number, y: number, width: number, height: number) => {
            const node = at(parent, name) ?? new Laya.Sprite();
            node.name = name; node.texture = textures[id]; node.pos(x,y).size(width,height);
            if (!node.parent) parent.addChild(node);
            return node;
        };
        const anchored = (node: Laya.Sprite | null, x: number, y: number) => {
            if (!node) return;
            node.pos(node.x + (x - node.anchorX) * node.width, node.y + (y - node.anchorY) * node.height);
            node.anchorX = x; node.anchorY = y;
        };
        const shared = ['brace','rivet','crest','banner'];
        const replaceShared = (node: Laya.Sprite) => {
            for (const name of shared) if (node.texture && (node.texture === textures['hd_part_' + name] ||
                node.texture.url?.endsWith('/hd_part_' + name + '.png')))
                node.texture = textures['hd_village_part_' + name];
            for (let i=0; i<node.numChildren; i++) replaceShared(node.getChildAt(i) as Laya.Sprite);
        };
        const report: Record<string, number> = {};
        for (const kind of ['HOUSE','FARM','LOGGING','GATE']) {
            const file = `buildingAuthoring/prefabs/${kind}.lh`;
            const prefab = await Laya.loader.load(file, Laya.Loader.HIERARCHY) as Laya.Prefab;
            const root = prefab.create() as Laya.Sprite;
            for (let i=0; i<root.numChildren; i++) {
                const variant = root.getChildAt(i) as Laya.Sprite, body = at(variant, 'Body')!;
                replaceShared(body);
                if (kind === 'HOUSE') {
                    for (const name of ['MainHouse','RearWing','SideWing']) {
                        const house = at(body,name);
                        if (house) {
                            const glow = add(house,'AmbientWindow','hd_village_window_glow',house.width*.51,house.height*.78,house.width*.27,house.height*.18);
                            glow.anchorX=.5; glow.anchorY=.5; glow.alpha=.22;
                        }
                    }
                    anchored(at(body,'PorchLantern'), .5, .12);
                } else if (kind === 'FARM') {
                    const ground = at(body,'CropGround')!;
                    // 田间灌溉的三次外观变化与当前预制体主体一致。
                    const stage = Number(variant.name.split('_')[1]);
                    const tier = stage >= 12 ? 3 : stage >= 8 ? 2 : stage >= 4 ? 1 : 0;
                    for (let plot=0; plot<4; plot++) {
                        const id = `farm_crop_${tier}_${plot}_0`;
                        add(ground,'AmbientCrop'+plot,id,...crops[id]);
                    }
                    const upper = at(variant,'AboveGround');
                    if (upper) anchored(at(upper,'WaterWheel'), .5, .5);
                } else if (kind === 'LOGGING') {
                    const tool = add(body,'AmbientWorkTool','hd_village_part_brace',92,88,10,22);
                    tool.anchorX = .5; tool.anchorY = .08;
                    anchored(at(body,'SawWheel'), .5, .5);
                } else {
                    const banner = at(body,'GateBanner') ?? at(body,'HonorBanner');
                    if (banner) { banner.name = 'GateBanner'; anchored(banner, .5, .12); }
                }
            }
            await IEditorEnv.CreateAssetUtil.createPrefab(root,file);
            report[kind] = root.numChildren; root.destroy(true);
        }
        return report;
    }
}
