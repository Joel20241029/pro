"""Four side-view work poses with a jointed arm and an attached tool."""
import math
from PIL import Image, ImageDraw, ImageChops
# Shoulder, inactive palm and sleeve width registered on each adult's source work canvas.
HAND = {
 "blue-right": ((68,81),(68,96),15,"#366aa5"), "blue-left": ((76,81),(75,96),15,"#366aa5"),
 "straw-right": ((83,90),(83,108),22,"#db902c"), "straw-left": ((86,90),(86,108),22,"#db902c"),
 "red-right": ((77,82),(77,96),16,"#a83930"), "red-left": ((75,83),(75,96),16,"#a83930"),
 "jade-right": ((87,89),(87,106),17,"#53916d"), "jade-left": ((83,91),(83,109),17,"#53916d"),
 "elite_male-right": ((88,90),(88,105),17,"#8b4c27"), "elite_male-left": ((83,90),(82,106),17,"#8b4c27"),
 "elite_female-right": ((81,82),(81,96),16,"#743653"), "elite_female-left": ((66,82),(66,94),16,"#743653"),
}
MOTION = [(12,-8,-.84),(16,-4,-.58),(17,10,.07),(10,18,.34)]
INK='#382315'
SKIN='#f5bc8a'

def render(base,key,index):
    shoulder,palm,wide,palette=HAND[key]
    facing=1 if key.endswith('-right') else -1
    arm_x,arm_y,angle=MOTION[index]
    sx,sy=shoulder
    wrist=(sx+facing*arm_x,sy+arm_y)
    dx=wrist[0]-sx;dy=wrist[1]-sy
    length=math.hypot(dx,dy)
    # Equal bone lengths keep both arcs consistent. The elbow always bends toward the ground.
    bend=math.sqrt(max(0,15**2-(length/2)**2))
    elbow=(sx+dx*.5-dy/length*facing*bend,sy+dy*.5+dx/length*facing*bend)
    hx,hy=wrist
    c=math.cos(angle);s=math.sin(angle)
    shaft=28
    tip=(hx+facing*c*shaft,hy+s*shaft)
    near=(hx-facing*c*4,hy-s*4)

    # Cover the flattened idle palm with the tunic beneath the moving foreground arm.
    body=base.copy()
    mask=Image.new('L',body.size)
    md=ImageDraw.Draw(mask)
    px,py=palm
    md.polygon([(sx-wide*.47,sy-1),(sx+wide*.48,sy-1),(px+wide*.62,py-6),(px+wide*.61,py+7),
        (px-wide*.61,py+7),(px-wide*.61,py-6)],fill=255)
    mask=ImageChops.multiply(mask,body.getchannel('A'))
    cloth=Image.new('RGBA',body.size,palette);cloth.putalpha(mask)
    body.alpha_composite(cloth)

    ss=3; layer=Image.new('RGBA',(body.width*ss,body.height*ss)); d=ImageDraw.Draw(layer)
    def xy(p):return tuple(round(n*ss) for n in p)
    def line(points,fill,w):d.line([xy(p) for p in points],fill=fill,width=round(w*ss),joint='curve')
    def circle(p,r,fill):
        x,y=p;d.ellipse([xy((x-r,y-r)),xy((x+r,y+r))],fill)
    def stroke(points,color,width,outline=4):
        for ink,w in [(INK,width+outline),(color,width)]:
            line(points,ink,w)
            for point in points:circle(point,w/2,ink)
    # Upper sleeve follows the true shoulder–elbow arc; cuff and exposed forearm follow the wrist.
    cuff=(elbow[0]+(hx-elbow[0])*.16,elbow[1]+(hy-elbow[1])*.16)
    stroke([shoulder,elbow,cuff],palette,wide*.61)
    cuffA=(elbow[0]+(hx-elbow[0])*.08,elbow[1]+(hy-elbow[1])*.08)
    stroke([cuffA,cuff], '#e9d4a4',wide*.5,2)
    fore=(elbow[0]+(hx-elbow[0])*.19,elbow[1]+(hy-elbow[1])*.19)
    stroke([fore,wrist],SKIN,7,3)
    stroke([near,tip],'#ad6d36',3,3)
    tx,ty=tip
    d.polygon([xy((tx-facing*4, ty-5)),xy((tx+facing*11,ty-9)),xy((tx+facing*10,ty+4)),xy((tx,ty+7))],fill='#b8d8db',outline=INK,width=2*ss)
    circle(wrist,5.3,INK);circle(wrist,3.9,SKIN)
    line([(hx-facing*.9,hy-2),(hx+facing*2,hy-1)],'#ffe0ac',1.1)
    body.alpha_composite(layer.resize(body.size,Image.Resampling.LANCZOS))
    return body
