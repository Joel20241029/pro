"""Register the approved hero and committee art with reproducible alpha and shared foot pivots."""
from hashlib import sha256
from pathlib import Path
import json
from statistics import median

from PIL import Image
from hero_alignment import align_hero_pose


ROOT = Path(__file__).resolve().parents[2]
PRODUCTION = ROOT / "source/rendered2d/production/hero-committee"
MASTERS = PRODUCTION / "masters"
FRAMES = PRODUCTION / "frames"
RECIPE = ROOT / "source/asset_recipe.json"
RENDERER = Path(__file__).resolve().relative_to(ROOT).as_posix()
DIRECTIONS = ("down", "left", "right", "up")
SIZE = (144, 144)
PIVOT = (72, 134)
# The original body height is kept for the portrait. Night poses shrink from
# the masters around the same foot pivot so the atlas can trim the unused area.
BODY_HEIGHT = 118
BATTLE_BODY_SCALE = .75
SAMPLE = Image.Resampling.LANCZOS


def digest(path):
    return sha256(path.read_bytes()).hexdigest()


def magenta_to_alpha(image):
    image = image.convert("RGBA")
    pixels = []
    for red, green, blue, _ in image.get_flattened_data():
        excess = min(red, blue) - green
        if red > 115 and blue > 115 and abs(red - blue) < 115 and excess > 44:
            alpha = max(0, min(255, round(255 * (140 - excess) / 96)))
            pixels.append((min(red, green + 60), green, min(blue, green + 36), alpha))
        else:
            pixels.append((red, green, blue, 255))
    image.putdata(pixels)
    return image


def cells(master, rows, edges):
    sheet = magenta_to_alpha(Image.open(master))
    if edges[0] != 0 or edges[-1] != sheet.width:
        raise ValueError(f"Sprite columns do not cover {master.name}")
    result = []
    for row in range(rows):
        top, bottom = sheet.height * row // rows, sheet.height * (row + 1) // rows
        for left, right in zip(edges, edges[1:]):
            frame = sheet.crop((left, top, right, bottom))
            bound = frame.getbbox()
            if not bound or min(bound[:2]) == 0 or bound[2] == frame.width or bound[3] == frame.height:
                raise ValueError(f"Frame reaches a gutter in {master.name}, cell {len(result)}")
            result.append(frame.crop(bound))
    return result


def actor_frame(image, scale):
    # The head is centred over the moving body. Hands and bottles never choose the pivot.
    sample_y = round(image.height * .28)
    line = image.getchannel("A").crop((0, sample_y, image.width, sample_y + 1)).getbbox()
    resized = image.resize((round(image.width * scale), round(image.height * scale)), SAMPLE)
    x = round(PIVOT[0] - (line[0] + line[2]) * scale / 2)
    y = PIVOT[1] - resized.height
    if x < 0 or y < 0 or x + resized.width > SIZE[0]:
        raise ValueError("Hero image exceeds the shared frame canvas")
    output = Image.new("RGBA", SIZE)
    output.alpha_composite(resized, (x, y))
    return output


def asset(name, image, pivot, category, master, clip=None):
    file = FRAMES / (name + ".png")
    image.save(file)
    w, h = image.size
    rect = {"x": 0, "y": 0, "w": w, "h": h}
    return {
        "id": name, "label": name, "category": category, "categoryLabel": "文明里村委会",
        "path": f"runtime/{category}/{name}.png",
        "width": w, "height": h, "pivot": {"x": pivot[0], "y": pivot[1]},
        "sourceSheet": file.relative_to(ROOT).as_posix(),
        "sourceRect": rect, "sourceCropWithinCell": rect, "nineSlice": None,
        "mapping": "zhizhuo", "animation": clip, "fitPadding": 0, "resizeMode": "stretch",
        "sampling": "Lanczos", "runtime": True, "usage": "英雄四向资源或委员会静态图",
        "bundle": {"ui/icons": "base", "building-parts": "buildings", "characters": "battle"}[category],
        "provenance": {"source": master.relative_to(ROOT).as_posix(), "sourceHash": digest(master),
                       "fullCanvas": False, "outputHash": digest(file), "renderer": RENDERER}
    }


def main():
    FRAMES.mkdir(exist_ok=True)
    recipe = json.loads(RECIPE.read_text())
    animations = recipe["animations"]["animations"]
    recipe["assets"] = [a for a in recipe["assets"] if a.get("provenance", {}).get("renderer") != RENDERER]
    recipe["animations"]["animations"] = [a for a in animations if not a["id"].startswith("hero_zhizhuo_")]
    assets = recipe["assets"]
    clips = recipe["animations"]["animations"]
    idle_master = MASTERS / "idle.png"
    # Cut through the actual transparent gutters of the four-view approval sheet.
    idle = cells(idle_master, 1, (0, 585, 1087, 1586, 2172))
    for direction, still in zip(DIRECTIONS, idle):
        prefix = f"hero_zhizhuo_{direction}"
        idle_id = prefix + "_idle"
        idle_frame = actor_frame(still, BODY_HEIGHT * BATTLE_BODY_SCALE / still.height)
        assets.append(asset(idle_id, idle_frame, PIVOT, "characters", idle_master))
        if direction == "down":
            portrait = actor_frame(still, BODY_HEIGHT / still.height)
            assets.append(asset("zhizhuo_portrait", portrait, PIVOT, "ui/icons", idle_master))
        master = MASTERS / (direction + ".png")
        poses = cells(master, 2, (0, 443, 887, 1330, 1774))
        scale = BODY_HEIGHT * BATTLE_BODY_SCALE / median(pose.height for pose in poses)
        for move, fps, group in (("walk", 8, poses[:4]), ("attack", 4, poses[4:])):
            clip = prefix + "_" + move
            ids = []
            for index, pose in enumerate(group):
                name = f"{clip}_{index}"
                aligned = align_hero_pose(pose, actor_frame(pose, scale), idle_frame)
                assets.append(asset(name, aligned, PIVOT, "characters", master, clip))
                ids.append(name)
            clips.append({"id": clip, "frameIds": ids, "frameCount": len(ids), "fps": fps,
                          "loop": move == "walk", "restFrame": idle_id, "category": "characters", "mapping": "zhizhuo",
                          "canvas": {"w": SIZE[0], "h": SIZE[1]}, "pivot": {"x": PIVOT[0], "y": PIVOT[1]},
                          "clock": "battle", "trimPolicy": "atlas_trim_restore_source_canvas",
                          **({"stridePixels": round(67 * BATTLE_BODY_SCALE)} if move == "walk" else {})})
    master = MASTERS / "committee.png"
    original = Image.open(master).convert("RGBA")
    bounds = original.getchannel("A").point(lambda a: 255 if a >= 12 else 0).getbbox()
    tile = original.crop(bounds)
    # Match the booth's visible width at the same map size, preserving the source proportions and shared foot baseline.
    tile.thumbnail((164, 146), SAMPLE)
    facade = Image.new("RGBA", (176, 158))
    facade.alpha_composite(tile, ((facade.width - tile.width) // 2, 150 - tile.height))
    assets.append(asset("hero_committee", facade, (88, 150), "building-parts", master))
    RECIPE.write_text(json.dumps(recipe, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
