"""Keep independently drawn hero poses on the approved facing's head and floor guides."""
from statistics import median

from PIL import Image, ImageChops, ImageDraw


def _head(art):
    opaque = art.getchannel("A").point(lambda alpha: 255 if alpha >= 128 else 0)
    _, top, _, foot = opaque.getbbox()
    # This upper band crosses the hair in all three heroes, above arms and weapons.
    height = foot - top
    rows = [opaque.crop((0, y, art.width, y + 1)).getbbox()
            for y in range(top + round(height * .21), top + round(height * .35))]
    width = median(right - left for left, _, right, _ in rows)
    center = median((left + right) / 2 for left, _, right, _ in rows)
    return width, center, height, foot


def align_hero_pose(master, pose, idle, riding=False):
    """Conform one master cell to its standing head; keep the original ground contact."""
    width, center, height, foot = _head(master)
    _, old_center, old_height, ground = _head(pose)
    head_width, head_center, idle_height, _ = _head(idle)
    scale_x = head_width / width
    # Keep a little weight shift while suppressing jumps caused by the alternating sole.
    target_x = head_center + (old_center - head_center) * .15
    # Two pixels of rise/crouch are enough at this source size; the bicycle keeps
    # its original height above the axle because its contact is at the wheel.
    target_height = old_height if riding else max(idle_height - 2, min(idle_height + 2, old_height))
    scale_y = target_height / height

    bounds = master.getchannel("A").getbbox()
    left = round(target_x + (bounds[0] - center) * scale_x)
    end = round(ground + (bounds[3] - foot) * scale_y)
    sampled = master.crop(bounds).resize(
        (round((bounds[2] - bounds[0]) * scale_x), round((bounds[3] - bounds[1]) * scale_y)),
        Image.Resampling.LANCZOS,
    )
    top = end - sampled.height
    if left < 0 or top < 0 or left + sampled.width > pose.width or end > pose.height:
        raise ValueError("Aligned hero art overflows the frame")
    result = Image.new("RGBA", pose.size)
    result.alpha_composite(sampled, (left, top))
    return result


# (idle neck, walking necks), on the 144 px aligned source canvas.
WALK_NECK_ROWS = {
    "songlei": {"down":(90, (84,84)), "left":(85, (85,85)), "right":(85, (83,83)), "up":(89, (84,84))},
    "delivery": {"down":(89, (88,85)), "left":(89, (89,89)), "right":(93, (93,93)), "up":(88, (88,88))},
    "zhizhuo": {"down":(102, (102,104,102,104)), "left":(104, (104,104,104,104)),
                "right":(103, (103,103,103,103)), "up":(102, (98,98,98,98))},
}
# Rows below these hip guides retain the original legs, shoes, and foot anchors.
WALK_HIP_ROWS = {"zhizhuo": 120, "delivery": 113, "songlei": 113}
# Neck drop on the extended stride, in pixels on the 144 px source canvas.
# Give each landing a small dip while the planted foot stays on its guide.
WALK_LANDING_DIP = 3
# Song Lei's idle art shows two batons beside the collar. Within the lower head
# band, clear those baton tips from the new head so each walking pose supplies its own.
SONGLEI_HEAD_EDGES = {
    "down": (84, 53, 97), "left": (82, 53, 111), "right": (82, 32, 95), "up": (84, 49, 96)
}
# Foreground weapon pixels already overlap the old head. These polygons cut
# along the outline and are placed over the replacement head at the same layer.
WALK_WEAPON_OUTLINES = {
 ("songlei","down",0): ((47,77),(52,77),(54,83),(57,84),(44,84),(44,79)),
 ("songlei","down",1): ((97,78),(103,78),(105,84),(94,84),(95,80)),
 ("songlei","left",0): ((42,79),(47,79),(51,85),(39,85)),
 ("songlei","left",1): ((42,79),(47,79),(51,85),(39,85)),
 ("songlei","right",0): ((95,79),(101,79),(104,83),(93,83)),
 ("songlei","right",1): ((95,79),(101,79),(105,83),(93,83)),
 ("songlei","up",0): ((39,78),(45,78),(48,84),(36,84)),
 ("songlei","up",1): ((95,79),(101,79),(103,84),(91,84)),
 ("zhizhuo","down",0): ((54,94),(58,94),(60,102),(51,102),(52,96)),
 ("zhizhuo","down",2): ((85,94),(89,94),(91,102),(84,102)),
 ("zhizhuo","left",0): ((47,100),(53,100),(55,104),(46,104)),
 ("zhizhuo","left",1): ((47,101),(53,101),(55,104),(46,104)),
 ("zhizhuo","left",2): ((47,101),(53,101),(55,104),(45,104)),
}

def stabilize_walk_head(pose, idle, hero, direction, step):
    neck, cuts = WALK_NECK_ROWS[hero][direction]
    # Song Lei and delivery use the idle drawing for the in-between beats.
    # Zhizhuo has separate in-between drawings at steps 1 and 3.
    dip = WALK_LANDING_DIP if hero != "zhizhuo" or step % 2 == 0 else 0
    target = neck + dip
    source = cuts[step]
    width, height = pose.size
    # Stretch just the upper torso between the collar and the existing hips.
    # Everything from that row through the planted foot remains byte-identical.
    hips = WALK_HIP_ROWS[hero]
    torso_scale = (hips-target)/(hips-source)
    body = Image.new("RGBA", pose.size)
    body.paste(pose.crop((0, hips, width, height)), (0, hips))
    upper = pose.crop((0, source, width, hips)).resize((width, hips - target), Image.Resampling.LANCZOS)
    body.paste(upper, (0, target))
    head = idle.crop((0, 0, width, neck))
    if hero == "songlei":
        start, left, right = SONGLEI_HEAD_EDGES[direction]
        head.paste(0, (0, start, left, neck))
        head.paste(0, (right, start, width, neck))
    body.alpha_composite(head, (0, dip))
    outline = WALK_WEAPON_OUTLINES.get((hero,direction,step))
    if outline:
        start=min(y for _,y in outline)
        mask = Image.new("L", (width, source))
        ImageDraw.Draw(mask).polygon(outline, fill=255)
        front = pose.crop((0, 0, width, source))
        front.putalpha(ImageChops.multiply(front.getchannel("A"), mask))
        top = target - round((source - start) * torso_scale)
        front = front.crop((0, start, width, source)).resize((width, target - top), Image.Resampling.LANCZOS)
        body.alpha_composite(front, (0, top))
    return body


# Seated neck and mirror bounds on delivery's two 144 px scooter poses. The
# stand-to-ride transition changes the head height, while the mirrors stay round.
RIDE_NECK_ROWS = {"down": 77, "up": 78}
RIDE_MIRROR_BOUNDS = {"down": (75, 52, 91), "up": (75, 55, 95)}


def stabilize_riding_head(pose, idle, direction):
    """Use the walking head at the seated neck without moving the scooter."""
    reference_cut = WALK_NECK_ROWS["delivery"][direction][0]
    seated_neck = RIDE_NECK_ROWS[direction]
    first_mirror_row, left, right = RIDE_MIRROR_BOUNDS[direction]
    width, height = pose.size
    shifted = Image.new("RGBA", pose.size)
    shifted.paste(pose.crop((0, seated_neck, width, height)), (0, seated_neck))
    head = idle.crop((0, reference_cut - seated_neck, width, reference_cut))
    shifted.alpha_composite(head)
    for x0, x1 in ((0, left), (right, width)):
        mirror = pose.crop((x0, first_mirror_row, x1, seated_neck))
        shifted.alpha_composite(mirror, (x0, first_mirror_row))
    return shifted
