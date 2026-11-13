import { WORLD_PARTICLE_3D, ELITE_RING_3D, WORLD_PARTICLE_BOUNDS_3D } from '../../../../../../project/LayaProject/src/view/config/WorldParticle3DConfig';
import { WORLD_3D } from '../../../../../../project/LayaProject/src/view/config/World3DConfig';

/** 原生场景进程制作入口：所有效果使用三维网格粒子，并由编辑器正式序列化，非手写伪 .lh。 */
@IEditorEnv.regClass()
export class WorldParticle3DWorkshopScene {
    static async build() {
        const root = 'world3d/effects/';
        const material = new Laya.ShurikenParticleMaterial();
        material.renderMode = Laya.ShurikenParticleMaterial.RENDERMODE_ALPHABLENDED;
        material.depthTest = Laya.RenderState.DEPTHTEST_LEQUAL; material.depthWrite = false;
        material.cull = Laya.RenderState.CULL_BACK;
        await IEditorEnv.CreateAssetUtil.createMaterial(material, root + 'materials/fragment.lmat');
        const mesh = Laya.PrimitiveMesh.createBox(1, 1, 1);
        await IEditorEnv.CreateAssetUtil.createMesh(mesh, root + 'meshes/fragment.lm');
        const saved: string[] = [];
        for (const [id, effect] of Object.entries(WORLD_PARTICLE_3D)) {
            const node = new Laya.Sprite3D(id), renderer = node.addComponent(Laya.ShurikenParticleRenderer);
            renderer.sharedMaterial = material;
            // renderMode 4 是引擎定义的 MESH：碎粒有真实三维体积，与模型共用深度缓冲。
            renderer.renderMode = 4; renderer.mesh = mesh;
            renderer.castShadow = false; renderer.receiveShadow = false;
            const ps = renderer.particleSystem, ring = id === 'elite_ring', units = WORLD_3D.pixelsPerUnit;
            ps.playOnAwake = false; ps.looping = ring; ps.duration = ring ? 4 : 1;
            ps.maxParticles = 32; ps.autoRandomSeed = false; ps.randomSeed[0] = 137;
            ps.simulationSpace = 1; // 原生3D枚举：1 Local，人物脚底标识随人移动，不留下移动拖尾。
            ps.scaleMode = 0; ps.simulationSpeed = 1;
            ps.startLifetimeType = 0; ps.startLifetimeConstant = effect.lifetime;
            ps.startSpeedType = 2; ps.startSpeedConstantMin = effect.speed * .6 / units; ps.startSpeedConstantMax = effect.speed / units;
            ps.startSizeType = 2; ps.startSizeConstantMin = effect.size * .6 / units; ps.startSizeConstantMax = effect.size / units;
            ps.threeDStartRotation = true; ps.startRotationType = 2;
            ps.startRotationConstantMinSeparate = new Laya.Vector3(0, 0, 0);
            ps.startRotationConstantMaxSeparate = new Laya.Vector3(Math.PI, Math.PI, Math.PI);
            const rgb = parseInt(effect.color.slice(1), 16);
            ps.startColorType = 0; ps.startColorConstant = new Laya.Vector4((rgb >> 16) / 255, ((rgb >> 8) & 255) / 255, (rgb & 255) / 255, 1);
            ps.gravityModifier = effect.gravity / units;
            ps.emission.enable = true; ps.emission.emissionRate = effect.rate;
            if (effect.count) ps.emission.addBurst(new Laya.Burst(0, effect.count, effect.count));
            if (ring) {
                const circle = new Laya.CircleShape(); circle.radius = ELITE_RING_3D.radiusPixels / units;
                circle.emitFromEdge = true; circle.enable = true; ps.shape = circle;
                // 原生 CircleShape 的发射平面为 XY；旋转90度后真正铺在世界XZ地面上。
                node.transform.localRotationEuler = new Laya.Vector3(90, 0, 0);
            } else {
                const sphere = new Laya.SphereShape(); sphere.radius = .02; sphere.enable = true; ps.shape = sphere;
            }
            const colors = new Laya.Gradient();
            colors.addColorRGB(0, new Laya.Color(1, 1, 1, 1)); colors.addColorRGB(1, new Laya.Color(1, 1, 1, 1));
            colors.addColorAlpha(0, .9); colors.addColorAlpha(.5, .8); colors.addColorAlpha(1, 0);
            const fading = new Laya.ColorOverLifetime(Laya.GradientColor.createByGradient(colors)); fading.enable = true; ps.colorOverLifetime = fading;
            const sizes = new Laya.GradientDataNumber(); sizes.add(0, 1); sizes.add(1, .2);
            const shrinking = new Laya.SizeOverLifetime(Laya.GradientSize.createByGradient(sizes)); shrinking.enable = true; ps.sizeOverLifetime = shrinking;
            const extent = WORLD_PARTICLE_BOUNDS_3D;
            ps.customBounds = new Laya.Bounds(new Laya.Vector3(-extent, -extent, -extent), new Laya.Vector3(extent, extent, extent));
            await IEditorEnv.CreateAssetUtil.createPrefab(node, root + 'prefabs/' + id + '.lh');
            node.destroy(true); saved.push(id);
        }
        return { saved, pixelsPerUnit: WORLD_3D.pixelsPerUnit, native3D: true, meshParticles: true };
    }

