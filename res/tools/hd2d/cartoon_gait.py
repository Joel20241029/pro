"""Articulate limbs from the same drawing, so faces and equipment stay consistent throughout a walk."""
from dataclasses import dataclass
import math

from PIL import Image, ImageChops, ImageDraw


@dataclass(frozen=True)
class Limb:
    joint: tuple[float, float]
    outline: tuple[tuple[float, float], ...]
    side: int


def footfall(phase, stance):
    """One stride. The supporting foot rolls back, then the free foot clears the ground."""
    t = phase % 1
    if t < stance:
        return 1 - 2 * t / stance, 0
    swing = (t - stance) / (1 - stance)
    return -1 + 2 * (swing * swing * (3 - 2 * swing)), math.sin(swing * math.pi)


def make_limb(image, limb):
    part = image.copy()
    mask = Image.new("L", image.size)
    ImageDraw.Draw(mask).polygon(limb.outline, fill=255)
    part.putalpha(ImageChops.multiply(image.getchannel("A"), mask))
    return part, mask


def bend(part, joint, angle, stretch=1):
    """Rotate and extend from the shoulder or hip, keeping the joint fixed on the body."""
    x, y = joint
    angle = math.radians(angle)
    cosine, sine = math.cos(angle), math.sin(angle)
    a, b, d, e = cosine, sine, -sine / stretch, cosine / stretch
    return part.transform(part.size, Image.Transform.AFFINE, (a, b, x-a*x-b*y, d, e, y-d*x-e*y), Image.Resampling.BICUBIC)


def separated(image, limbs):
    model = []
    torso = image.copy()
    remaining = image.getchannel("A")
    for limb in limbs:
        part, mask = make_limb(image, limb)
        # Keep a small overlap at the joint. Rotating the cutout must never open a gap in the sleeve or waist.
        x, y = limb.joint
        join = image.height * .027
        ImageDraw.Draw(mask).ellipse((x-join, y-join, x+join, y+join), fill=0)
        remaining = ImageChops.subtract(remaining, mask)
        model.append((part, limb))
    torso.putalpha(remaining)
    return torso, model


def pad(image, margin):
    canvas = Image.new("RGBA", (image.width + 2*margin, image.height + 2*margin))
    canvas.alpha_composite(image, (margin, margin))
    return canvas


def articulated_foot(part, joint, angle, neutral_sole, ahead, lift, height):
    """Move only the leg. Limit toe travel in projection while the attached torso stays put."""
    turned = bend(part, joint, angle)
    visible = turned.getchannel("A").point(lambda a: 255 if a >= 128 else 0).getbbox()
    if visible is None or visible[3] <= joint[1] + 1:
        return turned
    # A passing foot lifts smoothly; the active support stays in a narrow ground band shared with the contact shadow.
    target = neutral_sole + height * (.011 * ahead - .050 * lift)
    length = visible[3] - joint[1]
    return bend(turned, joint, 0, max(.56, min(1.20, (target - joint[1]) / length)))


def villager(image, direction, phase):
    """Left hip and right shoulder share a phase, as do right hip and left shoulder."""
    w, h = image.size
    profile = direction in ("left", "right")
    screen = -1 if direction == "left" else 1
    body = lambda x, y: (x*w, y*h)
    limb = lambda x, y, points, side: Limb(body(x, y), tuple(body(px, py) for px, py in points), side)
    if profile:
        # At this camera angle the far limbs are partly hidden by the tunic.
        legs = [limb(.50,.84, ((0,.91),(.38,.88),(.61,.87),(1,.91),(1,1.0),(0,1.0)), 1)]
        # Profile hands are on the visible side. Keep the shirt cuff tied to the arm.
        if direction == "left":
            arms = [limb(.57,.654, ((.51,.65),(.62,.65),(.71,.76),(.74,.86),(.53,.89),(.44,.80)), 1)]
        else:
            arms = [limb(.43,.654, ((.49,.65),(.38,.65),(.29,.76),(.26,.86),(.47,.89),(.56,.80)), 1)]
    else:
        legs = [
            limb(.39,.84, ((.21,.89),(.42,.86),(.50,.88),(.50,1),(.15,1)), -1),
            limb(.61,.84, ((.79,.89),(.58,.86),(.50,.88),(.50,1),(.85,1)), 1),
        ]
        arms = [
            limb(.32,.65, ((.29,.62),(.37,.68),(.34,.83),(.19,.89),(0,.81),(.11,.68)), -1),
            limb(.68,.65, ((.71,.62),(.63,.68),(.66,.83),(.81,.89),(1,.81),(.89,.68)), 1),
        ]
    torso, parts = separated(image, [*legs, *arms])
    margin = round(h*.10)
    torso = pad(torso, margin)
    draw_order = []
    for i, (part, ref) in enumerate(parts):
        arm = i >= len(legs)
        for side in ((-1, 1) if profile else (ref.side,)):
            limb_phase = phase + (.5 if (side > 0) != arm else 0)
            ahead, lift = footfall(limb_phase, .64)
            if profile:
                strength = 17 if arm else 19
                angle = -screen * ahead * strength
            elif arm:
                angle = ref.side * ahead * 7
            else:
                angle = -ref.side * ahead * 4
            depth = -1 if direction == "up" and not profile else 1
            joint = (ref.joint[0]+margin, ref.joint[1]+margin)
            padded = pad(part, margin)
            moved = (bend(padded, joint, angle, 1 + depth * ahead * .095) if arm else
                     articulated_foot(padded, joint, angle, part.getbbox()[3]+margin, depth*ahead, lift, h))
            if profile and side < 0:
                moved.putalpha(moved.getchannel("A").point(lambda a: round(a*.94)))
            draw_order.append((moved, 0 if profile and side < 0 else 2 if arm else 1))
    frame = Image.new("RGBA", torso.size)
    for part, order in draw_order:
        if order < 2:
            frame.alpha_composite(part)
    frame.alpha_composite(torso)
    for part, order in draw_order:
        if order == 2:
            frame.alpha_composite(part)
    return frame


