"""Render the approved cartoon art from master boards and drawn shapes. No old raster pixels are sampled."""
from pathlib import Path
import argparse
import hashlib
import json
import math
import random
import re

from PIL import Image, ImageColor, ImageDraw, ImageFont, ImageOps

from simple_actors import SimpleActors

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'source/rendered2d/production/cartoon-v1'
MASTERS = SOURCE / 'masters'
RASTER = SOURCE / 'frames'
RECIPE = ROOT / 'source/asset_recipe.json'
ARTS = {}
INK = '#39271e'
SCALE = Image.Resampling.LANCZOS


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def chroma(image):
    out = image.convert('RGBA')
    result = []
    for r, g, b, _ in out.get_flattened_data():
        magenta = min(r,b)-g
        if magenta > 56 and g < 95 and r > 112 and b > 104 and abs(r-b) < 96:
            a = max(0, min(255, round((123-magenta)*255/70)))
            result.append((min(r,g+44),g,min(b,g+37),a))
        else:
            result.append((r,g,b,255))
    out.putdata(result)
    return out


def partition(board, columns, rows, subjects, *, row_edges=None, column_edges=None):
    img = Image.open(MASTERS / (board + '.png'))
    assert len(subjects) == columns * rows
    edges = row_edges or [row*img.height//rows for row in range(rows+1)]
    columns_at = column_edges or [col*img.width//columns for col in range(columns+1)]
    assert len(edges)==rows+1 and edges[0]==0 and edges[-1]==img.height
    assert len(columns_at)==columns+1 and columns_at[0]==0 and columns_at[-1]==img.width
    for idx, name in enumerate(subjects):
        if name is None:
            continue
        col, row = idx % columns, idx // columns
        crop = chroma(img.crop((columns_at[col],edges[row],columns_at[col+1],edges[row+1])))
        bbox = crop.getbbox()
        if not bbox:
            raise ValueError(f'Missing illustrated subject {board}/{name}')
        if bbox[0]==0 or bbox[1]==0 or bbox[2]==crop.width or bbox[3]==crop.height:
            raise ValueError(f'Illustrated subject reaches its gutter: {board}/{name}')
        ARTS[name] = (crop.crop(bbox), board + '.png')


def register_boards():
    partition('buildings',4,4,[*'arrow-body crossbow stone-body catapult slow-body crystal gate-body doors house-body farm-body waterwheel logging-body patrol-body hearth-body streamer'.split(),None], column_edges=(0,313,622,943,1254))
    booth=art('patrol-body')
    w,h=booth.size
    ImageDraw.Draw(booth).polygon([(w*.81,h*.38),(w,h*.37),(w,h*.83),(w*.80,h*.83),(w*.79,h*.55)],fill=(0,0,0,0))
    lantern=blank((116,150))
    d=ImageDraw.Draw(lantern)
    d.line((58,1,58,29),fill=INK,width=5)
    d.ellipse((11,24,105,114),fill='#e84825',outline=INK,width=6)
    d.ellipse((21,29,96,94),fill='#ff7a30')
    d.ellipse((30,39,58,64),fill='#ffc360')
    d.rounded_rectangle((39,105,77,118),radius=4,fill='#e3a130',outline=INK,width=4)
    d.line((57,117,57,140),fill='#ffcc42',width=8)
    ARTS['lantern']=(lantern,'buildings.png')
    stone=art('stone-body')
    sw,sh=stone.size
    face=ImageDraw.Draw(stone)
    face.rectangle((0,0,sw,round(sh*.22)),fill=(0,0,0,0))
    face.polygon([(sw*.45,sh*.22),(sw*.53,sh*.22),(sw*.54,sh*.34),(sw*.44,sh*.34)],fill='#49372a')
    partition('scenery',4,3,'oak pine sign palisade empty-pad pears apples blossom logs torch rock wheat'.split())
    partition('icons',5,5,'food wood population build house logging family heart arrow stone slow shield baby_icon view trophy close night_shield crowned_heart tactic_scroll tactic_rage tactic_shield backpack shop liang_essence genealogy'.split(), column_edges=(0,256,513,769,997,1283))
    # Fit standalone transparent illustrations to their registered cells.
    for key, filename in [('liang_briefs', 'liang-briefs.png'), ('liang_bra', 'liang-bra.png'),
                          ('patrol_rapid_gun', 'patrol-rapid-gun.png')]:
        illustration = Image.open(MASTERS / filename).convert('RGBA')
        bounds = illustration.getchannel('A').point(lambda alpha: 255 if alpha >= 10 else 0).getbbox()
        ARTS[key] = (illustration.crop(bounds), filename)


def blank(size):
    return Image.new('RGBA',size)


def centered(out, img, box, *, base=False):
    x0,y0,x1,y1=box
    img=img.crop(img.getbbox())
    width,height=x1-x0,y1-y0
    scale=min(width/img.width,height/img.height)
    res=img.resize((max(1,round(img.width*scale)),max(1,round(img.height*scale))), SCALE)
    out.alpha_composite(res,(round((x0+x1-res.width)/2),y1-res.height if base else round((y0+y1-res.height)/2)))


def art(name):
    return ARTS[name][0]


def source(name):
    return MASTERS / ARTS[name][1]


def frame_box(asset, registered):
    x,y,w,h=registered[asset['id']]
    return x,y,x+w,y+h


def draw_on(asset, img, registered, *, foot=False):
    out=blank((asset['width'],asset['height']))
    centered(out,img,frame_box(asset,registered),base=foot)
    return out


def bubble_button(name, size):
    # Resolve the silhouette at four times source resolution. BOX integrates coverage
    # without the bright or dark ringing that a sharpening filter adds to transparent edges.
    w, h = size
    circle = name.startswith('button_')
    disabled = name == 'panel_button_disabled'
    if circle or name == 'panel_button_gold':
        face, lip, outline = '#ffcb73', '#e9a051', '#86504d'
    elif disabled:
        face, lip, outline = '#e9dfe4', '#d5c5cc', '#a8929e'
    elif name == 'panel_button_red':
        face, lip, outline = '#f5b2c1', '#da8b9e', '#995969'
    else:
        face, lip, outline = '#ffe1d9', '#edb1b4', '#9d626e'
    ss = 4
    canvas = blank((w * ss, h * ss))
    brush = ImageDraw.Draw(canvas)
    pad, edge, depth = (6, 5, 13) if circle else (3, 4, 8)
    radius = h / 2 - pad if circle else 52
    def shell(inset, foot, color):
        box = (inset, inset, w - inset, h - inset - foot)
        brush.rounded_rectangle(tuple(round(v * ss) for v in box),
                                radius=round((radius - inset + pad) * ss), fill=color)
    shell(pad, 0, outline)
    shell(pad + edge, 0, lip)
    shell(pad + edge, depth, face)
    if not disabled:
        # One broad reflection, entirely inside the fixed corner of the nine-slice.
        cx, cy, rr, weight = (w * .46, h * .48, w * .36, 9) if circle else (54, 54, 35, 6)
        xy = [(round((cx + rr * math.cos(math.radians(a))) * ss),
               round((cy + rr * math.sin(math.radians(a))) * ss)) for a in range(209, 249)]
        brush.line(xy, fill='#fff6df', width=weight * ss)
        half = weight * ss / 2
        for x, y in [xy[0], xy[-1]]:
            brush.ellipse((x-half, y-half, x+half, y+half), fill='#fff6df')
    return canvas.resize(size, Image.Resampling.BOX)


def rounded_panel(name, size):
    if name.startswith(('button_', 'panel_button_')):
        return bubble_button(name, size)
    w, h = size
    out = blank(size)
    d = ImageDraw.Draw(out)
    # Source radii fit inside the existing nine-slice corners at all button sizes.
    styles = {
        'panel_parchment': ('#cb8998', '#f7cbc9', '#ffe6df', 44),
        'panel_header': ('#993e59', '#ac4f67', '#de8a9c', 35),
        'panel_card': ('#dba695', '#fff4e4', '#fffdf6', 31),
        'panel_card_disabled': ('#beaccc', '#ebe0f2', '#f7effb', 31),
        'panel_anchored_tip': ('#d4a18e', '#fff0d9', '#fffbf1', 29),
        'panel_tip': ('#d4a18e', '#fff0d9', '#fffbf1', 29),
        'panel_portrait_frame': ('#dbad9c', '#f9e0d4', '#fff4e5', 29),
    }
    if name == 'panel_anchored_tip_tail':
        points = [(7, 8), (w-8, 8), (w//2, h-9)]
        d.polygon(points, fill='#fff0d9', outline='#d4a18e', width=5)
        return out
    edge, face, shine, radius = styles[name]
    d.rounded_rectangle((0, 2, w-1, h-1), radius=radius, fill=edge)
    d.rounded_rectangle((4, 4, w-5, h-8), radius=radius-4, fill=face)
    d.line((radius, 8, w-1-radius, 8), fill=shine, width=3)
    return out


def tag(name,size):
    out=blank(size); w,h=size
    d=ImageDraw.Draw(out)
    d.rounded_rectangle((2,3,w-3,h-4),radius=max(4,h//6),fill='#9448aa' if name=='tag_favorite' else '#e85a27',outline=INK,width=max(2,h//13))
    font=ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc',round(.57*h))
    label='已珍藏' if name=='tag_favorite' else '推荐'
    d.text((w/2,h/2-1),label,anchor='mm',font=font,fill='#fff3cb')
    return out


def key_for_icon(name):
    return 'baby_icon' if name=='icon_baby' else name.removeprefix('icon_')


def artwork_hash_input():
    return Path(__file__)


def ellipse(draw, x, y, rx, ry, **kw):
    draw.ellipse((x-rx,y-ry,x+rx,y+ry),**kw)


def star(draw,x,y,r,color,rotation=0,points=4):
    xy=[]
    for i in range(points*2):
        angle=rotation+math.pi*i/points
        size=r if i%2==0 else r*.29
        xy.append((x+math.cos(angle)*size,y+math.sin(angle)*size))
    draw.polygon(xy,fill=color)


def translucent_glow(size, at, radius, color, opacity):
    out=blank(size)
    d=ImageDraw.Draw(out)
    for i in range(12,0,-1):
        r=radius*i/12
        a=round(opacity*(1-i/13)**1.7)
        ellipse(d,*at,r,r*.83,fill=(*color,a))
    return out


def flame(size, index, center=None):
    w,h=size
    x,y=center or (w*.5,h*.83)
    s=min(w,h)
    t=math.sin(index*math.tau/8)
    out=translucent_glow(size,(x,y-s*.15),s*.42,(255,175,52),90)
    d=ImageDraw.Draw(out)
    d.polygon([(x-s*.22,y),(x-s*.28,y-s*.26),(x-s*.11,y-s*.46),(x-s*.10,y-s*.25),
         (x+s*.035*t,y-s*(.66+.06*t)),(x+s*.25,y-s*.33),(x+s*.24,y-s*.13),(x+s*.18,y)],fill='#e85818',outline='#7e391b',width=max(1,round(s*.028)))
    d.polygon([(x-s*.11,y),(x-s*.15,y-s*.23),(x-s*.025,y-s*.12),(x+s*.045*t,y-s*.43),
         (x+s*.15,y-s*.17),(x+s*.12,y)],fill='#ffbf32')
    d.polygon([(x-s*.071,y),(x-s*.05,y-s*.13),(x+s*.035,y-s*.23),(x+s*.058,y)],fill='#fff0a0')
    return out


def orbit(size, color, *, fill=None, ratio=.77):
    w,h=size;x,y=w*.5,h*.5
    out=blank(size); d=ImageDraw.Draw(out)
    r=min(w,h)*.42
    outer=(x-r,y-r*ratio,x+r,y+r*ratio)
    if fill: d.ellipse(outer,fill=fill)
    width=max(2,round(r*.10))
    d.arc(outer,0,359,fill=color,width=width)
    d.arc((x-r*.89,y-r*ratio*.89,x+r*.89,y+r*ratio*.89),204,319,fill='#fff1bd',width=max(1,width//3))
    return out


def impact(size,index,count,brown=False,frost=False):
    # Draw at 3× source resolution, then resolve antialiased coverage before ASTC compression.
    w,h=[dimension*3 for dimension in size]; x,y=w*.5,h*.51
    r=min(w,h)
    t=(index-1)/max(1,count-1)
    visible=round(255*(1-.84*t))
    col=(110,222,255) if frost else (227,156,80) if brown else (255,189,61)
    outline=(24,73,108) if frost else (100,55,31)
    highlight=(230,253,255) if frost else (251,200,124)
    out=blank((w,h))
    d=ImageDraw.Draw(out)
    if brown:
        rw=r*(.16+.23*t)
        d.ellipse((x-rw,y-rw*.46,x+rw,y+rw*.46),outline=(*outline,visible),width=round(r*.060))
        d.ellipse((x-rw+r*.013,y-rw*.46+r*.013,x+rw-r*.013,y+rw*.46-r*.013),
                  outline=(255,207,122,visible),width=round(r*.031))
    for i in range(6 if brown else 5):
        a=i*math.tau/(6 if brown else 5)+.19
        length=r*(.14+.21*t)
        dx,dy=math.cos(a)*length,math.sin(a)*length*.83
        px,py=x+dx,y+dy
        if frost or brown:
            extent=r*(.105-.045*t)
            dx,dy=math.cos(a)*extent,math.sin(a)*extent
            shard=[(px+dx,py+dy),(px-dy*.54,py+dx*.54),(px-dx,py-dy),(px+dy*.54,py-dx*.54)]
            if brown:
                shard.insert(2,(px-dx*.72-dy*.40,py-dy*.72+dx*.40))
            d.polygon(shard,fill=(*col,visible),outline=(*outline,visible),width=round(r*.018))
            d.line(((px-dy*.23,py+dx*.23),(px+dx*.54,py+dy*.54)),
                   fill=(*highlight,visible),width=round(r*.011))
        else:
            star(d,px,py,r*(.086-.035*t),(*outline,visible),a)
            star(d,px,py,r*(.071-.032*t),(*col,visible),a)
    if not brown and t < .7:
        star(d,x,y,r*(.31-.17*t),(*outline,visible),.2,5)
        star(d,x,y,r*(.27-.17*t),(255,249,216,visible),.2,5)
    return out.resize(size,SCALE)


def tower_impact(size, kind, frame, count):
    # Use the shared 128-unit drawing grid. Four samples per output pixel keep the
    # ink edges and small bright facets readable when the atlas is downscaled.
    unit = 4 * size[0] / 128
    layer = blank((size[0] * 4, size[1] * 4))
    draw = ImageDraw.Draw(layer)
    age = (frame - 1) / (count - 1)
    expansion = 1 - (1 - age) ** 2
    center = 64

    def polygon(points, fill, ink=None, weight=1):
        points = [(round(x * unit), round(y * unit)) for x, y in points]
        draw.polygon(points, fill=fill, outline=ink, width=max(1, round(weight * unit)))

    def arc(x, y, rx, ry, start, end, color, width):
        box = tuple(round(v * unit) for v in (x - rx, y - ry, x + rx, y + ry))
        draw.arc(box, start, end, fill=color, width=max(1, round(width * unit)))

    def facet(x, y, degrees, length, width, ink, face, highlight):
        # The long axis points away from the contact. The light face stays slim
        # enough for the monster to show through the gaps between fragments.
        angle = math.radians(degrees)
        dx, dy = math.cos(angle), math.sin(angle)
        tip = (x + dx * length, y + dy * length)
        tail = (x - dx * length * .55, y - dy * length * .55)
        left = (x - dy * width, y + dx * width)
        right = (x + dy * width, y - dx * width)
        polygon([tail, left, tip, right], face, ink, .85)
        polygon([(x, y), tip, (x + dy * width * .66, y - dx * width * .66)], highlight)

    if kind == 0:
        # Arrow effects rotate with the projectile. The white-hot leading streak
        # points along local +X, with gold splinters peeling away on either side.
        ink, gold, white = '#8a411a', '#ffba3d', '#fff8ce'
        if frame <= 3:
            core = (1, 1.20, .64)[frame - 1]
            polygon([(center + x * core, center + y * core) for x, y in
                     [(-22, 1), (-9, -2), (-13, -8), (-2, -4), (3, -14),
                      (5, -4), (24, -2), (9, 2), (13, 7), (3, 4), (-2, 10), (-3, 4)]],
                    gold, ink, 1)
            facet(center + 2, center, -5, 15 * core, 2.2 * core, white, white, '#ffffff')
        for i, (angle, reach, length) in enumerate([
                (-52, 36, 10), (19, 38, 11), (62, 27, 6), (153, 28, 7), (-150, 34, 8)]):
            radius = 8 + reach * expansion
            direction = math.radians(angle)
            px = center + math.cos(direction) * radius
            py = center + math.sin(direction) * radius * .80
            facet(px, py, angle, length * (1 - .48 * age), 2.7 - age,
                  ink, gold if i % 2 == 0 else '#ffdf69', white)
    elif kind == 1:
        # This frame is anchored at the monster's feet. Break the amber shock
        # into low, disconnected arcs, leaving the middle of the body exposed.
        ink, amber, cream = '#754323', '#eda247', '#fff0aa'
        ground = 65
        rx, ry = 14 + 32 * expansion, 5 + 10 * expansion
        for start, end in [(7, 74), (95, 165), (183, 224), (289, 346)]:
            arc(center, ground, rx, ry, start, end, ink, 3.4)
            arc(center, ground, rx - .5, ry - .4, start + 3, end - 3, amber, 2.1)
            arc(center, ground, rx - 1, ry - .8, start + 5, end - 13, cream, .9)
        if frame <= 6:
            # Staggered pointed tufts expand outwards, then settle into the ring.
            for side in (-1, 1):
                x = center + side * (7 + 21 * expansion)
                width = 7 + 2 * math.sin(age * math.pi)
                height = (6 + 8 * math.sin(age * math.pi)) * (1 - age * .65)
                dust = [(-.95, .12), (-.88, -.25), (-.50, -.32), (-.86, -.93),
                        (-.18, -.55), (.25, -1.10), (.32, -.51), (1, -.36), (.70, .05)]
                polygon([(x + side * u * width, ground + v * height) for u, v in dust],
                        '#e0a25e', ink, 1)
                polygon([(x + side * u * width, ground + v * height) for u, v in
                         [(-.71, -.22), (-.24, -.43), (-.67, -.79), (.13, -.42), (.62, -.30)]], cream)
        for i, (dx, launch, r) in enumerate([(-34, 19, 4), (-19, 29, 5), (-8, 16, 3),
                                              (13, 24, 4), (29, 27, 5), (39, 11, 3)]):
            px = center + dx * (.25 + .75 * expansion)
            py = ground - 3 - launch * math.sin(age * math.pi) + (i % 2) * 2
            radius = r * (1 - age * .45)
            rock = [(-1, -.25), (-.45, -.85), (.46, -.75), (1, .02), (.47, .70), (-.64, .58)]
            polygon([(px + u * radius, py + v * radius) for u, v in rock], '#bb7944', ink, 1)
            polygon([(px + u * radius, py + v * radius) for u, v in
                     [(-.72, -.26), (-.37, -.63), (.36, -.59), (.59, -.16), (-.19, .05)]], '#ffe0a0')
    else:
        # Fracture around an open center: the first contact glints, broad
        # two-faced crystals travel outwards, and a broken frost rim dissolves.
        ink, blue, white = '#236586', '#57d5f3', '#e8ffff'
        if frame <= 3:
            flash = (1, .78, .36)[frame - 1]
            facet(center, center, -64, 10 * flash, 2.3 * flash, ink, white, white)
            facet(center, center, 24, 8 * flash, 2.1 * flash, ink, white, white)
        rx, ry = 11 + 27 * expansion, 9 + 21 * expansion
        for start in [12, 140, 261]:
            arc(center, center, rx, ry, start, start + 42, '#478eaf', 2.2)
            arc(center, center, rx - .5, ry - .4, start + 2, start + 34, '#a6f5ff', 1.3)
        for i, (angle, reach, length, width) in enumerate([
                (-72, 29, 12, 4.4), (-24, 34, 10, 3.9), (28, 34, 12, 4.2),
                (80, 25, 7, 3.2), (151, 30, 10, 4.0), (-151, 31, 11, 4.3)]):
            direction = math.radians(angle)
            r = 7 + reach * expansion
            px, py = center + math.cos(direction) * r, center + math.sin(direction) * r * .85
            scale = (.8 + .28 * math.sin(math.pi * age)) * (1 - .40 * age)
            facet(px, py, angle, length * scale, width * scale, ink, blue, white)
            if i % 2 == 0 and 2 <= frame <= 7:
                facet(px - math.sin(direction) * 7, py + math.cos(direction) * 7,
                      angle + 12, 3.0 * scale, 1.5 * scale, '#3e9ebf', '#a5edff', white)
    # Keep a visible tail on the last authored frame, then let the clip expire.
    if age > .56:
        opacity = 1 - .83 * ((age - .56) / .44) ** 1.4
        layer.putalpha(layer.getchannel('A').point(lambda value: round(value * opacity)))
    return layer.resize(size, SCALE)


def effect(name,size):
    w,h=size; x,y=w*.5,h*.5
    out=blank(size); d=ImageDraw.Draw(out)
    r=min(w,h)
    def points(sequence): return [(w*px,h*py) for px,py in sequence]
    if name=='fx_arrow':
        d.line(points([(.10,.81),(.85,.20)]),fill=INK,width=max(2,round(r*.08)))
        d.line(points([(.10,.81),(.85,.20)]),fill='#c48b4c',width=max(1,round(r*.038)))
        d.polygon(points([(.96,.06),(.83,.36),(.82,.24),(.71,.24)]),fill='#c7eff1',outline=INK,width=max(1,round(r*.014)))
        d.polygon(points([(.11,.82),(.14,.63),(.34,.63),(.24,.82)]),fill='#f0bd56',outline=INK,width=max(1,round(r*.018)))
    elif name in ('fx_stone','fx_ice'):
        ice=name=='fx_ice'
        d.polygon(points([(.20,.32),(.38,.17),(.72,.19),(.85,.41),(.77,.72),(.48,.85),(.21,.68),(.13,.47)]),fill='#55c8f1' if ice else '#9b7052',outline='#154c70' if ice else INK,width=max(1,round(r*.045)))
        d.polygon(points([(.22,.34),(.40,.23),(.66,.22),(.7,.4),(.46,.51)]),fill='#bdedff' if ice else '#c69e6d')
        d.polygon(points([(.46,.54),(.71,.42),(.80,.43),(.72,.67),(.48,.79)]),fill='#258dd0' if ice else '#79533e')
    elif name=='icon_baby_cry':
        ellipse(d,x,y,r*.43,r*.40,fill='#ffe2aa',outline=INK,width=max(2,r//25))
        for s in (-1,1):
            a=x+s*r*.15
            d.line((a-r*.04,y-r*.04,a+r*.04,y-r*.08),fill=INK,width=max(2,r//20))
            ellipse(d,a+s*r*.07,y+r*.06,r*.034,r*.054,fill='#76cffc')
        ellipse(d,x,y+r*.12,r*.105,r*.085,fill='#773637')
    elif name=='fx_rage_up':
        d.polygon(points([(.5,.08),(.85,.44),(.65,.45),(.65,.85),(.35,.85),(.35,.45),(.15,.44)]),fill='#ee512a',outline=INK,width=max(1,r//27))
        d.polygon(points([(.5,.17),(.70,.37),(.57,.38),(.57,.72),(.45,.74),(.44,.36),(.31,.37)]),fill='#ff9853')
    elif name in ('fx_rage_orbit','fx_quality_elite','fx_quality_hero','fx_quality_legendary','fx_shield_ring','fx_slow_ring','fx_shield_dome'):
        color={'fx_rage_orbit':'#f75024','fx_quality_elite':'#5ae7ff','fx_quality_hero':'#dc86ff','fx_quality_legendary':'#ffcb45','fx_shield_ring':'#5ae0cd','fx_slow_ring':'#71dcff','fx_shield_dome':'#8cf2e8'}[name]
        return orbit(size,color,fill=(86,202,215,77) if name=='fx_shield_dome' else None,ratio=.86 if name=='fx_shield_dome' else .69)
    elif name=='fx_rage_glow':
        return translucent_glow(size,(x,y),r*.46,(255,90,47),210)
    elif name in ('fx_rage_hit','fx_hit','fx_shield_hit'):
        return impact(size,1,5,frost=name=='fx_shield_hit')
    else:
        pref,i=name.rsplit('_',1)
        if pref not in ('fx_tower_stone_impact','fx_tower_frost_impact','fx_impact_arrow','fx_impact_stone'):
            raise ValueError(name)
        if pref != 'fx_impact_stone':
            kind = ('fx_impact_arrow', 'fx_tower_stone_impact', 'fx_tower_frost_impact').index(pref)
            return tower_impact(size, kind, int(i), 5 if kind == 0 else 8)
        return impact(size,int(i),5,brown=True)
    return out


def building(asset,registration):
    name=asset['id']
    size=(asset['width'],asset['height'])
    if name == 'motion_gate_body':
        master = MASTERS / 'palisade-gate-frame.png'
        return Image.open(master).convert('RGBA').resize(size, SCALE), master
    if name=='hd_village_window_glow':
        return translucent_glow(size,(size[0]*.5,size[1]*.5),min(size)*.41,(255,194,77),198),artwork_hash_input()
    if name=='motion_patrol_icon':
        key='patrol-body'
        out=draw_on(asset,art(key),registration,foot=True)
        rect=frame_box(asset,registration)
        x,y,x1,y1=rect
        lw,lh=max(1,round((x1-x)*.23)),max(1,round((y1-y)*.26))
        centered(out,art('lantern'),(x1-lw-3,y+round((y1-y)*.35),x1-3,y+round((y1-y)*.35)+lh))
        return out,source(key)
    if name.endswith('_body') or name=='motion_farm_wheel_base':
        key='waterwheel' if name.endswith('_base') else name.removeprefix('motion_').replace('_body','-body')
        return draw_on(asset,art(key),registration,foot=True),source(key)
    pref,index=name.rsplit('_',1)
    i=int(index)
    w,h=size
    wave=math.sin(i*math.tau/8)
    keyed={
        'motion_arrow_attack':'crossbow','motion_stone_attack':'catapult',
        'motion_slow_attack':'crystal','motion_slow_idle':'crystal',
        'motion_farm_wheat':'wheat','motion_patrol_lantern':'lantern','motion_patrol_streamer':'streamer'
    }
    if pref == 'motion_gate_doors':
        master = MASTERS / 'palisade-gate-doors.png'
        pair = Image.open(master).convert('RGBA')
        mid = round(pair.width * .503)  # Center seam of the approved double doors.
        opening = (0,.09,.2,.36,.59,.77,.83,.83,.69,.45,.24,.08,0)[i]
        out = blank(size)
        for left, right, target in [(0, mid, w//2), (mid, pair.width, w-w//2)]:
            width = max(1, round(target * (1-opening*.85)))
            leaf = pair.crop((left, 0, right, pair.height)).resize((width, h), SCALE)
            out.alpha_composite(leaf, (0 if left == 0 else w-width, 0))
        return out, master
    if pref in keyed:
        key=keyed[pref]
        image=art(key)
        if pref in ('motion_arrow_attack','motion_stone_attack'):
            angle=([-10,-18,-12,-5,4,5,2,0,0] if key=='crossbow' else [26,45,33,19,8,-6,-4,0,0])[i]
        elif pref=='motion_slow_attack':
            angle=[5,16,11,-8,-13,-9,5,2,0][i]
        elif pref=='motion_slow_idle':
            angle=math.sin(i*math.tau/10)*6
        else:
            angle=wave*(9 if key=='lantern' else 6)
        rotated=image.rotate(angle,Image.Resampling.BICUBIC,expand=True)
        if pref=='motion_stone_attack':
            out=blank(size)
            x,y,x1,y1=frame_box(asset,registration)
            inset=2
            # The new mechanism's stone feet stay planted on the platform during the swing.
            centered(out,rotated,(max(0,x-inset),y,min(w,x1+inset),min(h,y1+7)),base=True)
            return out,source(key)
        return draw_on(asset,rotated,registration,foot=True),source(key)

    out=blank(size); d=ImageDraw.Draw(out)
    if 'fire_' in pref or pref=='motion_hearth_flame':
        return flame(size,i),artwork_hash_input()
    if pref=='motion_house_smoke':
        for j in range(4):
            t=(i/10+j/4)%1
            x,y=w*(.38+.29*t),h*(.9-.68*t)
            ellipse(d,x,y,w*(.08+.14*t),h*(.06+.13*t),fill=(255,247,218,round(174*math.sin(t*math.pi))))
    elif pref=='motion_house_window':
        return translucent_glow(size,(w*.5,h*.55),min(w,h)*.47,(255,200,86),round(143+52*wave)),artwork_hash_input()
    elif pref=='motion_farm_wheel':
        x,y=w*.50,h*.42
        for n in range(6):
            a=n*math.tau/6+i*math.tau/8
            d.line((x,y,x+math.cos(a)*w*.30,y+math.sin(a)*h*.28),fill='#e9ad5d',width=max(1,round(h*.064)))
        for n in range(3):
            q=(i/8+n/3)%1
            x,y=w*(.22+q*.17),h*(.6+q*.31)
            ellipse(d,x,y,w*.042,h*.041,fill=(165,220,250,round(230*math.sin(q*math.pi))))
    elif pref=='motion_logging_saw':
        cy=h*(.51+.05*wave); left=w*(.14+.12*wave); right=left+w*.60
        teeth=[(left+j*(right-left)/12,cy+h*(.10 if j%2 else .24)) for j in range(13)]
        d.polygon([(left,cy-h*.13),(right,cy-h*.18), *reversed(teeth)],fill='#becbd0',outline=INK,width=max(1,round(h*.055)))
        for n in range(3):
            star(d,w*(.55+n*.13),h*(.75+.1*math.sin(i+n)),h*.09,'#f4b65e',.3)
    else:
        raise ValueError(name)
    return out,artwork_hash_input()


def decoration(asset,registration):
    name=asset['id'];w,h=asset['width'],asset['height']
    sources={'deco_pear_pair':'pears','deco_blossom_ivory':'blossom','deco_tree_oak':'oak','deco_tree_pine':'pine',
             'deco_village_sign':'sign','deco_apple_pair':'apples','deco_log_pile':'logs',
             'building_palisade':'palisade','building_tower_pad':'empty-pad','deco_torch':'torch'}
    if name in sources:
        key=sources[name]
        out=draw_on(asset,art(key),registration,foot=True)
        if name in ('building_palisade','deco_village_sign'):
            # Palisade tiles share edges. The sign needs the original width for its runtime lettering.
            rect=frame_box(asset,registration)
            x0,y0,x1,y1=rect
            out=blank((w,h))
            out.alpha_composite(art(key).resize((x1-x0,y1-y0),SCALE),(x0,y0))
        return out,source(key)
    if name in ('shadow_actor','shadow_tree'):
        out=blank((w,h));d=ImageDraw.Draw(out)
        x0,y0,x1,y1=frame_box(asset,registration)
        cx,cy=(x0+x1)/2,(y0+y1)/2
        for n in range(7,0,-1):
            extent=.53+.061*n
            ellipse(d,cx,cy,(x1-x0)*.5*extent,(y1-y0)*.5*extent,fill=(55,57,27,round(103-n*9)))
        return out,artwork_hash_input()
    if name in ('torch_burn_1','torch_burn_2'):
        out=draw_on(asset,art('torch'),registration,foot=True)
        x0,y0,x1,y1=frame_box(asset,registration)
        radius=max(3,round((x1-x0)*.24))
        fire=flame((radius*2,radius*2),int(name[-1])+2)
        out.alpha_composite(fire,(round((x0+x1)/2)-radius,max(0,y0-radius)))
        return out,source('torch')
    raise ValueError(name)


def blossom_tree(size, lilac, seed):
    """Original clustered blossom silhouettes for the map edge, with trunk and canopy aligned to the same foot."""
    w, h = size
    out = blank(size)
    d = ImageDraw.Draw(out)
    rng = random.Random(seed)
    ink = '#523346' if lilac else '#623841'
    tones = ('#ad77b0', '#d99ad6', '#f0c0e9') if lilac else ('#be6983', '#e48fa6', '#ffc0c7')
    for line in [
        [(w*.53,h*.89),(w*.47,h*.62),(w*.40,h*.46),(w*.31,h*.36)],
        [(w*.48,h*.70),(w*.62,h*.56),(w*.71,h*.43)],
        [(w*.48,h*.64),(w*.53,h*.35)],
    ]:
        d.line(line, fill=ink, width=max(2,round(w*.086)), joint='curve')
        d.line(line, fill='#9b6152', width=max(1,round(w*.047)), joint='curve')
    for x,y,r in [( .27,.47,.20),(.68,.45,.22),(.48,.55,.22),(.16,.34,.14),
                  (.38,.28,.22),(.57,.29,.24),(.76,.29,.18),(.50,.17,.18)]:
        cx,cy=x*w,y*h
        for j in range(7):
            angle=j*math.tau/7
            px=cx+math.cos(angle)*r*w*.62
            py=cy+math.sin(angle)*r*h*.44
            ellipse(d,px,py,r*w*.54,r*h*.4,fill=ink)
        for j in range(7):
            angle=j*math.tau/7
            px=cx+math.cos(angle)*r*w*.60
            py=cy+math.sin(angle)*r*h*.40
            ellipse(d,px,py,r*w*.43,r*h*.30,fill=tones[0 if j in (1,2,3) else 1])
        ellipse(d,cx,cy,r*w*.61,r*h*.39,fill=tones[1])
        for _ in range(8):
            px=cx+r*w*rng.uniform(-.60,.58)
            py=cy+r*h*rng.uniform(-.36,.27)
            f=rng.uniform(.018,.034)*w
            for ox,oy in [(0,-.57),(.57,0),(0,.57),(-.57,0)]:
                ellipse(d,px+ox*f,py+oy*f,f*.62,f*.53,fill=tones[2])
            ellipse(d,px,py,f*.22,f*.22,fill='#fff3ce')
    return out


def valley_rocks(draw, x, y, scale):
    for dx,dy,w,h in [(0,0,66,34),(35,11,48,22),(-26,13,34,17)]:
        rock=[(-.52,.40),(-.42,-.02),(-.23,-.49),(.08,-.70),(.41,-.25),(.56,.40),(.09,.57)]
        def points(shape):
            return [(x+(dx+a*w)*scale,y+(dy+b*h)*scale) for a,b in shape]
        draw.polygon(points(rock),fill='#766a8a',outline='#4e475d',width=max(1,round(scale*2)))
        draw.polygon(points([(-.40,.01),(-.20,-.47),(.07,-.58),(.02,-.09),(-.20,.29)]),fill='#a898b0')
        draw.polygon(points([(.03,-.07),(.39,-.22),(.49,.34),(.06,.49)]),fill='#635975')


def terrain(size):
    w,h=size
    out=Image.new('RGBA',size,'#a1ac78')
    r=random.Random(2189)
    d=ImageDraw.Draw(out)
    for y in range(h):
        y1=y/h
        c=(round(160-9*y1+8*math.sin(y1*5)),round(170+8*math.sin(y1*3)),round(113-8*y1))
        d.line((0,y,w,y),fill=c)
    field=['#a0ad77','#a8b27e','#adb77f','#98a66e','#a4b27a','#96a16d']
    for _ in range(85):
        x,y=r.randrange(w),r.randrange(h)
        ellipse(d,x,y,r.randrange(28,130),r.randrange(7,26),fill=r.choice(field))
    road=ROOT.parent/'project/LayaProject/src/config/RoadGeometry.ts'
    match=re.search(r'ROAD_PROFILE = (\[[\s\S]*?\]) as const',road.read_text())
    profile=json.loads(re.sub(r',\s*\]',']',match[1]))
    top,gate,wall=140,830,914
    first,last=profile[0][0],profile[-1][0]
    step=profile[1][0]-first
    ratio=w/720
    def limits(ref):
        offset=max(0,min((ref-first)/step,len(profile)-1))
        row=min(math.floor(offset),len(profile)-2)
        blend=offset-row
        a,b=[profile[row][i]*(1-blend)+profile[row+1][i]*blend for i in [1,2]]
        ease=max(0,min(1,(ref-last)/(gate-last)))
        ease=ease*ease*(3-2*ease)
        center=(a+b)/2
        center=center*(1-ease)+360*ease
        half=(b-a)/2+7
        return ((center-half)*ratio,(center+half)*ratio)
    left,right=[],[]
    for y in range(wall+1):
        a,b=limits(top+(gate-top)*y/wall)
        left.append((a,y));right.append((b,y))
    for y in range(wall+1,wall+94):
        t=(y-wall)/94
        a,b=limits(gate)
        spread=(b-a)*.5*math.sqrt(max(0,1-t*t))
        left.append((round(w/2-spread),y));right.append((round(w/2+spread),y))
    # Clearings and rocks stay outside the path; the route check below samples every original road row.
    for x,y,rx,ry in [(w-108,486,92,38),(116,702,104,37),(w*.48,1162,132,42),(w*.81,1280,120,42)]:
        ellipse(d,x,y,rx,ry,fill='#bdad75')
        ellipse(d,x-5,y-3,rx*.88,ry*.8,fill='#c8ba83')
    def paint_road(points, color):
        # Supersample the soil edge so the curved shoulder stays smooth after atlas compression.
        samples = 4
        mask = Image.new('L', (w * samples, h * samples), 0)
        ImageDraw.Draw(mask).polygon([(round(x * samples), round(y * samples)) for x, y in points], fill=255)
        out.paste(color, (0, 0, w, h), mask.resize(size, SCALE))
    paint_road(left + right[::-1], '#edb45a')
    lim = 860
    paint_road([(x+7,y) for x,y in left[:lim]]+[(x-7,y) for x,y in reversed(right[:lim])], '#ffd37b')
    d.rectangle((0,wall-12,w,wall+26),fill='#ffcc73')
    d.line((0,wall+26,w,wall+26),fill='#e4ab54',width=3)
    for _ in range(380):
        x,y=r.randrange(8,w-8),r.randrange(12,h-10)
        on_road=y<len(left) and left[y][0]-3<=x<=right[y][0]+3
        if on_road and y<850:
            ellipse(d,x,y,r.randint(3,9),r.randint(1,3),fill=r.choice(['#efb65e','#f6c56f','#e9af57']))
        elif not any(left[row][0]-10 <= x <= right[row][0]+10
                     for row in range(max(0,y-10),min(len(left),y+11))) and (y<wall-18 or y>wall+32):
            if r.random()<.13:
                for ox,oy in [(0,-3),(3,0),(0,3),(-3,0)]:
                    ellipse(d,x+ox,y+oy,2.4,2.4,fill='#fff6d2')
                ellipse(d,x,y,1.8,1.8,fill='#e9ae4e')
            else:
                d.line([(x-5,y-5),(x,y),(x+3,y-8)],fill=r.choice(['#7a8d5b','#879662','#8d995f']),width=2)
    for x,y,k in [(63,180,1.28),(110,444,.68),(38,670,1.19),(w-115,159,1.4),
                  (w-78,534,.94),(w-45,808,1.50),(29,1290,.90),(w-22,1155,.90)]:
        valley_rocks(d,x,y,k)
    forest = [
        (-1, -18, -24, 163, 'lilac'), (-1, 54, 133, 173, 'pink'), (-1, 19, 294, 127, 'oak'),
        (-1, 8, 505, 169, 'lilac'), (-1, 89, 568, 112, 'pink'), (-1, 18, 761, 126, 'oak'),
        (1, 28, -52, 147, 'oak'), (1, 16, 170, 166, 'lilac'), (1, 86, 234, 130, 'oak'),
        (1, 31, 388, 184, 'pink'), (1, 23, 600, 151, 'pink'), (1, 125, 654, 118, 'lilac'),
        (-1, -9, 1131, 117, 'pink'), (1, -12, 1283, 123, 'lilac')
    ]
    for i,(side,edge,top_y,s,key) in enumerate(forest):
        cx=edge if side<0 else w-edge
        ellipse(d,cx,top_y+s*.87,s*.33,s*.092,fill='#87965c')
        tree=blossom_tree((s,s),key=='lilac',i+421) if key in ('pink','lilac') else art(key)
        centered(out,tree,(cx-s//2,top_y,cx+s//2,top_y+s),base=True)
    rgb=out.convert('RGB')
    pixels=rgb.load()
    minimum=100.0
    for j in range(first,last+1):
        y=round((j-top)*(wall/(gate-top)))
        row=min((j-first)//step,len(profile)-2); t=(j-profile[row][0])/step
        a,b=[profile[row][i]*(1-t)+profile[row+1][i]*t for i in (1,2)]
        start,end=round(a*ratio),round(b*ratio)
        def soil(x):
            red,green,blue=pixels[x,y]
            return red>125 and red-green>=13 and green-blue>=13
        if not all(soil(x) for x in range(start,end+1)):
            raise ValueError(f'road pixel breaks original corridor at reference y={j}: {[(x,pixels[x,y]) for x in range(start,end+1) if not soil(x)][:10]}')
        while start>0 and soil(start-1): start-=1
        while end<w-1 and soil(end+1): end+=1
        minimum=min(minimum,a-start/ratio,end/ratio-b)
    if minimum<1: raise ValueError(f'insufficient drawing margin: {minimum}')
    return rgb, {'roadRows':last-first+1,'minRoadMargin':round(minimum,2),'referenceWidth':720,
                 'referenceTop':top,'referenceGate':gate,'corridorSha256':digest(road)}


def render(asset,registration,actors):
    name=asset['id']; cat=asset['category']; size=(asset['width'],asset['height'])
    if cat in ('characters','enemies','enemy-parts'):
        return actors.render(asset)
    if cat=='building-parts':
        return building(asset,registration)
    if cat=='decorations':
        return decoration(asset,registration)
    if cat in ('ui/panels','ui/buttons'):
        return rounded_panel(name,size),artwork_hash_input()
    if cat=='ui/icons':
        if name in ('icon_population','icon_baby'):
            out=blank(size)
            if name=='icon_baby':
                img,master=actors.poses['baby']
                centered(out,img,(4,4,size[0]-4,size[1]-4))
            else:
                img,master=actors.poses['blue-down/idle']
                w,h=size
                centered(out,img,(3,5,round(w*.64),h-4),base=True)
                centered(out,actors.poses['red-down/idle'][0],(round(w*.38),7,w-3,h-4),base=True)
            return out,master
        if name.startswith('tag_'): return tag(name,size),artwork_hash_input()
        key=key_for_icon(name)
        return draw_on(asset,art(key),registration),source(key)
    if cat=='effects':
        if name=='fx_hearts':
            out=blank(size)
            centered(out,art('heart'),(5,16,size[0]-5,size[1]-5),base=True)
            return out,source('heart')
        return effect(name,size),artwork_hash_input()
    if cat=='terrain':
        img,proof=terrain(size)
        asset['provenance']['registration']=proof
        return img,None
    raise ValueError(name)


def write_branding(actors):
    original=Image.open(MASTERS/'simple/branding.png').convert('RGB')
    branding=ROOT/'branding'
    original.save(branding/'launcher-original.png')
    still=ImageOps.fit(original,(1024,1536),SCALE,centering=(.5,.36))
    still.save(ROOT.parent/'project/LayaProject/assets/resources/launcher.jpg',quality=87,optimize=True,subsampling=0)
    card=ImageOps.fit(original,(1000,800),SCALE,centering=(.5,.7))
    share=branding/'share'
    card.save(share/'village-share-original.png')
    card.resize((500,400),SCALE).save(share/'village-share.jpg',quality=88,optimize=True)
    dest=ROOT.parent/'project/LayaProject/build-templates/wxgame/share/village-share.jpg'
    dest.write_bytes((share/'village-share.jpg').read_bytes())
    icon=Image.new('RGBA',(512,512),'#9dcc45')
    d=ImageDraw.Draw(icon)
    ellipse(d,256,275,212,212,fill='#69972f',outline='#3c5b24',width=13)
    centered(icon,art('gate-body'),(53,30,459,386),base=True)
    centered(icon,actors.poses['blue-down/idle'][0],(94,254,282,507),base=True)
    centered(icon,actors.poses['red-down/idle'][0],(256,244,430,507),base=True)
    icon.save(branding/'icon_original.png')
    icon.resize((144,144),SCALE).save(branding/'app_icon_144.png')


def apply_motion_quality(recipe):
    quality=json.loads((SOURCE/'motion-quality.json').read_text())
    impact_sources=quality['impactSources']
    for a in recipe['assets']:
        if not a['runtime'] or a['category']!='effects':
            continue
        size=impact_sources.get(a['animation'] or a['id'])
        if size:
            a.update(width=size,height=size,pivot={'x':size//2,'y':size//2})
    for clip in recipe['animations']['animations']:
        name=clip['id']
        if name == 'fx_tower_stone_impact':
            clip['fps'] = 28
        elif name == 'fx_tower_frost_impact':
            clip['fps'] = 30
        size=impact_sources.get(name)
        if size:
            clip.update(canvas={'w':size,'h':size},pivot={'x':size//2,'y':size//2})
        if name.startswith('villager_') and '_walk_' in name:
            role=name.removeprefix('villager_').split('_walk_')[0]
            ratio=quality['childStride'] if role=='child' else quality['villagerStride']
            clip['stridePixels']=ratio*clip['canvas']['w']
        if clip['category']=='enemies':
            kind=clip['frameIds'][0].split('_walk_')[0].removeprefix('enemy_')
            clip['stridePixels']=quality['enemyStrides'][kind]*clip['canvas']['w']


def main():
    args=argparse.ArgumentParser()
    args.add_argument('--actors-only',action='store_true',help='Rebuild character drawings, their UI icons and effects')
    args.add_argument('--tower-impacts-only',action='store_true',help='Rebuild only the three tower hit sequences')
    args.add_argument('--gate-only',action='store_true',help='Rebuild the palisade frame and hinged leaves')
    args.add_argument('--flower-valley-only',action='store_true',help='Rebuild the flower-valley map and interface surfaces')
    args.add_argument('--ui-surfaces-only',action='store_true',help='Rebuild only the common interface surfaces')
    options=args.parse_args()
    surface_only=options.flower_valley_only or options.ui_surfaces_only
    limited=options.actors_only or options.tower_impacts_only or surface_only or options.gate_only
    if not options.tower_impacts_only and not options.ui_surfaces_only and not options.gate_only:
        register_boards()
    recipe=json.loads(RECIPE.read_text())
    apply_motion_quality(recipe)
    registration=json.loads((SOURCE/'registration.json').read_text())
    # The approved hit lettering is a standalone authored image, outside the cartoon contact sheets.
    active=[a for a in recipe['assets'] if a['runtime'] and a['id'] not in ('fx_patrol_bang', 'fx_patrol_uh')]
    if set(registration)!=set(a['id'] for a in active):
        raise ValueError('active recipe and geometry registration must match')
    RASTER.mkdir(exist_ok=True)
    actors=None if options.tower_impacts_only or surface_only or options.gate_only else SimpleActors(ROOT,MASTERS,chroma,registration)
    report=SOURCE/'render-report.json'
    proofs=json.loads(report.read_text()) if limited else {}
    count=0
    for a in active:
        if options.gate_only and a['id'] != 'motion_gate_body' and a['animation'] != 'motion_gate_doors':
            continue
        if surface_only and a['category'] not in ('ui/panels','ui/buttons') and not (options.flower_valley_only and a['category']=='terrain'):
            continue
        if options.tower_impacts_only and a['animation'] not in ('fx_impact_arrow', 'fx_tower_stone_impact', 'fx_tower_frost_impact'):
            continue
        if options.actors_only and a['category'] not in ('characters','enemies','enemy-parts','effects') and a['id'] not in ('icon_population','icon_baby'):
            continue
        if a['id'].startswith('panel_button_'):
            # A 52px curve and 3px clearance fit inside each fixed 60px slice.
            a['nineSlice'].update(top=60, bottom=60, left=60, right=60, scale=.72)
        image,master=render(a,registration,actors)
        assert image.size==(a['width'],a['height']) and image.getbbox(),a['id']
        f=RASTER/(a['id']+'.png')
        image.save(f)
        master=master or f
        path=f.relative_to(ROOT).as_posix()
        rect={'x':0,'y':0,'w':a['width'],'h':a['height']}
        a.update(sourceSheet=path,sourceRect=rect,sourceCropWithinCell=rect,resizeMode='stretch',fitPadding=0)
        if 'alphaCutoff' in a:
            del a['alphaCutoff']
        renderer = Path(__file__).with_name('cartoon_labor.py') if '_work_' in a['id'] else (
            Path(__file__).with_name('simple_actors.py') if a['category'] in ('characters','enemies','enemy-parts') else artwork_hash_input())
        a['provenance'].update(source=master.relative_to(ROOT).as_posix(),sourceHash=digest(master),outputHash=digest(f),renderer=renderer.relative_to(ROOT).as_posix())
        proofs[a['id']]={'sha256':digest(f),'master':a['provenance']['source'],'size':image.size}
        count+=1
    RECIPE.write_text(json.dumps(recipe,ensure_ascii=False,indent=2)+'\n')
    report.write_text(json.dumps(proofs,ensure_ascii=False,indent=2)+'\n')
    if not limited or options.actors_only:
        write_branding(actors)
    print(count,'rendered frames;',len(proofs),'registered runtime frames')


if __name__=='__main__':
    main()
