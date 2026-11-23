"""Register the flat cartoon pose drawings against the game's existing sprite anchors."""
import json
import math
import re

from PIL import Image, ImageDraw, ImageFilter

import cartoon_gait
import cartoon_labor


INK = "#382315"
RESAMPLE = Image.Resampling.LANCZOS
DIRECTIONS = ("down", "left", "right", "up")
REGULAR = ("blue", "straw", "red", "jade")
SPECIAL = ("elite_male", "elite_female", "child")
PATROLS = ("patrol", "patrol-shuffle", "patrol-waddle")
ENEMIES = ("raider", "runner", "armored", "boar", "disruptor", "chief", "commander", "wolfking", "tuskking", "shaman")
# Transparent space protects outlined art and its ASTC edge blocks. Runtime canvas and pivots stay unchanged.
GUTTER = 3


def grid_edges(projection, cells, label):
    projection = list(projection)
    length = len(projection)
    edges = [0]
    for i in range(1, cells):
        expected = length * i / cells
        radius = max(4, round(length / cells * .27))
        cuts = [p for p in range(round(expected) - radius, round(expected) + radius)
                if p > edges[-1] + radius and max(projection[p-2:p+3]) == 0]
        if not cuts:
            raise ValueError(f"No transparent gutter near {label} divider {i} ({expected:.0f})")
        edges.append(min(cuts, key=lambda p: abs(p - expected)))
    return [*edges, length]