    /** 真引擎检查：原生 .lh 解码后逐步推进，验证暂停不偷跑、倍速仅推进一次、清理无残粒。 */
    static async verify(output: string) {
        const fs = IEditorEnv.require('fs'), wasPlaying = Laya.LayaEnv.isPlaying;
        Laya.LayaEnv.isPlaying = true;
        const scene = new Laya.Scene3D(); Laya.stage.addChild(scene);
        const camera = new Laya.Camera(0, .1, 30); scene.addChild(camera);
        camera.transform.position = new Laya.Vector3(0, 2, 6);
        camera.transform.localRotationEuler = new Laya.Vector3(-18, 0, 0);
        const rows: any[] = [];
        try {
            for (const [id, recipe] of Object.entries(WORLD_PARTICLE_3D)) {
                const url = 'world3d/effects/prefabs/' + id + '.lh'; Laya.loader.clearRes(url);
                const prefab = await Laya.loader.load(url) as Laya.Prefab;
                if (!prefab) throw new Error('无法加载原生3D特效：' + id);
                const node = prefab.create() as Laya.Sprite3D; scene.addChild(node);
                const renderer = node.getComponent(Laya.ShurikenParticleRenderer), ps = renderer.particleSystem;
                if (renderer.renderMode !== 4 || !renderer.mesh || renderer.sharedMaterial.depthTest !== Laya.RenderState.DEPTHTEST_LEQUAL) throw new Error('3D网格/深度配置错误：' + id);
                ps.play(); ps.simulate(0, true); ps.simulate(.1, false);
                // aliveParticleCount 统计已上传的粒子；发射后上传顶点才能检查，不能将未上传误判为未发射。
                ps.addNewParticlesToVertexBuffer(); camera.render(scene);
                const before = ps.emissionTime, alive = ps.aliveParticleCount;
                if (!alive || !ps.isPaused || Math.abs(before - .1) > .00001) throw new Error('原生首次推进错误：' + JSON.stringify({ id, before, alive, paused: ps.isPaused, emitting: ps.isEmitting, enabled: ps.emission.enable, bursts: ps.emission.getBurstsCount(), lifetime: ps.startLifetimeConstant, maximum: ps.maxParticles }));
                await new Promise<void>(resolve => Laya.systemTimer.frameOnce(4, null, resolve));
                if (ps.emissionTime !== before) throw new Error('暂停期间原生粒子偷跑：' + id);
                ps.simulate(.15, false);
                if (Math.abs(ps.emissionTime - .25) > .00001) throw new Error('3倍速推进不等于0.05×3：' + id);
                const clone = renderer.sharedMaterial.clone();
                if (clone === renderer.sharedMaterial) throw new Error('粒子材质克隆失败');
                const originalDepth = renderer.sharedMaterial.depthTest; clone.depthTest = Laya.RenderState.DEPTHTEST_OFF;
                if (renderer.sharedMaterial.depthTest !== originalDepth) throw new Error('粒子实例材质串改');
                clone.destroy();
                ps.emission.enable = false; ps.stop(); ps.simulate(0, true);
                if (ps.aliveParticleCount !== 0 || !ps.isPaused) throw new Error('原生残粒未清空：' + id);
                rows.push({ id, particlesAtPointOne: alive, count: recipe.count, pausedFrames: 4, manualTimeAfterThreeSpeed: .25, resetAlive: ps.aliveParticleCount, renderMode: renderer.renderMode, materialIsolated: true });
                node.destroy(true);
            }
            fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(output + '/native-verification.json', JSON.stringify(rows, null, 2));
            return rows;
        } finally { scene.destroy(true); Laya.LayaEnv.isPlaying = wasPlaying; }
    }
}
