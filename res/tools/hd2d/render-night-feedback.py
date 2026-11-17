"""Render the authored bitmap frames and baked UI seals for 1.0.34 with Pillow."""
import argparse
from math import cos, pi, sin
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SCALE = 3
EXTENT = 80
CONTACT = (40, 40)


class Canvas:
    def __init__(self, width, height):
        self.size = (width, height)
        self.image = Image.new("RGBA", (width * SCALE, height * SCALE))
        self.ink = ImageDraw.Draw(self.image)

    @staticmethod
    def coords(values):
        return tuple(round(v * SCALE) for v in values)

    def ellipse(self, x, y, rx, ry, color, edge=None, weight=1):
        self.ink.ellipse(self.coords((x - rx, y - ry, x + rx, y + ry)), color, edge, round(weight * SCALE))

    def line(self, points, color, weight):
        self.ink.line([self.coords(xy) for xy in points], color, round(weight * SCALE), joint="curve")

    def polygon(self, points, color):
        self.ink.polygon([self.coords(xy) for xy in points], color)

    def pill(self, box, radius, color, edge=None, weight=1):
        self.ink.rounded_rectangle(self.coords(box), round(radius * SCALE), color, edge, round(weight * SCALE))

    def save(self, path):
        self.image.resize(self.size, Image.Resampling.LANCZOS).save(path, optimize=True)


def star(canvas, x, y, radius, angle, rays, color):
    angles = [angle + i * pi / rays for i in range(rays * 2)]
    canvas.polygon([(x + cos(a) * radius * (1 if i % 2 == 0 else .26),
                     y + sin(a) * radius * (1 if i % 2 == 0 else .26)) for i, a in enumerate(angles)], color)


def arrow(canvas, frame):
    x, y = CONTACT
    power = (230, 255, 205, 140, 72)[frame]
    radius = (13, 22, 26, 31, 35)[frame]
    for angle, scale in ((-.43, 1), (.47, .85), (-1.22, .62), (1.18, .65), (pi, .62)):
        length = radius * scale
        a = (x + cos(angle) * length, y + sin(angle) * length)
        b = (x + cos(angle) * (length - 8), y + sin(angle) * (length - 8))
        canvas.line((a, b), (242, 146, 42, power), 2.5)
        if frame < 3:
            canvas.ellipse(*b, 1.6, 1.6, (255, 227, 117, power))
    if frame < 4:
        star(canvas, x, y, (12, 18, 13, 7)[frame], .2, 5, (250, 163, 54, power))
        star(canvas, x, y, (9, 14, 10, 5)[frame], .2, 5, (255, 240, 178, power))
        canvas.ellipse(x, y, 2.5, 2.5, (255, 253, 218, power))


def stone(canvas, frame):
    x, y = CONTACT
    haze = (62, 110, 126, 75, 32)[frame]
    width = (11, 18, 25, 31, 35)[frame]
    canvas.ellipse(x, y + 3, width, width * .5, (201, 146, 92, haze))
    for side in [-1, 1]:
        canvas.ellipse(x + side * width * .63, y + 5, width * .33, width * .25, (238, 192, 125, haze))
    power = (216, 242, 208, 144, 63)[frame]
    for angle, speed, size in ((.04, 1, 5), (-.42, .75, 4), (-1.19, .67, 4), (-2.35, 1, 5), (2.88, .82, 4), (.98, .7, 3)):
        px = x + cos(angle) * width * speed
        py = y + sin(angle) * width * speed
        canvas.polygon([(px - size, py), (px - 1, py - size), (px + size, py - 1), (px + 2, py + size)], (130, 77, 55, power))
        canvas.polygon([(px - size, py), (px - 1, py - size), (px + size, py - 1), (px, py + 1)], (230, 166, 99, power))
    if frame < 2:
        star(canvas, x, y, 10 + frame * 2, pi / 3, 4, (255, 224, 169, 227))


def frost(canvas, frame):
    x, y = CONTACT
    power = (240, 255, 207, 146, 65)[frame]
    extent = (10, 18, 23, 28, 32)[frame]
    canvas.ellipse(x, y, extent, extent * .64, None, (151, 244, 247, power // 2), 1.4)
    for angle, length in ((.38, .9), (1.58, .66), (2.43, .86), (3.7, 1), (4.61, .86), (5.64, .64)):
        px = x + cos(angle) * extent * length
        py = y + sin(angle) * extent * length
        dx, dy = cos(angle) * 4.5, sin(angle) * 4.5
        canvas.polygon([(px - dx, py - dy), (px + dy * .6, py - dx * .6), (px + dx, py + dy),
                        (px - dy * .6, py + dx * .6)], (93, 195, 241, power))
        canvas.line([(px - dx, py - dy), (px + dx, py + dy)], (212, 254, 255, power), 1.1)
    if frame < 4:
        star(canvas, x, y, (12, 15, 10, 5)[frame], .12, 6, (97, 219, 255, power))
        star(canvas, x, y, (8, 11, 7, 3)[frame], .12, 6, (221, 254, 252, power))


def crying(canvas):
    canvas.ellipse(39, 35, 24, 25, "#9f6639")
    canvas.ellipse(39, 33, 22, 23, "#f9c582", "#ffe2ad", 2)
    canvas.ellipse(34, 21, 12, 6, "#ffe1a4")
    canvas.line([(23, 33), (27, 29), (33, 32)], "#683a32", 2.7)
    canvas.line([(45, 32), (50, 29), (55, 33)], "#683a32", 2.7)
    canvas.ellipse(38, 43, 6.7, 8.8, "#723544", "#8e463a", 1)
    canvas.ellipse(39, 47, 4, 2, "#ee8e84")
    canvas.ellipse(20, 38, 5, 3, "#ef9d7d")
    canvas.ellipse(56, 38, 5, 3, "#ef9d7d")
    for x, y in ((20, 42), (56, 43)):
        canvas.polygon([(x, y - 7), (x - 5, y), (x - 5, y + 4), (x + 5, y + 4), (x + 5, y)], "#4aaddd")
        canvas.ellipse(x, y + 4, 5, 5, "#63bfea")
        canvas.ellipse(x - 1.3, y + 2, 1.6, 2.5, "#d3f6fa")


def seal(text, colors, font_path, output):
    canvas = Canvas(152, 50)
    shadow, edge, filling, gloss, ink = colors
    canvas.pill((4, 7, 148, 47), 12, shadow)
    canvas.pill((4, 3, 148, 43), 12, filling, edge, 2)
    canvas.pill((10, 6, 142, 21), 8, gloss)
    font = ImageFont.truetype(str(font_path), 29 * SCALE, index=1)
    canvas.ink.text(canvas.coords((76, 23)), text, font=font, fill=ink, anchor="mm")
    canvas.save(output)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    parser.add_argument("--font", type=Path, default=Path("/System/Library/Fonts/Hiragino Sans GB.ttc"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    for kind, painter in (("arrow", arrow), ("stone", stone), ("slow", frost)):
        for frame in range(5):
            canvas = Canvas(EXTENT, EXTENT)
            painter(canvas, frame)
            canvas.save(args.output / f"fx_impact_{kind}_{frame + 1}.png")
    canvas = Canvas(78, 68)
    crying(canvas)
    canvas.save(args.output / "icon_baby_cry.png")
    seal("推荐", ("#914817", "#a96223", "#f6bf50", "#ffd981", "#603415"), args.font, args.output / "tag_recommended.png")
    seal("已珍藏", ("#2c4d31", "#52804a", "#67964c", "#7ea458", "#fff3cf"), args.font, args.output / "tag_favorite.png")


if __name__ == "__main__":
    main()
