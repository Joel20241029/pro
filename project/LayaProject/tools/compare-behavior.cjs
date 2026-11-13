// Compare two CommonJS builds. Baselines and output belong outside the repository.
// Usage: node tools/compare-behavior.cjs <before/src> <after/src>
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const [before, after] = process.argv.slice(2).map(p => path.resolve(p));
if (!before || !after) throw new Error('Pass both compiled src directories');
const load = (root, name) => require(path.join(root, name));

function ruleTrace(root) {
    const rules = load(root, 'game/VillageRules.js');
    const { BattleSimulation } = load(root, 'game/BattleSimulation.js');
    const hash = createHash('sha256');
    const counts = { commands: 0, queries: 0, battles: 0, steps: 0 };
    const observedRules = { ...rules };
    for (const name of ['createGame', 'applyCommand', 'finishNight', 'economy', 'canMarry', 'birthUnavailableReason', 'capacity']) {
        const original = rules[name];
        // Observe the strategy's public calls only; internal module boundaries are
        // expected to change and must not create additional observation events.
        observedRules[name] = function (...args) {
            let result, error;
            try { result = original.apply(this, args); }
            catch (caught) { error = { name: caught.name, message: caught.message }; }
            const mutating = ['createGame', 'applyCommand', 'finishNight'].includes(name);
            counts[mutating ? 'commands' : 'queries']++;
            // Compare full mutable state after commands and exact query outputs.
            hash.update(JSON.stringify([name, mutating ? args : null, result, error]) + '\n');
            if (error) throw Object.assign(new Error(error.message), { name: error.name });
            return result;
        };
    }
    const step = BattleSimulation.prototype.step;
    BattleSimulation.prototype.step = function () {
        if (this.tick === 0) counts.battles++;
        step.call(this); counts.steps++;
        hash.update(JSON.stringify([this.tick, this.gate, this.enemies, this.shots, this.bellTicks,
            this.bellUsed, this.outcome, this.operators, this.charge, this.queued, this.cursor, this.seq]) + '\n');
    };
    const simulator = path.join(__dirname, 'simulate-growth.cjs');
    let runs;
    try {
        const module = { exports: {} };
        vm.runInNewContext(fs.readFileSync(simulator, 'utf8'), {
            module, exports: module.exports,
            process: { env: { DAIDAI_TEST_BUILD: root } },
            require: id => id === root + '/game/VillageRules' ? observedRules : require(id)
        }, { filename: simulator });
        runs = JSON.parse(JSON.stringify([1, 2, 3, 11, 123].map(seed => module.exports.play(seed, 300, true))));
    } finally {
        BattleSimulation.prototype.step = step;
    }
    return { counts, digest: hash.digest('hex'), runs };
}

function failureTrace(root) {
    const { createGame, applyCommand } = load(root, 'game/VillageRules.js');
    const commands = [
        { type: 'SPEED', value: 0 }, { type: 'SPEED', value: 4 }, { type: 'MUSIC', enabled: 'yes' },
        { type: 'FAVORITE', id: 'missing' }, { type: 'CHOOSE', value: 'accept' }, { type: 'FINALIZE' },
        { type: 'JOB', id: 'missing', job: 'FARM' }, { type: 'JOB', id: '1:4', job: 'FARM' },
        { type: 'JOB', id: '1:1', job: 'CARE', child: '1:2' },
        { type: 'FAMILY', a: '1:1', b: '1:2' }, { type: 'BIRTH', family: 'missing', carer: '1:1' },
        { type: 'BIRTH', family: '1:f1', carer: 'missing' }, { type: 'BUILD', kind: 'FARM' },
        { type: 'BUILD', kind: 'HOUSE' }, { type: 'REPAIR' },
        { type: 'TOWER', index: 6, kind: 'ARROW' }, { type: 'TOWER', index: 0, kind: 'ARROW' },
        { type: 'TOWER', index: 2, kind: 'STONE' }, { type: 'UPGRADE', index: 2 },
        { type: 'OPERATOR', index: 0, id: '' }, { type: 'OPERATOR', index: 2, id: '1:1' },
        { type: 'DAILY_RATION', date: 'bad-date' }
    ];
    return commands.map(command => {
        const state = createGame(123); state.food = 0; state.wood = 0;
        let result, error;
        try { result = applyCommand(state, command); }
        catch (caught) { error = { name: caught.name, message: caught.message }; }
        return { command, result, error, state };
    });
}

