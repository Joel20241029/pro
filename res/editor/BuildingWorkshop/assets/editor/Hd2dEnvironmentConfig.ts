/** Art-probe placement at 720 logical width. These authoring measurements never
 * change production footprints, routes, jobs, resource costs or saved state.
 * Coordinates are ground origins; decorations are fractions of each tree image.
 */
export const HD2D_ENVIRONMENT = {
    trees: [
        { name: "OakNearRoad", image: "env_oak", x: 96, y: 257, height: 144,
            decorations: [{ image: "env_apple", x: .24, y: .40, height: 13 }, { image: "env_flower", x: .65, y: .19, height: 12 }] },
        { name: "PineUpperRight", image: "env_pine", x: 654, y: 309, height: 152, decorations: [] },
        { name: "PineMiddleLeft", image: "env_pine", x: 60, y: 569, height: 149, decorations: [] },
        { name: "OakMiddleRight", image: "env_oak", x: 628, y: 647, height: 146,
            decorations: [{ image: "env_flower", x: .30, y: .39, height: 12 }, { image: "env_apple", x: .67, y: .47, height: 13 }] },
        { name: "OakVillage", image: "env_oak", x: 96, y: 794, height: 138,
            decorations: [{ image: "env_apple", x: .26, y: .43, height: 13 }] },
        { name: "PineVillage", image: "env_pine", x: 653, y: 811, height: 143, decorations: [] }
    ],
    // The crop's root stays near bottom center; a slight offset follows the
    // source trunk. Pine's generated white shadow is excluded, not darkened.
    treePivot: { env_oak: { x: .515, y: .987 }, env_pine: { x: .51, y: .987 } },
    treeShadow: { widthRatio: .68, heightRatio: .21, offsetX: 8, offsetY: -1, alpha: .65 },
    signs: [
        { name: "FriendshipRoadSign", text: "友谊路", x: 502, y: 215, height: 72 },
        { name: "VillageNameSign", text: "文明里村", x: 244, y: 739, height: 78 }
    ],
    // Board area measured inside the cropped sprite, excluding post and pegs.
    signText: { x: .12, y: .27, width: .76, height: .38, fontSize: 22, color: "#593615" },
    rocks: [
        { name: "RocksNearBend", x: 469, y: 358, height: 24 },
        { name: "RocksByPine", x: 109, y: 457, height: 29 },
        { name: "RocksVillage", x: 560, y: 754, height: 24 }
    ],
    campfire: { x: 360, y: 781, width: 90, height: 90 * 216 / 408,
        // All four flame cells share the same 543x448 crop and flame-root line.
        flameWidth: 58, flameHeight: 58 * 448 / 543, flameBottom: -19, flamePivotY: 433 / 448, fps: 6 },
    // Shared broad contact shadow is a probe approximation, not a silhouette
    // shadow rendered from each model. Source is the detached oak shadow.
    actorShadow: { widthRatio: .42, heightRatio: .12, alpha: .45 }
};
