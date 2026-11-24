"""Render transparent local clips from the approved master sheet. Each clip has its own cropped canvas."""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter
import json
import math

ROOT = Path(__file__).resolve().parents[2] / 'source/rendered2d/production/building-motion'
sheet = Image.open(ROOT / 'approved-sheet.png').convert('RGBA')
# Art boxes, ordered as the three towers, gate, house, farm, workshop, patrol booth and hearth.
boxes = [(82,18,388,419),(478,13,799,414),(948,12,1185,419),(14,447,421,787),
         (435,438,831,785),(844,460,1257,786),(15,840,420,1201),(448,820,806,1212),(922,895,1231,1183)]
sizes = [(98,125),(99,115),(90,119),(133,107),(108,112),(105,86),(109,101),(104,105),(86,76)]
kinds = ['arrow','stone','slow','gate','house','farm','logging','patrol','hearth']
# Existing layer rectangles are in Laya logical pixels; only raster density increases.
layers = json.loads((ROOT / 'layers.json').read_text())
clips = {clip['id']: clip for layer in layers.values() for clip in layer['clips']}
RASTER_SCALE = 4
TEXTURE_SCALE = 1.25

def pixel(value):
    return round(value * RASTER_SCALE)

def polygon(draw, points, **kwargs):
    draw.polygon([(pixel(x), pixel(y)) for x,y in points], **kwargs)

def save_texture(image, id, rect):
    left, top, right, bottom = rect
    size = (math.floor((right-left)*TEXTURE_SCALE+.5), math.floor((bottom-top)*TEXTURE_SCALE+.5))
    image.resize(size, Image.Resampling.LANCZOS, box=tuple(map(pixel, rect))).save(ROOT / (id + '.png'))

def layer_rect(layer):
    x, y = layer['x'] + 32, layer['y'] + 48
    return x, y, x + layer['w'], y + layer['h']

def blank():
    return Image.new('RGBA', (pixel(192),pixel(192)))

def add(sprite, where, angle=0, stretch=(1,1)):
    if stretch != (1,1):
        sprite = sprite.resize(tuple(max(1,round(s*f)) for s,f in zip(sprite.size,stretch)),Image.Resampling.BICUBIC)
    if angle:
        sprite = sprite.rotate(angle, Image.Resampling.BICUBIC, expand=True)
    dst = blank()
    dst.alpha_composite(sprite,tuple(round(pixel(x)-d/2) for x,d in zip(where,sprite.size)))
    return dst

def clip(id, frames, fps, attack=False, rest=None):
    if rest is not None:
        frames = [*frames, rest]
    layout = clips[id]
    ids = [*layout['frames'], layout['rest']] if rest is not None else layout['frames']
    assert len(ids) == len(frames) and layout['fps'] == fps and layout['attack'] == attack, id
    for key, frame in zip(ids, frames):
        save_texture(frame, key, layer_rect(layout))

def fx(pt, radius, rgb, power):
    img = blank()
    d = ImageDraw.Draw(img)
    x,y = pt
    for f in (1,.75,.5,.25):
        r = radius*f
        d.ellipse(tuple(map(pixel, (x-r,y-r*.68,x+r,y+r*.68))),fill=(*rgb,round(150*power*(1-.7*f))))
    return img.filter(ImageFilter.GaussianBlur(pixel(radius*.16)))

def embers(img, pt, phase, color, count, spread, height):
    for i in range(count):
        q = (phase+i/count)%1
        x = pt[0]+math.sin(i*6.8)*spread*q
        y = pt[1]-height*q
        opacity = round(184*math.sin(math.pi*q))
        r = 1.6-q
        ImageDraw.Draw(img).ellipse(tuple(map(pixel, (x-r,y-r,x+r,y+r))),fill=(*color,opacity))

def flame(pt, phase, scale):
    x,y=pt
    img=fx((x,y-4*scale),11*scale,(255,156,60),.49)
    d=ImageDraw.Draw(img)
    for j,col in enumerate(((222,72,17,239),(255,155,30,255),(255,225,113,255),(255,252,188,255))):
        wiggle=math.sin(phase*math.tau+j*.7)
        h=(20-3.5*j+3*wiggle)*scale
        w=(7-j*1.15)*scale
        points=[(x-w,y),(x-w*.9,y-h*.38),(x-w*.37,y-h*.58),(x+w*.44*wiggle,y-h),
                (x+w*.31,y-h*.6),(x+w*.87,y-h*.36),(x+w,y),(x,y+2*scale)]
        polygon(d,points,fill=col)
    embers(img,pt,phase,(255,184,64),6,12*scale,34*scale)
    return img

