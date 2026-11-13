/** 原生编辑器模型制作/导出入口；不手写 LH，也不复制 library 中未解析的 UUID 文件。 */
@IEditorEnv.regClass()
export class WorldModelWorkshopScene {
    static prepareCreated(id: string) {
        const node = EditorEnv.scene.getNodeById(id) as unknown as Laya.Sprite3D;
        if (!(node instanceof Laya.Sprite3D)) throw new Error('编辑器节点不是Sprite3D：' + id);
        let minY = Infinity, maxY = -Infinity;
        const clips: string[] = [];
        WorldModelWorkshopScene.walk(node, child => {
            const animator = child.getComponent(Laya.Animator);
            if (animator) for (let i = 0; i < animator.controllerLayerCount; i++) {
                const layer = animator.getControllerLayer(i);
                for (const state of layer.states) { if (!state.clip || state.clip.duration() <= 0) throw new Error('模型动画为空：' + state.name); if (!clips.includes(state.name)) clips.push(state.name); }
                const idle = layer.getAnimatorState('idle');
                if (idle) { layer.defaultState = idle; layer.playOnWake = true; }
            }
            const renderer = child.getComponent(Laya.MeshRenderer);
            if (renderer) {
                if (!child.getComponent(Laya.MeshFilter)?.sharedMesh) throw new Error('编辑器模型缺失网格：' + child.name);
                const positions: Laya.Vector3[] = [], point = new Laya.Vector3();
                child.getComponent(Laya.MeshFilter).sharedMesh.getPositions(positions);
                for (const vertex of positions) {
                    Laya.Vector3.transformCoordinate(vertex, child.transform.worldMatrix, point);
                    minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
                }
            }
        });
        if (!Number.isFinite(maxY - minY)) throw new Error('没有有效模型边界');
        return { height: maxY - minY, minY, maxY, clips, components: WorldModelWorkshopScene.inspect(node) };
    }

    static async exportAssets(paths: string[], output: string) {
        const assets = paths.map(path => {
            const asset = EditorEnv.assetMgr.getAsset(path);
            if (!asset) throw new Error('资源数据库未完成导入：' + path);
            return asset;
        });
        const exporter = new IEditorEnv.ExportAssetTool({ useSafeFileExtensions: true, allowTextureCompressedFormat: false, exportAutoAtlas: false });
        await exporter.setAssets(assets);
        if (exporter.getBrokenLinks().size || exporter.getOutputPathConflicts().size) throw new Error('导出依赖缺失或路径冲突');
        const files = new Map<string, IEditorEnv.IOutFileInfo>();
        await exporter.write(output, files);
        const manifest = {
            roots: assets.map(asset => ({ id: asset.id, source: asset.file, relativePath: exporter.generateAssetOutputPath(asset) })),
            assets: Array.from(exporter.items.values()).map(item => ({ id: item.asset.id, source: item.asset.file, relativePath: item.outPath, dependencies: (item.deps || []).map(dep => dep.target.id) })),
            files: Array.from(files.entries()).map(([key, file]) => ({ key, id: file.asset?.id, source: file.asset?.file, relativePath: file.ext ? key.replace(/\.[^/.]+$/, '.' + file.ext) : key, noFile: file.noFile, ext: file.ext }))
        };
        const fs = IEditorEnv.require('fs'); fs.mkdirSync(output, { recursive: true });
        fs.writeFileSync(output + '/native-export-manifest.json', JSON.stringify(manifest, null, 2));
        return manifest;
    }

