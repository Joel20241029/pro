"""Extract the fixed wood mount and pivoting tube from the approved vermilion cannon."""
from math import hypot

from PIL import Image, ImageChops, ImageDraw


LAYER_FRAMES = ("patrol_rapid_barrel", "patrol_rapid_mount", "patrol_rapid_barrel_rear")
BATTLE_MASTER = "patrol-rapid-gun-battle.png"
# Registration on the 1448×1086 approved master. Both layers retain the same pivot
# and are sampled at 1:4. The bore centre is at (1040, 328), relative to (688, 648).
CROP = (288, 96, 1200, 960)
CANVAS = (228, 216)
MOUNT_EDGE = (
    (475, 960), (495, 878), (510, 819), (516, 791), (531, 763), (552, 746),
    (560, 715), (570, 668), (584, 619), (601, 584), (622, 558), (648, 541),
    (672, 533), (695, 530), (719, 533), (742, 538), (764, 548), (784, 565),
    (801, 586), (815, 613), (827, 649), (901, 624), (914, 652),
    (928, 690), (940, 723), (1200, 723), (1200, 960)
)


def profile_barrel(master):
    source = Image.open(master).convert("RGBA")
    if source.size != (1448, 1086):
        raise ValueError("Re-register the vermilion cannon before changing its master canvas")
    alpha = source.getchannel("A")
    mask = Image.new("L", source.size)
    ImageDraw.Draw(mask).polygon(MOUNT_EDGE, fill=255)

    visible_tube = source.copy()
    visible_tube.putalpha(ImageChops.multiply(alpha, ImageChops.invert(mask)))

    # Fill the section originally hidden by the saddle. It keeps the tube continuous
    # where the front of the moving barrel leaves the fixed wood during recoil.
    barrel = Image.new("RGBA", source.size)
    draw = ImageDraw.Draw(barrel)
    outline = [(543, 632), (599, 565), (670, 525), (762, 527), (894, 577), (913, 624),
               (850, 656), (778, 681), (704, 704), (640, 718), (586, 720), (553, 714)]
    draw.polygon(outline, fill="#4c1a19")
    draw.polygon([(556, 622), (604, 562), (677, 522), (770, 530), (897, 591), (902, 616),
                  (848, 646), (775, 672), (700, 694), (638, 707), (586, 709), (555, 704)],
                 fill="#801922")
    barrel.alpha_composite(visible_tube)

    return barrel.crop(CROP).resize(CANVAS, Image.Resampling.LANCZOS)


def battle_layers(master):
    image = Image.open(master).convert("RGBA")
    if image.size != (1024, 1536):
        raise ValueError("Re-register the centreline cannon before changing its master canvas")
    image.putalpha(image.getchannel("A").point(lambda value: value if value >= 12 else 0))
    # Separately drawn layers share the battle sprite's pivot (100, 138). The far
    # rim is due north at source (505, 76); the stand's two mounts straddle x=511.
    layers = (
        ("patrol_rapid_barrel_rear", image.crop((0, 0, 1024, 970)), (505, 632), (632 - 76) / hypot(88, 80)),
        ("patrol_rapid_mount", image.crop((0, 970, 1024, 1536)), (511, 1164 - 970), 640 / 142),
    )
    return {
        name: sprite.transform(
            CANVAS, Image.Transform.AFFINE,
            (inverse, 0, x - 100 * inverse, 0, inverse, y - 138 * inverse),
            resample=Image.Resampling.BICUBIC
        )
        for name, sprite, (x, y), inverse in layers
    }
