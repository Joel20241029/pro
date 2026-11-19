const assert = require('node:assert/strict');
const { test } = require('node:test');
const read = name => require(`${process.env.DAIDAI_TEST_BUILD}/${name}.js`);
const { DAILY_TASKS, DENSE_TASK_GOALS, TASK_GOALS, featureUnlocked } = read('config/DailyTaskConfig');
const { createGame, applyCommand } = read('game/VillageRules');
const { clone } = read('game/GameState');
const { generateWave } = read('game/WaveGenerator');
const { BattleSimulation } = read('game/BattleSimulation');
const { DailyTaskCombat } = read('game/DailyTaskCombat');
const { prepareDailyTasks, creditTaskCommand, creditTaskVictory } = read('game/DailyTasks');
const { claimDailyTask, dailyTaskStatus, dailyTasksClaimable, validDailyTaskDay } = read('game/DailyTaskState');
const { SaveStore } = read('storage/SaveStore');
const { GameSession } = read('game/GameSession');
const { gateCapacity, storageCapacity } = read('game/Growth');

const today = '2026-11-18', tomorrow = '2026-11-19';
function village(seed = 42) {
    const s = createGame(seed);
    s.completed = s.legacy.bestNight = 6;
    s.day = 7; s.wave = generateWave(s);
    return s;
}
function attach(s, options) {
    s.dailyTasks = { date: today, tasks: options.map(task => ({ goal: 1, progress: 0,
        material: 'wood', reward: 8, claimed: false, ...task })) };
    return s;
}
function savedSession(s) {
    let date = today;
    const slots = new Map(), port = { read: key => slots.get(key) ?? null, write: (key,value) => slots.set(key,value) };
    const store = new SaveStore(port);
    store.inspect(); store.prepare(s); store.commit();
    const open = () => { const game = new GameSession(new SaveStore(port), () => date); game.load(); return game; };
    return { open, port, next: () => date = tomorrow };
}
test('three entrances open at 1, 3 and 6; existing scores qualify on loaded saves', () => {
    assert.equal(Object.keys(TASK_GOALS).length, 30);
    for (const [feature, threshold] of [['ranking',1],['tactics',3],['dailyTasks',6]]) {
        assert(!featureUnlocked(threshold-1,feature));
        assert(featureUnlocked(threshold,feature));
    }
    const s = createGame(1);
    s.legacy.bestNight = 5;
    prepareDailyTasks(s,today);
    assert.equal(s.dailyTasks,undefined);
    s.legacy.bestNight = 6;
    prepareDailyTasks(s,today);
    assert(validDailyTaskDay(s.dailyTasks));
});
test('generated tasks remain unchanged on same date, carry one small reward each and leave actual village RNG, towers and wave intact', () => {
    const seen = new Set();
    for (let seed=1;seed<=35;seed++) {
        const s = village(seed);
        s.wood = 150; s.food = 110; s.gate -= 20;
        const baseline = clone(s);
        prepareDailyTasks(s,today);
        assert.equal(s.dailyTasks.tasks.length, DAILY_TASKS.limit);
        assert(validDailyTaskDay(s.dailyTasks));
        assert(s.dailyTasks.tasks.reduce((sum,task) => sum+task.reward,0) <= 24);
        s.dailyTasks.tasks.forEach(t=>{
            seen.add(t.kind);
            if (t.kind === 'kills' || t.kind === 'enemyKind') {
                const [min,max] = DENSE_TASK_GOALS[t.kind];
                assert(t.goal >= min && t.goal <= max);
            }
        });
        const { dailyTasks, ...v } = s;
        assert.deepEqual(v,baseline);
        s.wood=0; s.food=0; prepareDailyTasks(s,today);
        assert.equal(s.dailyTasks,dailyTasks);
        prepareDailyTasks(s,'2026-11-17');
        assert.equal(s.dailyTasks,dailyTasks);
    }
    assert(seen.size >= 12, [...seen].join(','));
});
test('old combat task goals still load alongside the dense-wave ranges', () => {
    const s = attach(village(), [{ kind: 'kills', goal: 12 }, { kind: 'enemyKind', goal: 4, enemy: 'enemy_raider' }]);
    assert(validDailyTaskDay(s.dailyTasks));
    const loaded = savedSession(s).open();
    assert.deepEqual(loaded.state.dailyTasks, s.dailyTasks);
    s.dailyTasks.tasks[0].goal = 18;
    s.dailyTasks.tasks[1].goal = 6;
    assert(validDailyTaskDay(s.dailyTasks));
    s.dailyTasks.tasks[0].goal = 13;
    assert(!validDailyTaskDay(s.dailyTasks));
});
test('generation rejects won-night and tower goals in a doomed next wave and rejects blocked construction and nursery', () => {
    for(let seed=1;seed<=10;seed++) {
        const s=village(seed);
        s.wood=s.food=0; s.houses=100; s.gate=1;
        s.people=[]; s.families=[];
        s.towers=s.towers.map(() => ({kind:null,level:0,operator:null}));
        prepareDailyTasks(s,today);
        assert(s.dailyTasks.tasks.every(t=>t.kind==='rations'));
        assert(validDailyTaskDay(s.dailyTasks));
    }
});
test('construction and family progress advance only for real successful changes', () => {
    const s=attach(village(), [{kind:'towerBuild'},{kind:'repair'},{kind:'marriage'}]);
    s.wood=200; s.gate=gateCapacity(s)-12;
    const command=c=>{
        const before=clone(s); applyCommand(s,c); creditTaskCommand(before,s,c,today);
        return s.dailyTasks.tasks.map(t=>t.progress);
    };
    assert.deepEqual(command({type:'TOWER',index:0,kind:'SLOW'}),[0,0,0]);
    assert.deepEqual(command({type:'TOWER',index:2,kind:'ARROW'}),[1,0,0]);
    assert.deepEqual(command({type:'REPAIR'}),[1,1,0]);
    const a=s.people.find(p=>p.sex==='MALE'&&!s.families.some(f=>f.partners.includes(p.id))),b=s.people.find(p=>p.sex==='FEMALE'&&!s.families.some(f=>f.partners.includes(p.id)));
    assert.deepEqual(command({type:'FAMILY',a:a.id,b:b.id}),[1,1,1]);
});
test('production credits are booked once with the start command and never inflate the inventory', () => {
    const s=attach(village(),[{kind:'food',goal:16},{kind:'wood',goal:10},{kind:'both',goal:12,woodGoal:6}]);
    const before=clone(s);
    applyCommand(s,{type:'NIGHT'});
    const stock=[s.wood,s.food];
    creditTaskCommand(before,s,{type:'NIGHT'},today);
    assert.deepEqual(s.dailyTasks.tasks.map(t=>t.progress),[16,10,12]);
    assert.deepEqual([s.wood,s.food],stock);
});
test('successful combat counts actual kills, useful tower hits and successful tactic uses; no credit for defeat', () => {
    const s=attach(village(),[{kind:'kills',goal:6},{kind:'towersHit',goal:2},{kind:'casts'}]);
    s.towers[0].level=2; s.towers[1].level=4;
    applyCommand(s,{type:'NIGHT'});
    const combat = new DailyTaskCombat(), battle = new BattleSimulation(s,combat);
    assert(battle.bell());
    assert.equal(battle.bell(),false);
    for(let i=0;i<3600&&!battle.outcome;i++) battle.step();
    assert.equal(battle.outcome,'WIN');
    creditTaskVictory(s,tomorrow,battle,combat);
    assert(s.dailyTasks.tasks.every(t=>t.progress===0));
    creditTaskVictory(s,today,battle,combat);
    assert.deepEqual(s.dailyTasks.tasks.map(t=>t.progress),[6,2,1]);
    const lost=attach(village(),[{kind:'kills',goal:6}]);
    creditTaskVictory(lost,today,{outcome:'LOSE'},combat);
    assert.equal(lost.dailyTasks.tasks[0].progress,0);
});
test('full storage cannot claim or show red dot; once enough space exists the exact reward commits once', () => {
    const s=attach(village(),[{kind:'win',progress:1}]);
    const task=s.dailyTasks.tasks[0];
    s.wood=storageCapacity(s)-7;
    assert.equal(dailyTaskStatus(s,task),'full'); assert(!dailyTasksClaimable(s,today));
    assert.throws(()=>claimDailyTask(s,'win',today,today),/仓储/);
    s.wood--;
    assert(dailyTasksClaimable(s,today));
    claimDailyTask(s,'win',today,today);
    assert.equal(s.wood,storageCapacity(s)); assert.equal(dailyTaskStatus(s,task),'claimed');
    assert.throws(()=>claimDailyTask(s,'win',today,today),/已经领取/);
});
test('a failed claim retries the exact save candidate even at midnight; no old reward can be claimed on the new day', () => {
    const s=attach(village(),[{kind:'win',progress:1}]); s.wood=50;
    const f=savedSession(s), game=f.open(), write=f.port.write;
    f.port.write=()=>{ throw Error('write failed'); };
    game.claimTask('win',today);
    assert(game.saves.pending);
    assert.equal(game.state.wood,50);
    assert.equal(game.saves.pending.state.wood,58);
    assert(game.saves.pending.state.dailyTasks.tasks[0].claimed);
    game.claimTask('win',today);
    assert.equal(game.saves.pending.state.wood,58);
    f.next(); f.port.write=write; game.retry();
    assert.equal(game.state.wood,58);
    assert(game.state.dailyTasks.tasks[0].claimed);
    game.update(.05);
    assert.equal(game.state.dailyTasks.date,tomorrow);
    const reopened=f.open(); reopened.claimTask('win',today);
    assert.equal(reopened.state.wood,58);
    assert.match(reopened.error,/已刷新/);
});
test('midnight refreshes an existing village; a restart clears all tasks until that village unlocks them', () => {
    const s=attach(village(),[{kind:'win',progress:1,claimed:true},{kind:'repair',progress:1}]);
    const f=savedSession(s), game=f.open();
    assert.deepEqual(game.state.dailyTasks,s.dailyTasks);
    game.pause('CHOICE'); f.next(); game.update(.05);
    assert.equal(game.state.dailyTasks.date,tomorrow);
    assert(game.state.dailyTasks.tasks.every(t=>!t.claimed&&t.progress===0));
    assert.equal(f.open().state.dailyTasks.date,tomorrow);
    game.newVillage();
    assert.equal(game.state.legacy.bestNight, 0);
    assert.equal(game.state.dailyTasks, undefined);
    assert.equal(f.open().state.dailyTasks, undefined);
});
test('legacy saves may omit daily data; malformed rewards, dates and duplicate tasks fail validation', () => {
    const old=savedSession(village());
    assert.equal(old.open().state.dailyTasks.date,today);
    const s=attach(village(),[{kind:'win',progress:1}]);
    for(const corrupt of [
        d=>d.date='2026-02-30', d=>d.tasks[0].reward=9, d=>d.tasks.push(d.tasks[0]), d=>d.tasks[0].progress=2,
        d=>d.tasks[0].material='both', d=>d.tasks[0].kind='toString', d=>{d.tasks[0].kind='equipped'; d.tasks[0].tactic='unknown';}
    ]) {
        const record=clone(s.dailyTasks); corrupt(record); assert(!validDailyTaskDay(record));
    }
});
