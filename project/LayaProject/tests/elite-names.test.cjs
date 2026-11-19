const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw new Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
const { createGame, applyCommand, finishNight } = require(path.join(compiled, 'game/VillageRules.js'));
const { generateWave } = require(path.join(compiled, 'game/WaveGenerator.js'));
const expected = ['旭勇', '智卓', '二百', '翟毅', '周博', '赵靓', '龙龙', '昭易', '明波', '宋磊', '徐超', '四辈儿'];

for (const route of ['birth', 'traveler']) test(`${route}: each special quality uses the same twelve names for both sexes`, () => {
    const seen = Object.fromEntries(["ELITE", "HERO", "LEGENDARY"].map(quality => [quality, { MALE: new Set(), FEMALE: new Set() }]));
    for (let i = 1; i <= 30000; i++) {
        const s = createGame(i * 99991);
        s.completed = s.legacy.bestNight = route === "birth" ? 30 : 31;
        s.day = s.completed + 1; s.wave = generateWave(s);
        let person;
        if (route === 'birth') {
            applyCommand(s, { type: 'BIRTH', family: s.families[0].id, carer: s.people[1].id });
            person = s.people[6]; assert.equal(s.people.length, 7);
        } else {

            applyCommand(s, { type: 'NIGHT' }); finishNight(s, 200, s.towers.map(t => t.operator));
            person = s.choices.find(q => q.kind === 'TRAVELER').person;
            assert.equal(s.people.length, 6);
        }
        assert.notEqual(person.name, '芊芊', 'removed personal name must not be generated');
        if (person.quality !== "COMMON") {
            assert(expected.includes(person.name), `unexpected elite name ${person.name}`);
            seen[person.quality][person.sex].add(person.name);
        } else {
            assert(!expected.includes(person.name), 'elite-only names must not enter the ordinary pool');
            if (route === 'birth') assert.match(person.name, /^小[禾桃松竹杏川]\d+$/);
            else assert(['行舟', '云溪', '山青', '晚晴'].includes(person.name));
        }
    }
    for (const quality of Object.values(seen)) for (const names of Object.values(quality)) assert.deepEqual([...names].sort(), expected.slice().sort());
});