    static async verifyMale(output: string) {
        const fs = IEditorEnv.require('fs'); fs.mkdirSync(output, { recursive: true });
        const wasPlaying = Laya.LayaEnv.isPlaying; Laya.LayaEnv.isPlaying = true;
        const scene = new Laya.Scene3D(); Laya.stage.addChild(scene);
        const camera = new Laya.Camera(1, .1, 100); scene.addChild(camera);
        camera.orthographic = true; camera.orthographicVerticalSize = 3.8; camera.aspectRatio = 1;
        camera.clearColor = new Laya.Color(.25, .30, .22, 1);
        camera.transform.position = new Laya.Vector3(0, 24.9, 24);
        camera.transform.lookAt(new Laya.Vector3(0, .9, 0), new Laya.Vector3(0, 1, 0), false, true);
        const target = new Laya.RenderTexture(512, 512, Laya.RenderTargetFormat.R8G8B8A8, Laya.RenderTargetFormat.DEPTH_16);
        try {
            const url = 'world3d/characters/prefabs/male.lh'; Laya.loader.clearRes(url);
            const prefab = await Laya.loader.load(url) as Laya.Prefab, node = prefab.create() as Laya.Sprite3D;
            scene.addChild(node);
            const animators: Laya.Animator[] = [], skins: Laya.SkinnedMeshRenderer[] = [], materials: any[] = [];
            WorldModelWorkshopScene.walk(node, child => {
                const animator = child.getComponent(Laya.Animator); if (animator) { animators.push(animator); animator.cullingMode = Laya.Animator.CULLINGMODE_ALWAYSANIMATE; }
                const skin = child.getComponent(Laya.SkinnedMeshRenderer); if (skin) skins.push(skin);
                const renderer = child.getComponent(Laya.MeshRenderer); if (renderer) for (const material of renderer.sharedMaterials) materials.push({ node: child.name, type: material.constructor.name });
            });
            if (!animators.length || !skins.length) throw new Error('缺少原生 Animator/SkinnedMeshRenderer');
            const frames: any[] = [];
            let hasRenderedPixels = false;
            for (const clip of ['idle', 'walk', 'chop']) for (const time of [0, .35]) {
                WorldModelWorkshopScene.walk(node, child => { if (child.name === 'ToolAxe') child.transform.localScale = new Laya.Vector3(clip === 'chop' ? 1 : 0, clip === 'chop' ? 1 : 0, clip === 'chop' ? 1 : 0); });
                for (const animator of animators) { animator.speed = 1; animator.play(clip, 0, time); }
                await new Promise<void>(resolve => Laya.systemTimer.frameOnce(2, null, resolve));
                for (const animator of animators) animator.speed = 0;
                Laya.Camera.drawRenderTextureByScene(camera, scene, target);
                const pixels = await target.getDataAsync(0, 0, 512, 512, new Uint8Array(512 * 512 * 4));
                hasRenderedPixels = hasRenderedPixels || Array.from(pixels as Uint8Array).some(value => value !== 0);
                fs.writeFileSync(`${output}/${clip}-${time}.rgba`, pixels);
                frames.push({ clip, time, bones: skins.map(skin => skin.bones.map(bone => ({ name: bone.name, matrix: Array.from(bone.transform.worldMatrix.elements) }))) });
            }
            const red: any[] = [];
            WorldModelWorkshopScene.walk(node, child => {
                const renderer = child.getComponent(Laya.MeshRenderer); if (!renderer) return;
                const original = renderer.sharedMaterials;
                const clones = original.map(material => {
                    if (!material.getColor('u_AlbedoColor')) throw new Error('Surface没有u_AlbedoColor');
                    const clone = material.clone(); clone.setColor('u_AlbedoColor', new Laya.Color(1, .16, .16, 1)); return clone;
                });
                renderer.sharedMaterials = clones; red.push({ renderer, original, clones });
            });
            Laya.Camera.drawRenderTextureByScene(camera, scene, target);
            fs.writeFileSync(output + '/surface-red.rgba', await target.getDataAsync(0, 0, 512, 512, new Uint8Array(512 * 512 * 4)));
            for (const entry of red) { entry.renderer.sharedMaterials = entry.original; for (const clone of entry.clones) clone.destroy(); }
            const animationChanges = ['idle', 'walk', 'chop'].map(clip => {
                const pair = frames.filter(frame => frame.clip === clip);
                let maximumMatrixDelta = 0;
                pair[0].bones.forEach((bones: any[], skinIndex: number) => bones.forEach((bone, boneIndex) => bone.matrix.forEach((value: number, index: number) => {
                    maximumMatrixDelta = Math.max(maximumMatrixDelta, Math.abs(value - pair[1].bones[skinIndex][boneIndex].matrix[index]));
                })));
                if (maximumMatrixDelta < .00001) throw new Error('骨骼姿态没有实际变化：' + clip);
                return { clip, maximumMatrixDelta };
            });
            const report = { inspect: WorldModelWorkshopScene.inspect(node), materials, frames, animationChanges, nativeSkin: true, redMaterialClone: true, capture: { width: 512, height: 512, format: 'RGBA8', camera: 'orthographic', hasRenderedPixels, visualAcceptance: false } };
            fs.writeFileSync(output + '/male-verification.json', JSON.stringify(report, null, 2));
            return report;
        } finally { target.destroy(); scene.destroy(true); Laya.LayaEnv.isPlaying = wasPlaying; }
    }

    private static inspect(root: Laya.Sprite3D) {
        const rows: any[] = [];
        WorldModelWorkshopScene.walk(root, child => {
            const renderer = child.getComponent(Laya.MeshRenderer), skin = child.getComponent(Laya.SkinnedMeshRenderer), animator = child.getComponent(Laya.Animator);
            if (renderer || animator) rows.push({ name: child.name, renderer: renderer?.constructor.name, meshFilter: !!child.getComponent(Laya.MeshFilter)?.sharedMesh, skinBones: skin?.bones.length, clips: animator ? animator.getControllerLayer(0).states.map(state => ({ name: state.name, duration: state.clip.duration() })) : undefined });
        });
        return rows;
    }
    private static walk(node: Laya.Sprite3D, visit: (node: Laya.Sprite3D) => void) {
        visit(node); for (let i = 0; i < node.numChildren; i++) { const child = node.getChildAt(i); if (child instanceof Laya.Sprite3D) WorldModelWorkshopScene.walk(child, visit); }
    }
}
