/** 真实Laya渲染＋正式游戏模块的粒子验收。全部存档在内存，不使用微信账号。 */
@IEditorEnv.regClass()
export class ParticleGameCheck {
    static async render(modules: Record<string, string>, output: string, urls: string[]) {
        const playing = Laya.LayaEnv.isPlaying; Laya.LayaEnv.isPlaying = true;
        try {
            const fs = IEditorEnv.require('fs'), BufferClass = IEditorEnv.require('buffer').Buffer, loaded: Record<string, any> = {};
            fs.mkdirSync(output, { recursive: true });
            const load = (id: string): any => {
                if (loaded[id]) return loaded[id].exports;
                const module = loaded[id] = { exports: {} };
                const requireModule = (request: string) => { const parts = id.split('/'); parts.pop(); for (const part of request.split('/')) { if (part === '..') parts.pop(); else if (part !== '.') parts.push(part); } return load(parts.join('/')); };
                new Function('Laya', 'require', 'module', 'exports', modules[id])(Laya, requireModule, module, module.exports); return module.exports;
            };
            urls.forEach(url => Laya.loader.clearRes(url));
            const { SpriteFrames } = load('view/SpriteFrames'), { GameView } = load('view/GameView'), { GameSession } = load('game/GameSession'), { SaveStore } = load('storage/SaveStore');
            const { ResourcePreparation } = load('platform/ResourcePreparation'), { createGame, applyCommand } = load('game/VillageRules'), { BattleSimulation, PATH_LENGTH } = load('game/BattleSimulation');
            const { generateWave } = load('game/WaveGenerator');
            const art = new SpriteFrames(), resources = new ResourcePreparation({ download: async () => true, decode: (bundle: string) => art.loadBundle(bundle) });
            for (const bundle of ['base', 'characters', 'battle']) if (!await resources.ensure(bundle)) throw new Error(resources.states[bundle].error);
            const checks: any[] = [];
            const capture = (node: Laya.Sprite, name: string) => { const canvas = node.drawToCanvas(Math.ceil(node.width), Math.ceil(node.height), 0, 0); fs.writeFileSync(output + '/' + name + '.png', BufferClass.from(canvas.source.toDataURL('image/png').split(',')[1], 'base64')); };
            // 全6个编辑器系统经过发布数据解码，再由原生渲染器模拟。白纹理不另打图集。
            const sheet = new Laya.Scene(); sheet.size(600, 600); sheet.graphics.drawRect(0, 0, 600, 600, '#4b5740'); Laya.stage.addChild(sheet);
            const ids = ['hit_arrow', 'hit_stone', 'hit_ice', 'hit_gate', 'elite_ring', 'button_ready'];
            for (const [i, id] of ids.entries()) {
                const effect = art.particles.create(id); effect.start(sheet, 100 + i % 3 * 200, 160 + Math.floor(i / 3) * 280);
                effect.system.main.simulationSpeed = .2;
                for (let f = 0; f < 180 && effect.system.totalTime < .08; f++) await new Promise<void>(resolve => Laya.systemTimer.frameOnce(1, null, resolve));
                effect.system.main.simulationSpeed = 0;
                const count = effect.system.particlePool.activeParticleCount;
                if (!count) throw new Error('发布粒子未发射:' + id + ', time=' + effect.system.totalTime + ', frameDelta=' + Laya.timer.delta);
                checks.push({ id, count });
                const title = new Laya.Text(); title.text = id; title.color = '#fff0c8'; title.fontSize = 22; title.align = 'center'; title.size(190, 40).pos(5 + i % 3 * 200, 210 + Math.floor(i / 3) * 280); sheet.addChild(title);
            }
            await new Promise<void>(resolve => Laya.systemTimer.frameOnce(2, null, resolve));
            capture(sheet, '01_发布粒子原生实绘'); fs.writeFileSync(output+'/particle-parameters.json', JSON.stringify(checks,null,2)); sheet.destroy(true);
            for (const short of [false, true]) {
                const memory = new Map(), game = new GameSession(new SaveStore({ read: (k: string) => memory.get(k) || null, write: (k: string, v: string) => memory.set(k, v) }));
                game.state = createGame(7); game.state.people[0].elite = true; game.state.people[2].elite = true;
                const platform = { window: { windowWidth: short ? 320 : 390, windowHeight: short ? 568 : 844, screenTop: 0, statusBarHeight: short ? 20 : 47, safeArea: { top: short ? 20 : 47, bottom: short ? 568 : 810 } }, menu: { top: short ? 24 : 51, bottom: short ? 56 : 83, width: 88, height: 32, left: short ? 222 : 292, right: short ? 310 : 380 } };
                const view = new GameView(game, art, platform, () => {}, resources); Laya.stage.addChild(view.root);
                const frames = async (count: number, battle = false) => { for (let i = 0; i < count; i++) { if (battle) game.update(.05); view.update(.05); await new Promise<void>(resolve => Laya.systemTimer.frameOnce(1, null, resolve)); } };
                try {
                    await frames(25); capture(view.root, short ? '03_短屏_精英脚底' : '02_长屏_精英脚底');
                    view.panels.open({ type: 'build' }); game.state.housing++; view.refresh();
                    const houses = view.village.props.filter((p: any) => p.id.startsWith('building:house-'));
                    if (!houses.length || houses.some((p: any) => !p.visual.upgradePending || p.visual.upgrading)) throw new Error('面板内升级动作未正确待播');
                    view.panels.close(); view.update(.05);
                    if (houses.some((p: any) => !p.visual.upgrading || p.visual.upgradePending)) throw new Error('关闭面板未触发原有建筑升级动作');
                    if (view.village.particles.bursts.length) throw new Error('建筑升级仍生成粒子');
                    await frames(2); capture(view.root, short ? '05_短屏_升级' : '04_长屏_升级');
                    game.state.day = 60; game.state.completed = 59; game.state.wave = generateWave(game.state);
                    game.state.towers.forEach((t: any, i: number) => { t.kind = ['ARROW','STONE','SLOW','ARROW'][i]; t.level = 1; t.operator = game.state.people[i].id; });
                    applyCommand(game.state, { type: 'NIGHT' }); game.battle = new BattleSimulation(game.state); view.refresh();
                    const kinds = ['enemy_raider','enemy_boar','enemy_armored','enemy_disruptor'];
                    game.battle.enemies = kinds.map((kind, i) => ({ seq: 100+i, kind, appearanceSeed: i*89, hp: 1000, speed: 10, slow: 0, slowTicks: 0, born: 0, summoned: 0, progress: PATH_LENGTH * (.28+i*.14) }));
                    await frames(9, true); capture(view.root, short ? '07_短屏_战斗粒子' : '06_长屏_战斗粒子');
                    const button = view.hud.bellParticles.effect;
                    if (!button.system.particlePool.activeParticleCount) throw new Error('可用的大王之心未发射粒子');
                    // 必须存在实际发射的命中粒子才能检查冻结，不能让空集合的every冒充验证通过。
                    for (let i = 0; i < 40 && !view.village.particles.bursts.some((b: any) => b.effect.system.particlePool.activeParticleCount > 0); i++) await frames(1, true);
                    const activeImpacts = view.village.particles.bursts.filter((b: any) => b.effect.system.particlePool.activeParticleCount > 0);
                    const before = activeImpacts.length;
                    if (!before) throw new Error('暂停验收缺少可见命中粒子');
                    game.pause('CHOICE'); view.update(.05);
                    const frozen = activeImpacts.every((b: any) => b.effect.system.main.simulationSpeed === 0);
                    if (!frozen) throw new Error('暂停未冻结命中粒子');
                    game.resume('CHOICE'); game.state.settings.speed = 3;
                    game.state.houses = 5; game.state.people.forEach((p: any) => p.elite = true);
                    while (game.state.people.length < 20) game.state.people.push({ ...game.state.people[4], id: 'particle-stress-'+game.state.people.length, spouse: null, elite: true });
                    game.battle.enemies = Array.from({ length: 40 }, (_, i) => ({ ...game.battle.enemies[0], seq: 200+i, kind: kinds[i%4], progress: PATH_LENGTH*(i+1)/42, hp: 10000 }));
                    view.refresh(); await frames(45, true); capture(view.root, short ? '09_短屏_20精英40敌人三倍速' : '08_长屏_20精英40敌人三倍速');
                    checks.push({ short, freeze: frozen, impactsBeforePause: before, upgradeMotionPreserved: true, people: game.state.people.length, enemies: game.battle.enemies.length, rings: view.village.particles.rings.size, bursts: view.village.particles.bursts.length, ringParticles: [...view.village.particles.rings.values()].reduce((n:number,e:any)=>n+e.system.particlePool.activeParticleCount,0) });
                } finally { view.destroy(); }
            }
            resources.destroy(); art.destroy(); fs.writeFileSync(output+'/native-checks.json', JSON.stringify(checks,null,2)); return checks;
        } finally { Laya.LayaEnv.isPlaying = playing; }
    }
}
