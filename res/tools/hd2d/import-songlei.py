"""Pack the approved four-direction Song Lei drawings on one actor pivot."""
from hashlib import sha256
from pathlib import Path
from statistics import median
import json
from PIL import Image
from hero_alignment import align_hero_pose, stabilize_walk_head

ROOT = Path(__file__).resolve().parents[2]
PRODUCTION = ROOT / "source/rendered2d/production/songlei"
MASTERS = PRODUCTION / "masters"
FRAMES = PRODUCTION / "frames"
RECIPE = ROOT / "source/asset_recipe.json"
DIRECTIONS = ("down", "up", "left", "right")
CANVAS = {"w": 144, "h": 144}
FOOT = {"x": 72, "y": 134}
LANCZOS = Image.Resampling.LANCZOS


def cells(name, rows, columns):
    with Image.open(MASTERS / f"{name}.png") as sheet:
        if sheet.mode != "RGBA":
            raise ValueError(f"{name} requires transparent art")
        for row in range(rows):
            for col in range(columns):
                cell = sheet.crop((col * sheet.width // columns, row * sheet.height // rows,
                                   (col + 1) * sheet.width // columns, (row + 1) * sheet.height // rows))
                alpha = cell.getchannel("A")
                bounds = alpha.point(lambda value: 255 if value >= 112 else 0).getbbox()
                if not bounds or bounds[0] == 0 or bounds[1] == 0 or bounds[2] == cell.width or bounds[3] == cell.height:
                    raise ValueError(f"{name} artwork touches a gutter at {row}, {col}")
                cell.putalpha(alpha.point(lambda value: max(0, min(255, round((value - 24) * 255 / 224)))))
                yield cell.crop(bounds)


def actor(frame):
    # Use dark sole pixels to fix the feet rather than centering a wide baton swing.
    foot_pixels = [x for y in range(round(frame.height * .95), frame.height) for x in range(frame.width)
                   if (pixel := frame.getpixel((x, y)))[3] >= 115 and max(pixel[:3]) < 95]
    if not foot_pixels:
        raise ValueError("No visible sole for actor pivot")
    pivot_x = median(foot_pixels)
    scale = min(108 / frame.height, 68 / max(pivot_x, frame.width - pivot_x))
    art = frame.resize((round(frame.width * scale), round(frame.height * scale)), LANCZOS)
    output = Image.new("RGBA", (CANVAS["w"], CANVAS["h"]))
    output.alpha_composite(art, (round(FOOT["x"] - pivot_x * scale), FOOT["y"] - art.height))
    return output


def main():
    FRAMES.mkdir(exist_ok=True)
    recipe = json.loads(RECIPE.read_text())
    assets = [row for row in recipe["assets"] if row.get("mapping") != "songlei"]
    clips = [row for row in recipe["animations"]["animations"] if row.get("mapping") != "songlei"]
    idle = list(cells("idle", 2, 2))
    walk = list(cells("walk", 2, 4))
    side = list(cells("right-walk", 1, 2))
    attack = list(cells("attack", 2, 4))

    def register(ident, frame, master, category, pivot, animation=None):
        target = FRAMES / f"{ident}.png"
        frame.save(target)
        original = MASTERS / f"{master}.png"
        w, h = frame.size
        bounds = {"x": 0, "y": 0, "w": w, "h": h}
        assets.append({
            "id": ident, "label": ident, "category": category, "categoryLabel": "大夫宋磊",
            "path": f"runtime/{category}/{ident}.png", "width": w, "height": h, "pivot": pivot,
            "sourceSheet": target.relative_to(ROOT).as_posix(), "sourceRect": bounds, "sourceCropWithinCell": bounds,
            "nineSlice": None, "mapping": "songlei", "animation": animation, "fitPadding": 0, "resizeMode": "stretch",
            "sampling": "Lanczos", "runtime": True, "usage": "宋磊四向站姿、走路与双棍命中", "bundle": "base",
            "provenance": {"source": original.relative_to(ROOT).as_posix(), "sourceHash": sha256(original.read_bytes()).hexdigest(),
                           "fullCanvas": False, "outputHash": sha256(target.read_bytes()).hexdigest(),
                           "renderer": Path(__file__).resolve().relative_to(ROOT).as_posix()}
        })

    for index, direction in enumerate(DIRECTIONS):
        root = f"hero_songlei_{direction}"
        standing = actor(idle[index])
        register(f"{root}_idle", standing, "idle", "characters", FOOT)
        for step in range(2):
            for motion, art, master in (
                ("walk", side[step] if direction == "right" else walk[index + step * 4], "right-walk" if direction == "right" else "walk"),
                ("attack", attack[index + step * 4], "attack")
            ):
                aligned = align_hero_pose(art, actor(art), standing)
                if motion == "walk":
                    aligned = stabilize_walk_head(aligned, standing, "songlei", direction, step)
                register(f"{root}_{motion}_{step}", aligned, master, "characters", FOOT, f"{root}_{motion}")
        for motion, fps, indexes, loop in (
            ("walk", 8, ("walk_0", "idle", "walk_1", "idle"), True),
            ("attack", 4, ("idle", "attack_0", "attack_1", "idle"), False)
        ):
            clip = {"id": f"{root}_{motion}", "frameIds": [f"{root}_{key}" for key in indexes],
                    "frameCount": len(indexes), "fps": fps, "loop": loop, "restFrame": f"{root}_idle",
                    "category": "characters", "mapping": "songlei", "canvas": CANVAS, "pivot": FOOT,
                    "trimPolicy": "atlas_trim_restore_source_canvas"}
            if motion == "walk":
                clip["stridePixels"] = 48
            clips.append(clip)
    portrait = idle[0].crop((0, 0, idle[0].width, round(idle[0].height * .84)))
    portrait.thumbnail((180, 180), LANCZOS)
    register("songlei_portrait", portrait, "idle", "ui/icons", {"x": 0, "y": 0})
    recipe["assets"] = assets
    recipe["animations"]["animations"] = clips
    RECIPE.write_text(json.dumps(recipe, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
