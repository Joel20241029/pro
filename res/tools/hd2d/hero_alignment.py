"""Keep independently drawn hero poses on the approved facing's head and floor guides."""
from statistics import median

from PIL import Image


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
