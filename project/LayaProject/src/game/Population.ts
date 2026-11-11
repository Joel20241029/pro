import { POPULATION } from "./GameConfig";
import { GameState, isWorkingAdult, Person } from "./GameState";
import { SeededRandom } from "./SeededRandom";

/** 只统计仍在劳作的成年人和孩子，老人不代表未来繁衍能力。 */
export function maleBirthProbability(people: Person[], traveler = false) {
    const future = people.filter(p => !p.adult || isWorkingAdult(p));
    if (!future.length) return .5;
    const male = future.filter(p => p.sex === "MALE").length, female = future.length - male;
    return .5 + (traveler ? POPULATION.travelerBias : POPULATION.birthBias) * (female - male) / future.length;
}
/** 每个人的性别仍只消耗一次原随机流。完整32位阈值避免LCG最低位与出生抽取次数锁定同一性别。
 * 旅人的成年人补位为用户确认的断档保护：仅一种成年性别缺席时定向，其他情况依人口概率。
 */
export function nextSex(people: Person[], rng: SeededRandom, traveler = false): Person["sex"] {
    const sample = rng.next() / 0x100000000;
    if (traveler) {
        const adults = people.filter(isWorkingAdult), males = adults.filter(p => p.sex === "MALE").length;
        if (adults.length && !males) return "MALE";
        if (adults.length && males === adults.length) return "FEMALE";
    }
    return sample < maleBirthProbability(people, traveler) ? "MALE" : "FEMALE";
}
export function travelerDue(s: GameState, capacity: number): boolean {
    if (s.lastTraveler !== null && s.completed - s.lastTraveler < POPULATION.travelerMinNights) return false;
    const regular = s.day >= POPULATION.firstTravelerDay && (s.day - POPULATION.firstTravelerDay) % POPULATION.travelerPeriod === 0;
    const adults = s.people.filter(isWorkingAdult);
    const missing = !adults.some(p => p.sex === "MALE") || !adults.some(p => p.sex === "FEMALE");
    return regular || (s.people.length < capacity && missing);
}
