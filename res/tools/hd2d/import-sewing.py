"""Rebuild lightweight sewing layers from the approved workshop proof and six villager portraits."""
from pathlib import Path
from math import cos, sin, tau
import numpy as np
from PIL import Image, ImageDraw, ImageChops, ImageFilter

RES = Path(__file__).resolve().parents[2]
SOURCE = RES / "source/rendered2d/production/sewing-factory"
PARTS = SOURCE / "parts"
MASTER = SOURCE / "masters"
PORTRAITS = SOURCE.parent / "cartoon-v1/frames"
SIZE = 192
PROOF = 1254
PHASES = 8

def export(image, name, size=SIZE):
    image.resize((size, size), Image.Resampling.LANCZOS).save(PARTS / (name + ".png"))

def transparent_region(image, mask):
    result = image.copy()
    result.putalpha(ImageChops.multiply(image.getchannel("A"), mask))
    return result

def outline(size, coords):
    mask = Image.new("L", size)
    ImageDraw.Draw(mask).polygon(coords, fill=255)
    return mask

# Work in the proof's 400px framing. Split below the jaw; the cap of the thread spool
# belongs to the machine and stays visible above the worker's right shoulder.
neckline = [(0,0),(400,0),(400,154),(245,154),(240,168),(224,175),(198,183),
            (172,182),(151,177),(143,172),(130,168),(104,167),(0,167)]
head_mask = outline((400,400), neckline)
station = Image.open(MASTER / "station.png").convert("RGBA").resize((400,400),Image.Resampling.LANCZOS)
smile = Image.open(MASTER / "smile.png").convert("RGBA").resize((400,400),Image.Resampling.LANCZOS)
body = transparent_region(station, ImageChops.invert(head_mask))
export(transparent_region(station,head_mask),"sew_blue")
export(transparent_region(smile,head_mask),"sew_blue_smile")
# Portrait landmarks in a normalized 200px square: jaw edge, two eye centres,
# and the destination chin position. Clipping preserves each original hairstyle.
heads = {
  "straw": ([(0,0),(200,0),(200,93),(143,96),(132,102),(118,111),(102,116),(81,112),(72,104),(60,101),(44,94),(0,94)],(87,80,117,80),170),
  "red": ([(0,0),(200,0),(200,123),(136,122),(112,113),(100,117),(80,115),(71,119),(27,121),(0,120)],(90,87,120,87),189),
  "jade": ([(0,0),(200,0),(200,108),(141,111),(125,108),(116,114),(98,118),(78,114),(68,107),(59,111),(0,110)],(88,87,118,87),195),
  "elite_male": ([(0,0),(200,0),(200,94),(144,97),(129,101),(118,109),(100,113),(78,109),(72,105),(57,99),(0,96)],(86,78,116,78),164),
  "elite_female": ([(0,0),(200,0),(200,119),(139,116),(129,105),(116,109),(101,114),(85,109),(74,106),(57,115),(0,118)],(90,85,115,85),194),
}
for model,(poly,eyes,target_w) in heads.items():
    portrait = Image.open(PORTRAITS / ("portrait_hd_"+model+"_down_idle.png")).convert("RGBA")
    scaled = [(round(x*portrait.width/200),round(y*portrait.height/200)) for x,y in poly]
    clean = transparent_region(portrait,outline(portrait.size,scaled))
    bounds = clean.getbbox()
    for happy in (False,True):
        art = clean.copy()
        if happy:
            d = ImageDraw.Draw(art)
            for x,y in [eyes[:2],eyes[2:]]:
                unit=art.width/200
                box=lambda a,b,c,e: tuple(round(n*unit) for n in (a,b,c,e))
                skin=art.getpixel((round((x-6)*unit),round((y+2)*unit)))
                d.ellipse(box(x-5.3,y-6.1,x+5.3,y+7.1), fill=skin)
                d.arc(box(x-4.2,y-1,x+4.2,y+6.5),190,350,fill="#3f271a",width=round(1.7*unit))
        art=art.crop(bounds)
        h=round(target_w*art.height/art.width)
        art=art.resize((target_w,h),Image.Resampling.LANCZOS)
        frame=Image.new("RGBA",(400,400));frame.alpha_composite(art,(round(184-target_w/2),182-h))
        export(frame,"sew_"+model+("_smile" if happy else ""))

