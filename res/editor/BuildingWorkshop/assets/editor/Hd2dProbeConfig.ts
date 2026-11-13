/** Presentation-only probe values, measured against doc32 reference at 720 logical width.
 * Canvas/pivots keep the existing 128x128 building contract. Changing these values
 * affects only the isolated art scene, not game pathing, damage, costs or save data.
 */
export const HD2D_PROBE = {
    width: 720, height: 1040,
    // Full source canvas placement verified against the unchanged DefenseConfig
    // polyline. The lower transparent margin extends past the probe scene edge.
    roadHeight: 1065,
    towers: [
        { kind: "ARROW", x: 205, y: 380, layers: [
            { name: "Body", image: "arrow_body", x: 3, y: 20, w: 122, h: 103 },
            { name: "Weapon", image: "arrow_weapon", x: 64, y: 52, w: 73, h: 60, px: 36.5, py: 60 },
            { name: "FrontRail", image: "arrow_front", x: 22, y: 36, w: 84, h: 34.5 }
        ] },
        { kind: "STONE", x: 565, y: 505, layers: [
            { name: "Body", image: "stone_body", x: 12, y: 18, w: 104, h: 103 },
            { name: "Weapon", image: "stone_loaded", x: 64, y: 75, w: 68, h: 42, px: 34, py: 42 }
        ] },
        { kind: "SLOW", x: 210, y: 650, layers: [
            { name: "Body", image: "frost_body", x: 15, y: 17, w: 98, h: 106 },
            { name: "Weapon", image: "frost_core", x: 64, y: 28, w: 29, h: 35, px: 14.5, py: 35 }
        ] }
    ],
    people: [
        // Full 512px mother frames share a projected ground origin. Standing
        // pivot = .5 + (.49 * 12/13) / 1.30; baby camera aim is .28 instead.
        // Frame rates preserve each role's authored cadence, only in this probe.
        { image: "male", name: "MaleOfflineWalk", x: 170, y: 880, size: 102, pivotY: .847929, fps: 6 },
        { image: "female", name: "FemaleOfflineWalk", x: 270, y: 870, size: 102, pivotY: .847929, fps: 6 },
        { image: "child", name: "ChildOfflineWalk", x: 370, y: 884, size: 78, pivotY: .847929, fps: 6 },
        { image: "elder", name: "ElderOfflineWalk", x: 470, y: 875, size: 96, pivotY: .847929, fps: 4 },
        { image: "baby", name: "BabyOfflineIdle", x: 570, y: 875, size: 76, pivotY: .698817, fps: 2 }
    ]
};
