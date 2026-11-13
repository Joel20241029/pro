interface ParticleRecipe { id: string; bundle: string; color: string; lifetime: number; speed: number; size: number; count: number; rate: number; gravity: number; }
@IEditorEnv.regClass()
export class ParticleWorkshopScene {
    static async build(effects: ParticleRecipe[], shader: string) {
        Laya.ShaderParser.parse(shader);
        const mat = new Laya.Material(); mat.setShaderName("VillageParticle");
        mat.materialRenderMode = Laya.MaterialRenderMode.RENDERMODE_CUSTOME;
        mat.cull = Laya.RenderState.CULL_NONE; mat.depthTest = Laya.RenderState.DEPTHTEST_OFF; mat.depthWrite = false;
        mat.blend = Laya.RenderState.BLEND_ENABLE_ALL; mat.blendSrc = Laya.RenderState.BLENDPARAM_SRC_ALPHA; mat.blendDst = Laya.RenderState.BLENDPARAM_ONE_MINUS_SRC_ALPHA;
        mat.setTexture("u_Texture", Laya.Texture2D.whiteTexture);
        await IEditorEnv.CreateAssetUtil.createMaterial(mat, "particleAuthoring/materials/pixel.lmat");
        const saved: string[] = [];
        for (const effect of effects) {
            const node = new Laya.Sprite(); node.name = effect.id;
            const renderer = node.addComponent(Laya.ShurikenParticle2DRenderer); renderer.sharedMaterial = mat;
            const ps = renderer.particleSystem, main = ps.main;
            // 非循环突发也保留1秒发射窗口；3倍速/帧间隔上限下第一帧不能先越过duration而跳过burst。
            main.playOnAwake = false; main.looping = effect.rate > 0; main.duration = effect.rate ? 4 : 1;
            main.unitPixels = 1; main.maxParticles = 32;
            main.startLifetime.constant = effect.lifetime;
            main.startSpeed.mode = Laya.ParticleMinMaxCurveMode.TwoConstants;
            main.startSpeed.constantMin = effect.speed * .6; main.startSpeed.constantMax = effect.speed;
            main.startSize.mode = Laya.ParticleMinMaxCurveMode.TwoConstants;
            main.startSize.constantMin = effect.size * .6; main.startSize.constantMax = effect.size;
            main.startSizeY = main.startSizeX.clone(); // 原生反序列化两轴setter会同步模式，必须显式保持一致。
            main.startRotation.constant = 45;
            const rgb = parseInt(effect.color.slice(1), 16); main.startColor.color = new Laya.Color((rgb >> 16) / 255, ((rgb >> 8) & 255) / 255, (rgb & 255) / 255, 1);
            main.gravityModifier = new Laya.Vector2(0, effect.gravity);
            main.simulationSpace = Laya.Particle2DSimulationSpace.Local;
            // 固定的纯表现种子保证编辑器与运行纹理分布可复核，不消费村庄业务随机流。
            main.autoRandomSeed = false; main.randomSeed = 137;
            ps.emission.enable = true; ps.emission.rateOverTime = effect.rate;
            if (effect.count) { const burst = new Laya.EmissionBurst(); burst.time = 0; burst.count = effect.count; ps.emission.bursts = [burst]; }
            ps.shape = new Laya.Shape2DModule(); ps.shape.enable = true;
            const shape = new Laya.Circle2DShape(); shape.radius = effect.id === "elite_ring" ? 20 : .1;
            if (effect.id === "elite_ring") { shape.emitFromEdge = true; shape.scaleY = .35; }
            ps.shape.shape = shape;
            const colors = new Laya.ColorOverLifetimeModule(); colors.enable = true; colors.color.mode = Laya.ParticleMinMaxGradientMode.Gradient;
            const gradient = colors.color.gradient; gradient.addColorRGB(0, new Laya.Color(1, 1, 1, 1)); gradient.addColorRGB(1, new Laya.Color(1, 1, 1, 1));
            gradient.addColorAlpha(0, .9); gradient.addColorAlpha(.5, .8); gradient.addColorAlpha(1, 0); ps.colorOverLifetime = colors;
            const sizes = new Laya.Size2DOverLifetimeModule(); sizes.enable = true; sizes.size.mode = Laya.ParticleMinMaxCurveMode.Curve;
            sizes.size.curve = new Laya.GradientDataNumber(); sizes.size.curve.add(0, 1); sizes.size.curve.add(1, .2); sizes.y = sizes.x.clone(); ps.size2DOverLifetime = sizes;
            await IEditorEnv.CreateAssetUtil.createPrefab(node, "particleAuthoring/prefabs/" + effect.id + ".lh");
            node.destroy(true); saved.push(effect.id);
        }
        return { saved, nativeParticle: true };
    }
}