# Pixel landmarks on enemies-front.png. Mask the soles below the knees and leave each
# outfit, held weapon and front-facing head on its own stable registration.
ENEMY_LEGS = {
    "raider": (
        ((158,303), ((135,297),(176,297),(193,319),(197,354),(121,353),(124,320)), -1),
        ((234,302), ((214,297),(255,297),(268,319),(272,354),(199,353),(202,320)), 1)),
    "runner": (
        ((513,303), ((492,298),(532,297),(541,321),(543,352),(479,351),(485,316)), -1),
        ((573,302), ((550,297),(591,297),(600,316),(606,352),(545,351)), 1)),
    "armored": (
        ((862,302), ((838,296),(884,295),(895,319),(903,354),(826,353)), -1),
        ((944,302), ((921,297),(964,300),(977,323),(985,353),(908,354)), 1)),
    "boar": (
        ((1172,302), ((1165,294),(1190,296),(1191,323),(1157,323)), .125),
        ((1362,302), ((1350,295),(1375,295),(1378,319),(1343,323)), .625),
        ((1207,312), ((1184,299),(1220,300),(1247,320),(1246,354),(1165,354),(1166,333)), 0),
        ((1328,312), ((1300,304),(1348,299),(1369,331),(1365,354),(1287,354),(1288,330)), .5)),
    "disruptor": (
        ((164,646), ((137,642),(181,644),(190,669),(196,696),(127,696),(126,671)), -1),
        ((234,646), ((212,642),(255,641),(268,672),(267,697),(201,698)), 1)),
    "chief": (
        ((493,641), ((459,631),(517,635),(532,660),(532,696),(443,696),(443,667)), -1),
        ((599,642), ((568,636),(623,632),(645,667),(646,696),(553,697),(554,669)), 1)),
    "commander": (
        ((858,642), ((832,634),(883,635),(894,663),(901,700),(812,699)), -1),
        ((949,643), ((924,635),(977,634),(988,662),(997,699),(912,700)), 1)),
    "wolfking": (
        ((1166,643), ((1154,630),(1180,626),(1183,668),(1145,667)), .125),
        ((1370,642), ((1355,627),(1380,632),(1388,667),(1352,670)), .625),
        ((1205,629), ((1177,624),(1229,615),(1244,657),(1252,699),(1165,699),(1165,672)), 0),
        ((1326,629), ((1301,621),(1355,624),(1365,668),(1370,699),(1280,699),(1283,672)), .5)),
    "tuskking": (
        ((93,973), ((82,966),(106,958),(113,994),(77,997)), .125),
        ((295,971), ((286,958),(308,965),(313,995),(277,997)), .625),
        ((129,980), ((102,967),(151,965),(171,990),(175,1030),(91,1030)), 0),
        ((256,977), ((231,969),(276,962),(295,1000),(296,1030),(213,1030),(211,996)), .5)),
    "shaman": (
        ((488,979), ((463,967),(510,970),(529,1002),(530,1033),(448,1033),(450,1001)), -1),
        ((573,978), ((543,969),(595,966),(605,1000),(615,1034),(532,1035),(530,1008)), 1)),
}


def enemy(image, origin, kind, phase):
    ox, oy = origin
    gait = ENEMY_LEGS[kind]
    feet = [Limb((x-ox, y-oy), tuple((px-ox, py-oy) for px, py in mask), side) for (x,y),mask,side in gait]
    torso, parts = separated(image, feet)
    margin = round(image.height*.10)
    torso = pad(torso, margin)
    frame = Image.new("RGBA", torso.size)
    quad = kind in ("boar", "wolfking", "tuskking")
    stance = .68 if quad else .62
    for part, foot in parts:
        offset = foot.side if quad else 0 if foot.side < 0 else .5
        ahead, lift = footfall(phase + offset, stance)
        orientation = -1 if foot.joint[0] < image.width/2 else 1
        joint = (foot.joint[0]+margin, foot.joint[1]+margin)
        part = articulated_foot(pad(part, margin), joint, -orientation * ahead * (6 if quad else 5),
                               part.getbbox()[3]+margin, ahead, lift, image.height)
        frame.alpha_composite(part)
    frame.alpha_composite(torso)
    return frame
