const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw new Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
const { createGame, applyCommand, finishNight } = require(path.join(compiled, 'game/VillageRules.js'));
const { generateWave } = require(path.join(compiled, 'game/WaveGenerator.js'));
const expected = ['旭勇', '智卓', '二百', '翟毅', '周博', '赵靓', '龙龙', '昭易', '明波', '宋磊', '徐超'];

for (const route of ['birth', 'traveler']) test(`${route}: all eleven elite names occur for both sexes; ordinary personal names stay ordinary`, () => {
    const seen = { MALE: new Set(), FEMALE: new Set() }, ordinary = new Set();
    for (let i = 1; i <= 4096; i++) {
        const s = createGame(i * 99991);
        let person;
        if (route === 'birth') {
            applyCommand(s, { type: 'BIRTH', family: s.families[0].id, carer: s.people[1].id });
            person = s.people[6]; assert.equal(s.people.length, 7);
        } else {
            s.day = 4; s.completed = s.legacy.bestNight = 3; s.wave = generateWave(s);
            applyCommand(s, { type: 'NIGHT' }); finishNight(s, 200, s.towers.map(t => t.operator));
            person = s.choices.find(q => q.kind === 'TRAVELER').person;
            assert.equal(s.people.length, 6);
        }
        if (person.elite) {
            assert(expected.includes(person.name), `unexpected elite name ${person.name}`);
            seen[person.sex].add(person.name);
        } else {
            assert(!expected.includes(person.name), 'elite-only names must not enter the ordinary pool');
            if (person.name === '芊芊') { assert.equal(person.sex, 'FEMALE'); ordinary.add(person.name); }
            if (person.name === '四辈儿') { assert.equal(person.sex, 'MALE'); ordinary.add(person.name); }
        }
    }
    for (const sex of ['MALE', 'FEMALE']) assert.deepEqual([...seen[sex]].sort(), expected.slice().sort());
    assert.equal(ordinary.size, 2);
});
