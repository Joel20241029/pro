import { FEEDBACK } from './config/FeedbackConfig';
import { ResourceBundle } from '../config/ResourceConfig';
/** 编辑器原生粒子资源的共享入口；解码失败让所属分包继续走现有手动重试。 */
export class ParticleLibrary {
    private definitions = new Map<string, Laya.ShurikenParticle2DSystem>();
    private material: Laya.Material | null = null;
    install(bundle: ResourceBundle, data: any) {
        const required = FEEDBACK.particles[bundle];
        if (data?.version !== 1 || data.bundle !== bundle || !data.definitions || Object.keys(data.definitions).length !== required.length || required.some(id => !data.definitions[id]?.main || !data.definitions[id]?.emission || !data.definitions[id]?.shape)) throw new Error('粒子资源不完整：' + bundle);
        let material = this.material;
        if (bundle === 'base') {
            if (!data.shader || data.material?.type !== 'VillageParticle') throw new Error('粒子材质缺失');
            if (!Laya.Shader3D.find('VillageParticle')) Laya.ShaderParser.parse(data.shader);
            material = new Laya.Material(); material.setShaderName('VillageParticle');
            material.materialRenderMode = data.material.materialRenderMode;
            material.cull = data.material.s_Cull; material.depthTest = data.material.s_DepthTest; material.depthWrite = data.material.s_DepthWrite;
            material.blend = data.material.s_Blend; material.blendSrc = data.material.s_BlendSrc; material.blendDst = data.material.s_BlendDst;
            material.setTexture('u_Texture', Laya.Texture2D.whiteTexture);
        }
        if (!material) throw new Error('基础粒子材质未加载');
        const prepared = new Map<string, Laya.ShurikenParticle2DSystem>();
        try {
            for (const id of required) {
                const ps = Laya.SerializeUtil.decodeObj(data.definitions[id], new Laya.ShurikenParticle2DSystem());
                if (ps.main.maxParticles !== 32 || ps.main.playOnAwake || ps.main.startLifetime.constant <= 0 || !ps.shape?.shape || !ps.emission.enable) throw new Error('粒子参数无效：' + id);
                prepared.set(id, ps);
            }
        } catch (error) { if (material !== this.material) material.destroy(); throw error; }
        this.material = material;
        for (const [id, ps] of prepared) this.definitions.set(id, ps);
    }
    create(id: string): ParticleEffect {
        const template = this.definitions.get(id);
        if (!template || !this.material) throw new Error('未加载粒子：' + id);
        return new ParticleEffect(id, template, this.material);
    }
    destroy() { this.definitions.clear(); this.material?.destroy(); this.material = null; }
}
/** 原生渲染器持续播放；只改变simulationSpeed控制时钟，避免play重置发射累积。 */
export class ParticleEffect {
    readonly node = new Laya.Sprite();
    readonly system: Laya.ShurikenParticle2DSystem;
    constructor(readonly id: string, template: Laya.ShurikenParticle2DSystem, material: Laya.Material) {
        this.node.name = 'particle:' + id; this.node.mouseEnabled = false;
        const renderer = this.node.addComponent(Laya.ShurikenParticle2DRenderer);
        this.system = renderer.particleSystem; template.cloneTo(this.system); renderer.sharedMaterial = material;
        this.system.main.simulationSpeed = 0;
    }
    start(parent: Laya.Sprite, x: number, y: number) {
        parent.addChild(this.node); this.node.pos(x, y); this.node.visible = true;
        this.system.stop(); this.system.emission.enable = true; this.system.play();
    }
    clock(speed: number) { this.system.main.simulationSpeed = speed; }
    clear() { this.system.stop(); this.node.visible = false; }
    destroy() { this.node.destroy(true); }
}
