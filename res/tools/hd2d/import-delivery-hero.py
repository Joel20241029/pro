"""Pack the approved four-facing courier art on a common actor foot anchor."""
from hashlib import sha256
from pathlib import Path
from statistics import median
import json
from PIL import Image
from hero_alignment import align_hero_pose, stabilize_riding_head, stabilize_walk_head

ROOT = Path(__file__).resolve().parents[2]
PRODUCTION = ROOT / "source/rendered2d/production/delivery-hero"
MASTERS = PRODUCTION / "masters"
FRAMES = PRODUCTION / "frames"
RECIPE = ROOT / "source/asset_recipe.json"
DIRECTIONS = ("down", "left", "right", "up")
SIZE = (144, 144)
FOOT = (72, 134)
LANCZOS = Image.Resampling.LANCZOS
SOURCE = Path(__file__).resolve().relative_to(ROOT).as_posix()


def artwork(name, rows=1, cols=1, row_cuts=None, column_cuts=None):
    image = Image.open(MASTERS / (name + ".png")).convert("RGBA")
    row_cuts = row_cuts or [row * image.height // rows for row in range(rows + 1)]
    column_cuts = column_cuts or [col * image.width // cols for col in range(cols + 1)]
    cells = []
    for row in range(rows):
        for col in range(cols):
            raw = image.crop((column_cuts[col], row_cuts[row], column_cuts[col + 1], row_cuts[row + 1]))
            alpha = raw.getchannel("A").point(lambda a: min(255, max(0, round((a - 24) * 255 / 224))))
            bounds = alpha.point(lambda a: 255 if a >= 115 else 0).getbbox()
            if not bounds or not all((bounds[0], bounds[1], raw.width - bounds[2], raw.height - bounds[3])):
                raise ValueError(f"Art meets the gutter in {name}, cell {len(cells)}")
            raw.putalpha(alpha)
            cells.append(raw.crop(bounds))
    return cells


def actor(frame, height):
    # Dark opaque pixels near the sole find the planted foot (or wheel). A translucent bag cannot pull it sideways.
    bottom = max(0, frame.height - round(frame.height * .065))
    foot_pixels = [x for y in range(bottom, frame.height) for x in range(frame.width)
                   if (pixel := frame.getpixel((x, y)))[3] >= 115 and max(pixel[:3]) < 92]
    pivot_x = median(foot_pixels) if foot_pixels else frame.width / 2
    scale = min(height / frame.height, 67 / max(pivot_x, frame.width - pivot_x))
    resized = frame.resize((round(frame.width * scale), round(frame.height * scale)), LANCZOS)
    out = Image.new("RGBA", SIZE)
    out.alpha_composite(resized, (round(FOOT[0] - pivot_x * scale), FOOT[1] - resized.height))
    return out


def prop(frame, limit):
    frame.thumbnail(limit, LANCZOS)
    return frame


def register(assets, ident, frame, pivot, category, master, animation=None):
    out = FRAMES / (ident + ".png")
    frame.save(out)
    w, h = frame.size
    bounds = {"x": 0, "y": 0, "w": w, "h": h}
    assets.append({
        "id": ident, "label": ident, "category": category, "categoryLabel": "外卖大王",
        "path": f"runtime/{category}/{ident}.png", "width": w, "height": h,
        "pivot": {"x": pivot[0], "y": pivot[1]}, "sourceSheet": out.relative_to(ROOT).as_posix(),
        "sourceRect": bounds, "sourceCropWithinCell": bounds, "nineSlice": None,
        "mapping": "delivery", "animation": animation, "fitPadding": 0,
        "resizeMode": "stretch", "sampling": "Lanczos", "runtime": True, "usage": "大王四向动作、补给与漫画落点",
        "bundle": "battle" if category == "effects" else "base",
        "provenance": {"source": (MASTERS / (master + ".png")).relative_to(ROOT).as_posix(),
                       "sourceHash": sha256((MASTERS / (master + ".png")).read_bytes()).hexdigest(),
                       "fullCanvas": False, "outputHash": sha256(out.read_bytes()).hexdigest(), "renderer": SOURCE}
    })


def main():
    FRAMES.mkdir(exist_ok=True)
    recipe = json.loads(RECIPE.read_text())
    assets = [a for a in recipe["assets"] if a.get("mapping") != "delivery"]
    clips = [a for a in recipe["animations"]["animations"] if a.get("mapping") != "delivery"]
    scooter = artwork("scooter", 2, 4)
    # The artwork gutters fall off the nominal grid. Slice through clear pixels.
    standard = artwork("throws", 3, 3, row_cuts=[0, 402, 819, 1293], column_cuts=[0, 377, 780, 1216])
    approved = artwork("approved", 2, 3)
    right_throw = artwork("right-throw", 1, 3)
    for i, direction in enumerate(DIRECTIONS):
        root = f"hero_delivery_{direction}"
        walking = artwork(direction, 1, 3)
        # Explicitly corrected alternating right-foot forward frame, with a front-facing head.
        forward = artwork("down-other-foot")[0] if direction == "down" else walking[2]
        motions = [(walking[0], direction, "idle"), (walking[1], direction, "walk_0"),
                   (forward, "down-other-foot" if direction == "down" else direction, "walk_1")]
        attack = {"down": (standard[:3], "throws"), "left": (standard[3:6], "throws"),
                  "right": (right_throw, "right-throw"), "up": (standard[6:], "throws")}
        frames, master = attack[direction]
        motions.extend((frame, master, name) for frame, name in zip(frames, ("windup", "throw", "recover")))
        if direction in ("down", "up"):
            motions.append((scooter[i], "scooter", "ride"))
        clip = root + "_walk"
        idle = actor(walking[0], 108)
        for frame, master, name in motions:
            riding = name == "ride"
            aligned = idle if name == "idle" else align_hero_pose(frame, actor(frame, 118 if riding else 108), idle, riding)
            if name.startswith("walk_"):
                aligned = stabilize_walk_head(aligned, idle, "delivery", direction, int(name[-1]))
            elif riding:
                aligned = stabilize_riding_head(aligned, idle, direction)
            register(assets, root + "_" + name, aligned, FOOT, "characters", master, clip if name.startswith("walk_") else None)
        ids = [root + "_walk_0", root + "_idle", root + "_walk_1", root + "_idle"]
        clips.append({"id": clip, "frameIds": ids, "frameCount": len(ids), "fps": 8,
                      "loop": True, "restFrame": root + "_idle", "category": "characters", "mapping": "delivery",
                      "canvas": {"w": SIZE[0], "h": SIZE[1]}, "pivot": {"x": FOOT[0], "y": FOOT[1]},
                      "clock": "distance", "stridePixels": 48, "trimPolicy": "atlas_trim_restore_source_canvas"})
    face = artwork("down", 1, 3)[0]
    face = prop(face.crop((0, 0, face.width, round(face.height * .83))), (180, 180))
    register(assets, "delivery_portrait", face, (0, 0), "ui/icons", "down")
    bike, word = artwork("prop-text", 1, 2)
    bike = prop(bike, (140, 110))
    register(assets, "delivery_bike", bike, (bike.width / 2, bike.height), "effects", "prop-text")
    bag = prop(approved[5], (60, 64))
    register(assets, "delivery_bag", bag, (bag.width / 2, bag.height / 2), "effects", "approved")
    word = prop(word, (172, 96))
    register(assets, "fx_delivery_arrived", word, (word.width / 2, word.height / 2), "effects", "prop-text")
    recipe["assets"] = assets
    recipe["animations"]["animations"] = clips
    RECIPE.write_text(json.dumps(recipe, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