function sessionTrace(root) {
    const { GameSession } = load(root, 'game/GameSession.js');
    const { SaveStore } = load(root, 'storage/SaveStore.js');
    const events = [], snapshots = [], values = new Map();
    let failure = null, today = '2026-11-12';
    const storage = {
        read(key) { events.push(['read', key]); return values.get(key) ?? null; },
        write(key, value) {
            events.push(['write', key, value]);
            if (failure === 'before') throw new Error('simulated write-before failure');
            values.set(key, value);
            if (failure === 'after') throw new Error('simulated write-after failure');
        }
    };
    let game = new GameSession(new SaveStore(storage), () => today);
    const observe = label => {
        snapshots.push(JSON.stringify({ label, state: game.state, pending: game.saves.pending,
            pauses: [...game.pauses], boot: game.boot, error: game.error, revision: game.villageRevision,
            errorRevision: game.errorRevision, daily: game.dailyRationDate, battle: game.battle ? { ...game.battle, feedback: undefined } : null }));
    };
    game.changed = () => observe('changed');
    const action = (name, operation) => { events.push(['action', name]); operation(); observe(name); };
    const now = Date.now; Date.now = () => 1794456000123;
    try {
        action('load', () => game.load()); action('enter', () => game.enter());
        action('new', () => game.newVillage()); action('ration', () => game.claimDailyRation());
        action('reject job', () => game.command({ type: 'JOB', id: 'missing', job: 'FARM' }));
        action('birth', () => game.command({ type: 'BIRTH', family: '1:f1', carer: '1:2' }));
        action('night', () => game.command({ type: 'NIGHT' })); action('bell', () => game.bell());
        action('tick', () => game.update(.25));
        action('pause choice', () => game.pause('CHOICE'));
        action('swap', () => game.reassign(0, game.battle.operators[1]));
        action('pause user', () => game.pause('USER')); action('close choice', () => game.resume('CHOICE'));
        action('paused tick', () => game.update(10)); action('resume', () => game.resume('USER'));
        action('triple speed', () => game.command({ type: 'SPEED', value: 3 }));
        action('hide', () => game.hide()); action('background tick', () => game.update(10));
        action('show', () => game.show()); action('continue', () => game.resume('WAIT_RESUME'));
        for (let i = 0; i < 300 && game.state.phase === 'NIGHT'; i++) game.update(.25);
        observe('battle end');
        action('clean start', () => game.cleanStart()); action('new ration', () => game.claimDailyRation());
        for (const mode of ['before', 'after']) {
            failure = mode; action('save failure ' + mode, () => game.command({ type: 'MUSIC', enabled: false }));
            action('frozen command', () => game.command({ type: 'BUILD', kind: 'HOUSE' }));
            failure = null; action('retry', () => game.retry());
        }
        action('inherited restart', () => game.newVillage(game.state.legacy.traits[0]));
        action('ration after restart', () => game.claimDailyRation());
        today = '2026-11-13'; action('next day', () => game.enter());
        action('next ration', () => game.claimDailyRation());
        game = new GameSession(new SaveStore(storage), () => today); game.changed = () => observe('reopen changed');
        action('reopen', () => game.load()); action('reopen enter', () => game.enter());
    } finally { Date.now = now; }
    return { events, snapshots, values: [...values] };
}

const beforeConfig = load(before, 'game/GameConfig.js'), afterConfig = load(after, 'game/GameConfig.js');
assert.deepEqual(Object.keys(afterConfig).sort(), Object.keys(beforeConfig).sort());
for (const name of Object.keys(beforeConfig)) {
    assert.equal(JSON.stringify(afterConfig[name]), JSON.stringify(beforeConfig[name]), `config and key order: ${name}`);
}
assert.deepEqual(failureTrace(after), failureTrace(before), 'failed commands, messages and resulting state');
const oldRules = ruleTrace(before), newRules = ruleTrace(after);
assert.deepEqual(newRules, oldRules, 'rules, queries, full states, RNG and every combat step');
const oldSession = sessionTrace(before), newSession = sessionTrace(after);
assert.deepEqual(newSession, oldSession, 'save bytes/order, pauses, changes, revision and lifecycle');
console.log(JSON.stringify({ status: 'equal', configurationExports: Object.keys(beforeConfig).length,
    failureCases: failureTrace(before).length, simulation: { ...newRules.counts, digest: newRules.digest,
        runs: newRules.runs.map(({ seed, completed, births, retired, upgrades }) => ({ seed, completed, births, retired, upgrades })) },
    session: { storageAndActions: newSession.events.length, snapshots: newSession.snapshots.length } }, null, 2));