class SimpleActors:
    def __init__(self, root, masters, chroma, registration):
        self.masters = masters / "simple"
        self.chroma = chroma
        self.registration = registration
        self.poses = {}
        self.origins = {}
        self.gaits = {}
        self.enemy_layouts = json.loads((root / "native/enemies.json").read_text())["definitions"]
        for board, names in (("regular", REGULAR), ("special", SPECIAL)):
            keys = [f"{name}-{direction}" for direction in DIRECTIONS for name in names]
            self.load(f"{board}-idle", len(names), 4, [f"{key}/idle" for key in keys])
        self.load("patrol-idle", 3, 2, ("elder-chair", "baby", "elder-portrait", *[f"{key}/idle" for key in PATROLS]))
        self.load("enemies-front", 4, 3, (*[f"{key}/idle" for key in ENEMIES], "feathers", "banner"))

    def load(self, board, columns, rows, names):
        path = self.masters / f"{board}.png"
        with Image.open(path) as original:
            image = self.chroma(original)
        alpha = image.getchannel("A").point(lambda value: 255 if value >= 72 else 0)
        w, h = image.size
        yy = grid_edges(alpha.getprojection()[1], rows, board)
        for row, (top, bottom) in enumerate(zip(yy, yy[1:])):
            xx = grid_edges(alpha.crop((0, top, w, bottom)).getprojection()[0], columns, f"{board}, row {row + 1}")
            for col, (left, right) in enumerate(zip(xx, xx[1:])):
                bounds = (left, top, right, bottom)
                cut = image.crop(bounds)
                bbox = alpha.crop(bounds).getbbox()
                if not bbox or bbox[0] < 2 or bbox[1] < 2 or bbox[2] > cut.width - 2 or bbox[3] > cut.height - 2:
                    raise ValueError(f"Incomplete drawing at {board} {row + 1}:{col + 1}, {bbox}")
                cut.putalpha(cut.getchannel("A").point(lambda value: 0 if value < 72 else value))
                key = names[row * columns + col]
                self.poses[key] = (cut.crop(bbox), path)
                self.origins[key] = (left + bbox[0], top + bbox[1])

    def pivot(self, asset):
        width, height = asset["width"], asset["height"]
        if asset["category"] == "enemies":
            kind = asset["id"].split("_walk_")[0]
            layout = self.enemy_layouts[kind]
            return layout["foot"]["x"] * width / layout["canvas"], layout["foot"]["y"] * height / layout["canvas"]
        return asset["pivot"]["x"], asset["pivot"]["y"]

    def place(self, asset, pose, stretch=1, *, grounded=True, working=False):
        image, source = self.poses[pose]
        width, height = asset["width"], asset["height"]
        bx, by, bw, bh = self.registration[asset["id"]]
        box = Image.new("RGBA", (width, height))
        if not grounded:
            x, y = bx + bw / 2, by + bh / 2
            limit = min(bw, 2 * (min(x, width - x) - GUTTER))
            fit = min(bh / image.height, limit / image.width, (height - 2 * GUTTER) / image.height)
            art = image.resize((round(image.width * fit), round(image.height * fit)), RESAMPLE)
            box.alpha_composite(art, (round(x - art.width / 2), round(max(GUTTER, min(height - GUTTER - art.height, y - art.height / 2)))))
            return box, source
        x, foot = self.pivot(asset)
        safe_width = 2 * min(x, width - x) - GUTTER * 4
        source_height = foot - max(GUTTER, by)
        if working:
            source_height = min(source_height, height * .66)
        figure_height = min(source_height, safe_width * image.height / image.width)
        art = image.resize((max(1, round(figure_height * image.width / image.height / math.sqrt(stretch))),
                            max(1, round(figure_height * stretch))), RESAMPLE)
        box.alpha_composite(art, (round(x - art.width / 2), round(foot - art.height)))
        return box, source

    def cycle(self, asset, key, index, length, *, enemy=False, direction="up"):
        pose = f"{key}/idle"
        original, source = self.poses[pose]
        cache = (key, length)
        if cache not in self.gaits:
            self.gaits[cache] = []
            for frame in range(length):
                phase = frame / length
                image = cartoon_gait.enemy(original, self.origins[pose], key, phase) if enemy else cartoon_gait.villager(original, direction, phase)
                self.gaits[cache].append(image)
        drawings = self.gaits[cache]
        width, height = asset["width"], asset["height"]
        x, foot = self.pivot(asset)
        alpha_bounds = [drawing.getchannel("A").getbbox() for drawing in drawings]
        margin = (drawings[0].height - original.height) / 2
        left, right = min(b[0] for b in alpha_bounds), max(b[2] for b in alpha_bounds)
        center = drawings[0].width / 2
        reach = max(center - left, right - center)
        source_foot = margin + original.height
        top_to_foot = source_foot - min(b[1] for b in alpha_bounds)
        fit = min((foot - GUTTER - 1) / top_to_foot, (width / 2 - GUTTER - 1) / reach,
                  foot * .91 / original.height)
        drawing = drawings[index] if index is not None else cartoon_gait.pad(original, round(margin))
        image = drawing.resize((round(drawing.width*fit), round(drawing.height*fit)), RESAMPLE)
        # Source ground and body registration are constant through the entire loop and its idle frame.
        ground = source_foot*fit
        box = Image.new("RGBA", (width, height))
        box.alpha_composite(image, (round(x - image.width / 2), round(foot - ground)))
        return box, source

    def labor(self, asset, key, index):
        # Lock the body and foot to the first frame registration across the whole swing.
        first_frame = asset["id"].rsplit("_", 1)[0] + "_1"
        box, source = self.place({**asset, "id": first_frame}, key, working=True)
        return cartoon_labor.render(box, key.removesuffix("/idle"), index - 1), source

    def render(self, asset):
        name = asset["id"]
        if asset["category"] in ("enemies", "enemy-parts"):
            if name.startswith("enemy_acc_"):
                return self.place(asset, name.removeprefix("enemy_acc_"), grounded=False)
            enemy, frame = re.fullmatch(r"enemy_(\w+)_walk_(\d+)", name).groups()
            count = len(self.enemy_layouts[f"enemy_{enemy}"]["frames"])
            return self.cycle(asset, enemy, int(frame), count, enemy=True)
        if name in ("hd_elder_chair", "portrait_hd_elder_down_idle"):
            return self.place(asset, "elder-chair" if name == "hd_elder_chair" else "elder-portrait", grounded=name == "hd_elder_chair")
        if "baby_idle" in name:
            index = int(name.rsplit("_", 1)[1])
            portrait = name.startswith("portrait_")
            box, source = self.place(asset, "baby", grounded=not portrait)
            if not portrait:
                # The quilt breathes subtly inside the cot. The wooden rim and legs keep the same outline.
                left, top, right, bottom = box.getbbox()
                w, h = right-left, bottom-top
                cx, cy = left + w*.50, top + h*.635
                mask = Image.new("L", box.size)
                ImageDraw.Draw(mask).ellipse((cx-w*.235,cy-h*.11,cx+w*.235,cy+h*.11),fill=255)
                lifted=cartoon_gait.bend(box,(cx,cy),0,(.94,1,1.06)[index-1])
                box=Image.composite(lifted,box,mask.filter(ImageFilter.GaussianBlur(1)))
            return box, source
        patrol = re.fullmatch(r"patrol_walk(?:_(shuffle|waddle))?_(\d+)", name)
        if patrol:
            variant, index = patrol.groups()
            return self.cycle(asset, "patrol" + (f"-{variant}" if variant else ""), int(index)-1, 4)
        portrait, person, work, direction, index = re.fullmatch(
            r"(portrait_)?hd_(blue|straw|red|jade|elite_male|elite_female|child)_(work_)?(down|right|up|left)_(idle|\d+)", name).groups()
        key = f"{person}-{direction}"
        if work:
            return self.labor(asset, f"{key}/idle", int(index))
        if portrait:
            return self.place(asset, f"{key}/idle", grounded=not portrait)
        return self.cycle(asset, key, None if index == "idle" else int(index)-1, 4 if direction == "up" else 6, direction=direction)
