import { WAVE_PROGRESSION, WAVE, WAVE_RHYTHM, WaveRhythm } from "../config/DefenseConfig";

export function waveDifficulty(day: number, rhythm: WaveRhythm = WAVE_RHYTHM.extended) {
    const nightly = rhythm !== WAVE_RHYTHM.paired;
    const arrivalScale = rhythm === WAVE_RHYTHM.extended ? WAVE_PROGRESSION.extendedArrivalScale : 1;
    const elapsedBands = (day - 1) / WAVE_PROGRESSION.nightsPerBand;
    const band = nightly ? elapsedBands : Math.floor(elapsedBands);
    const early = Math.min(band, WAVE_PROGRESSION.earlyBands);
    const later = band - early, middle = Math.min(later, WAVE_PROGRESSION.middleBands);
    const [earlyCount, middleCount, lateCount] = WAVE_PROGRESSION.countPerBand;
    const count = WAVE_PROGRESSION.initialCount + early * earlyCount + middle * middleCount + (later - middle) * lateCount * (nightly ? WAVE_PROGRESSION.nightsPerBand : 1);
    const healthBonus = early * WAVE_PROGRESSION.earlyHealth + later * WAVE_PROGRESSION.laterHealth;
    const window = WAVE.spawnWindowTicks;
    const baseTicks = Math.min(window.maximum, window.minimum + band * WAVE_PROGRESSION.windowTicksPerBand);
    // 排满正常窗口后续排整批。每批之间有短接续，同屏数量仍由战斗自然决定。
    const batchCount = Math.ceil(count / WAVE_PROGRESSION.batchSize);
    const extraTicks = Math.ceil(Math.max(0, count - WAVE_PROGRESSION.batchSize) * window.maximum / WAVE_PROGRESSION.batchSize);
    const { fromCount, fullCount, extraWindowScale } = WAVE_PROGRESSION.denseArrival;
    const densityBand = Math.min(1, Math.max(0, (count - fromCount) / (fullCount - fromCount)));
    const windowScale = WAVE_PROGRESSION.arrivalWindowScale * (1 + (nightly ? densityBand * extraWindowScale : 0));
    const baseSpawnTicks = Math.round((baseTicks + extraTicks) * windowScale) + (batchCount - 1) * WAVE_PROGRESSION.joinTicks;
    return {
        band, count, spawnTicks: baseSpawnTicks * arrivalScale, baseSpawnTicks, arrivalScale,
        health: 1 + healthBonus, bossHealth: 1 + healthBonus * WAVE_PROGRESSION.bossGrowthShare,
        heavyHealth: Math.min(1, WAVE_PROGRESSION.earlyHeavyHealth + band * WAVE_PROGRESSION.heavyHealthPerBand),
        gate: 1 + early * WAVE_PROGRESSION.earlyGate + later * WAVE_PROGRESSION.laterGate,
        speed: 1 + Math.min(WAVE_PROGRESSION.speedBonusMax, band * WAVE_PROGRESSION.speedPerBand)
    };
}

/** 将扩展后的最后入场时间按真实批次分配。相邻批次保留短间隔。 */
export function waveArrivalTick(slot: number, count: number, window: number) {
    const { batchSize, joinTicks } = WAVE_PROGRESSION;
    if (count <= batchSize) return slot * window / (count - 1);
    const batch = Math.floor(slot / batchSize);
    const joins = Math.ceil(count / batchSize) - 1;
    const pacedTicks = window - joins * joinTicks;
    return slot * pacedTicks / (count - 1) + batch * joinTicks;
}
