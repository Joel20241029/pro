import { isElder, Person } from "../game/GameState";

/** 顺序与离线角色转台一致。从镜头前方开始，按 45 度轮换八个独立方向。 */
const DIRECTIONS = ["DOWN", "DOWN_RIGHT", "RIGHT", "UP_RIGHT", "UP", "UP_LEFT", "LEFT", "DOWN_LEFT"] as const;
export type WalkDirection = typeof DIRECTIONS[number];
const SECTOR = Math.PI / 4;
/** 转向时留出 5 度滞回，吸收同一扇区交界处的寻路线段扰动。 */
const TURN_MARGIN = 5 * Math.PI / 180;

export function walkDirection(dx: number, dy: number, previous: WalkDirection): WalkDirection {
    if (dx === 0 && dy === 0) return previous;
    const angle = Math.atan2(dx, dy), last = DIRECTIONS.indexOf(previous) * SECTOR;
    const delta = Math.atan2(Math.sin(angle - last), Math.cos(angle - last));
    if (Math.abs(delta) <= SECTOR / 2 + TURN_MARGIN) return previous;
    return DIRECTIONS[(Math.round(angle / SECTOR) + DIRECTIONS.length) % DIRECTIONS.length];
}

/** 按村民永久编号选外观。编号每两人换一档，使开局男女均能显示两套造型。 */
export function villagerModel(person: Person, historical = false) {
    if (historical || isElder(person)) return "elder";
    if (!person.adult) return person.growth === 0 ? "baby" : "child";
    if (person.elite) return person.sex === "MALE" ? "elite_male" : "elite_female";
    const sequence = Number(person.id.slice(person.id.lastIndexOf(":") + 1));
    const alternate = Math.floor((sequence - 1) / 2) % 2 === 1;
    return person.sex === "MALE" ? (alternate ? "straw" : "blue") : (alternate ? "jade" : "red");
}