# Movement amplitudes and masks are the third approved proof, in its 1254px design space.
size=400
iy,ix=np.mgrid[:size,:size]
x=ix*PROOF/size;y=iy*PROOF/size
def band(v,a,b,f):
    a=np.clip((v-a)/f,0,1);b=np.clip((b-v)/f,0,1)
    return a*a*(3-2*a)*b*b*(3-2*b)
pedal=band(x,394,807,67)*band(y,900,1133,55)
arms=(band(x,397,553,41)+band(x,636,789,43))*band(y,641,786,39)
cloth=band(x,352,715,44)*band(y,750,933,44)
link=band(x,769,824,16)*band(y,966,1108,45)
needle=band(x,609,628,5)*band(y,681,746,16)
moving = Image.fromarray(np.uint8((pedal+arms+cloth+link+needle)>0)*255).filter(ImageFilter.MaxFilter(3))
export(transparent_region(body,ImageChops.invert(moving)),"sew_station")
src=np.asarray(body,dtype=float)
for i in range(PHASES):
    phase=tau*i/PHASES
    feed=sin(phase-.8)*25; press=cos(phase)*40
    xx=np.clip(ix-feed*size/PROOF*arms*np.where(x<610,-.37,.37),0,size-1.001)
    yy=np.clip(iy-size/PROOF*(press*(pedal+.48*link)+feed*(arms+.78*cloth)+sin(phase*4)*10*needle),0,size-1.001)
    xi=xx.astype(int);yi=yy.astype(int);dx=(xx-xi)[:,:,None];dy=(yy-yi)[:,:,None]
    image=(src[yi,xi]*(1-dx)+src[yi,xi+1]*dx)*(1-dy)+(src[yi+1,xi]*(1-dx)+src[yi+1,xi+1]*dx)*dy
    export(transparent_region(Image.fromarray(image.round().astype('uint8')),moving),"sew_motion_"+str(i))
# Circular spokes rotate under a nonuniform parent; the outside rim remains on the source station.
side=256; wheel=Image.new("RGBA",(side,side));draw=ImageDraw.Draw(wheel)
draw.ellipse((2,2,254,254),fill="#3b2315")
def pt(x,y,a):
    return ((1+x*cos(a)-y*sin(a))*128,(1+x*sin(a)+y*cos(a))*128)
for i in range(9):
    a=tau*i/9
    draw.polygon([pt(x,y,a) for x,y in [(.37,-.062),(.90,-.089),(.90,.089),(.37,.062)]], fill="#fff0b6" if i==0 else "#e7ad55")
draw.ellipse((214,117,239,139),fill="#f9873d",outline="#6f3a1d",width=3)
draw.ellipse((87,87,169,169),fill="#edb45d",outline="#75451f",width=4)
draw.ellipse((100,106,132,123),fill="#ffda91")
export(wheel,"sew_wheel",48)

# Editable source for the currency artwork, matching the gold, inset and character from the proof.
coin=Image.new("RGBA",(384,384));d=ImageDraw.Draw(coin)
d.ellipse((22,31,368,375),fill="#b87024",outline="#69351c",width=12)
d.ellipse((15,12,363,359),fill="#ffca50",outline="#753f22",width=11)
d.ellipse((53,48,326,321),fill="#ffe18a",outline="#c07b2a",width=8)
d.arc((34,31,346,341),215,280,fill="#fff5c1",width=15)
# The glyph master is checked in so rebuilding never depends on a system font.
glyph=Image.open(MASTER/"coin-glyph.png").convert("RGBA")
coin.alpha_composite(glyph,((coin.width-glyph.width)//2,(coin.height-glyph.height)//2-6))
export(coin,"icon_coin",96)