for i,kind in enumerate(kinds):
    # The current palisade and its hinged leaves are rendered by render-cartoon.py.
    if kind == 'gate':
        continue
    box=boxes[i]
    master = sheet.crop(box)
    guide = master.copy()
    guide.thumbnail(sizes[i], Image.Resampling.LANCZOS)
    width, height = guide.size
    # Keep the approved placement and hinge geometry while sampling the original artwork at raster resolution.
    left, top = 96-width//2, 168-height
    def loc(x,y):
        return (round(left+(x-box[0])*width/(box[2]-box[0])),round(top+(y-box[1])*height/(box[3]-box[1])))
    base=blank()
    art = master.resize((pixel(width), pixel(height)), Image.Resampling.LANCZOS)
    base.alpha_composite(art,(pixel(left),pixel(top)))
    full=base.copy()
    def separate(polygon):
        mask=Image.new('L',base.size)
        ImageDraw.Draw(mask).polygon([tuple(map(pixel, loc(*p))) for p in polygon],fill=255)
        layer=base.copy()
        alpha=base.getchannel('A')
        layer.putalpha(ImageChops.multiply(alpha,mask))
        base.putalpha(ImageChops.multiply(alpha,ImageChops.invert(mask)))
        cut=layer.getbbox()
        return layer.crop(cut),tuple(point / RASTER_SCALE for point in cut)

    def angular(sprite, cut, hinge, degrees, dy=0, sx=1):
        ang=math.radians(degrees)
        x,y=(cut[0]+cut[2])/2-hinge[0],(cut[1]+cut[3])/2-hinge[1]
        return add(sprite,(hinge[0]+x*math.cos(ang)+y*math.sin(ang),hinge[1]-x*math.sin(ang)+y*math.cos(ang)+dy),degrees,(sx,1))

    if i < 3:
        poly=[[(121,127),(128,94),(159,84),(176,55),(175,21),(250,17),(315,19),(345,23),(388,18),(380,54),(354,65),(358,123),(340,156),(314,160),(310,133),(268,109),(196,133),(158,149),(128,146)],
              [(630,97),(653,83),(692,66),(702,47),(696,30),(709,13),(791,13),(787,49),(775,75),(739,79),(712,98),(680,120),(651,115)],
              [(1057,12),(1088,46),(1102,72),(1080,108),(1055,135),(1028,108),(1010,73),(1028,41)]][i]
        hinge=loc(*[(150,122),(675,102),(1057,75)][i])
        muzzle=loc(*[(351,40),(740,35),(1057,75)][i])
        sprite,cut=separate(poly)
        angles=[[-8,-17,-9,5,9,3,-2,0],[36,51,40,22,5,-13,-8,0],[8,17,-4,-13,-8,4,2,0]][i]
        travel=[[0,5,5,3,1,0,0,0],[0]*8,[-13,-16,-13,-8,1,4,1,0]][i]
        power=[1,.75,.62,.49,.36,.25,.14,.06]
        frames=[]
        for j,angle in enumerate(angles):
            frame=angular(sprite,cut,hinge,angle,travel[j])
            x,y=muzzle
            color=((252,180,66),(233,168,104),(99,211,255))[i]
            light=fx((x,y+travel[j]),[12,12,22][i]+j,color,power[j])
            if i==2:
                for n in range(6):
                    a=n*math.tau/6+j*.14
                    d=10+j*2
                    px=x+math.cos(a)*d
                    py=y+math.sin(a)*d*.62
                    polygon(ImageDraw.Draw(light),[(px,py-4),(px+2,py),(px,py+3),(px-2,py)],fill=(192,248,255,round(224*power[j])))
            elif i==1:
                embers(light,hinge,j/9,color,7,17,13)
            frame.alpha_composite(light)
            frames.append(frame)
        idle=angular(sprite,cut,hinge,0)
        if i==2:
            clip('motion_slow_idle',[angular(sprite,cut,hinge,0,round(4*math.sin(k*math.tau/10))) for k in range(10)],6)
        clip('motion_'+kind+'_attack',frames,18,True,idle)
    if i==4:
        smoke=[]
        for k in range(10):
            img=blank()
            x,y=loc(751,452)
            for j in range(5):
                u=(k/10+j/5)%1
                mist=fx((x+u*11,y-u*20),2+u*5,(225,223,205),.64*math.sin(math.pi*u))
                img.alpha_composite(mist)
            img.alpha_composite(fx(loc(672,652),7,(255,174,57),.33+.26*math.sin(k*math.tau/10)))
            smoke.append(img)
        # Windows and chimney are stored as two clips so empty facade area never enters the frames.
        clip('motion_house_smoke',smoke,8)
        clip('motion_house_window',[fx(loc(672,652),7,(255,174,57),.43+.27*math.sin(k*math.tau/8)) for k in range(8)],5)
    if i in (5,6,7):
        components={
            5:[('wheat',[(920,522),(933,499),(953,483),(993,471),(1044,465),(1069,474),(1083,497),(1076,529),(1058,545),(1033,567),(1015,572),(981,558),(955,548),(935,539)],(1003,557),4)],
            6:[('saw',[(222,1106),(226,1080),(242,1061),(258,1051),(281,1053),(294,1073),(296,1090),(277,1090),(270,1100),(253,1110)],(265,1100),5)],
            7:[('lantern',[(756,966),(776,968),(778,977),(798,996),(803,1018),(784,1043),(775,1048),(772,1099),(757,1098),(756,1045),(733,1031),(728,1008),(741,987),(757,976)],(768,971),13),
               ('streamer',[(552,971),(567,988),(565,1019),(551,1049),(533,1071),(490,1069),(470,1054),(466,1035),(449,1009),(463,1000),(511,992),(540,980)],(550,979),9)]
        }[i]
        for name,poly,h,amplitude in components:
            spr,cut=separate(poly)
            frames=[angular(spr,cut,loc(*h),amplitude*math.sin(k*math.tau/8)) for k in range(8)]
            if i==6:
                for k,frm in enumerate(frames):
                    embers(frm,loc(269,1084),k/8,(226,173,81),7,13,10)
            if name=='lantern':
                for k,frm in enumerate(frames): frm.alpha_composite(fx(loc(769,1011),10,(250,130,145),.12+.32*math.sin(k*math.pi/7)))
            clip('motion_'+kind+'_'+name,frames,12 if i==6 else 7)
        if i==5:
            wheel_art, wheel_cut = separate([(1096,715),(1101,674),(1119,646),(1153,620),(1190,621),(1221,645),(1232,678),(1225,732),(1201,752),(1125,760),(1115,742)])
            wheel = layers[kind]['wheel']
            wheel_layer = blank()
            wheel_layer.alpha_composite(wheel_art, tuple(map(pixel, wheel_cut[:2])))
            save_texture(wheel_layer, wheel['id'], layer_rect(wheel))
            x,y=loc(1174,685)
            frames=[]
            for k in range(8):
                frame=blank()
                d=ImageDraw.Draw(frame)
                for n in range(6):
                    a=(k/8+n/6)*math.tau
                    d.line(tuple(map(pixel, (x+math.cos(a)*2,y+math.sin(a)*4,x+math.cos(a)*6,y+math.sin(a)*11))),fill=(208,144,77,195),width=RASTER_SCALE)
                wx,wy=loc(1125,727)
                for n in range(4):
                    q=(k/8+n/4)%1
                    d.line(tuple(map(pixel, (wx-3*q,wy+q*7,wx-3*q,wy+q*7+2))),fill=(161,222,228,round(230*math.sin(math.pi*q))),width=RASTER_SCALE)
                frames.append(frame)
            clip('motion_farm_wheel',frames,10)
    if i==8:
        sprite,cut=separate([(1047,896),(1082,898),(1113,946),(1122,981),(1112,1025),(1088,1052),(1045,1052),(1020,1038),(1007,1013),(1015,970),(1032,951)])
        frames=[]
        for k in range(10):
            f=angular(sprite,cut,loc(1067,1035),5*math.sin(k*math.tau/10),round(2*math.sin(k*math.tau/10)),1+.1*math.sin(k*math.tau/10))
            f.alpha_composite(flame(loc(1067,1041),k/10,.58))
            frames.append(f)
        clip('motion_hearth_flame',frames,13)
    body = layers[kind]['body']
    save_texture(base, body['id'], layer_rect(body))
    if i == 7:
        a,b,c,d = guide.getbbox()
        save_texture(full, 'motion_patrol_icon', (left+a,top+b,left+c,top+d))
