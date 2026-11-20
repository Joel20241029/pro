"""Bake the approved stone dust and frost shards as tightly sized transparent frames."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import math as m
import random

# Design space represents a 208-unit display effect. Only 48px frames ship.
W = H = 208
S = 2
TAU = m.tau
SIZE = 48
FRAME_COUNT = 8
FPS = 16

def clamp(t):return max(0,min(1,t))
def color(c,a=1):return (*c,round(255*clamp(a)))
def coords(p):return tuple(round(v*S) for v in p)
def poly(layer,p,fill):ImageDraw.Draw(layer).polygon([coords(x) for x in p],fill=fill)
def ellipse(layer,box,fill=None,outline=None,width=1):
    ImageDraw.Draw(layer).ellipse(coords(box),fill=fill,outline=outline,width=max(1,round(width*S)))
def stroke(layer,p,c,width=1):
    ImageDraw.Draw(layer).line([coords(i) for i in p],fill=c,width=max(1,round(width*S)),joint='curve')
def arc(layer,x,y,r,ry,a0,a1,c,width):
    ImageDraw.Draw(layer).arc(coords((x-r,y-ry,x+r,y+ry)),a0,a1,fill=c,width=max(1,round(width*S)))
def blank():return Image.new('RGBA',(W*S,H*S))
def aura(layer,x,y,rx,ry,hue,amount):
    fx=blank()
    ellipse(fx,(x-rx,y-ry,x+rx,y+ry),color(hue,amount))
    layer.alpha_composite(fx.filter(ImageFilter.GaussianBlur(min(rx,ry)*.45*S)))
def spark(layer,x,y,angle,r,c):
    u=(m.cos(angle),m.sin(angle));v=(-u[1],u[0])
    poly(layer,[(x+u[0]*r,y+u[1]*r),(x+v[0]*r*.19,y+v[1]*r*.19),(x-u[0]*r*.6,y-u[1]*r*.6),(x-v[0]*r*.19,y-v[1]*r*.19)],c)
def stone_effect(layer,x,foot,age,back=False):
    if not (0<=age<=.52):return
    u=age/.52
    ry=9+30*(1-(1-u)**2)
    r=10+87*(1-(1-u)**2)
    remain=(1-u)**1.4
    if back:
        aura(layer,x,foot-2,r*.73,ry*1.2,(255,181,77),.53*remain)
        stretch=clamp(u*3.4)
        for k in range(5):
            a=k*TAU/5+.39
            dx,dy=m.cos(a),m.sin(a)*.42
            length=(35+k%3*8)*stretch
            path=[(x+dx*length*n-dy*j,foot+dy*length*n+dx*j) for n,j in ((0,0),(.38,1.75),(.62,-1),(.84,1.5),(1,0))]
            stroke(layer,path,color((79,46,28),.78*remain),1.8)
            stroke(layer,[(px,py+.8) for px,py in path],color((255,209,135),.59*remain),.9)
            end=path[2]
            stroke(layer,[end,(end[0]+dx*length*.19-dy*4,end[1]+dy*length*.19+dx*4)],color((100,60,40),.57*remain),1.2)
        for i in range(8):
            a=TAU*i/8+.15
            q=(5+u*72)*(1+ .09*m.cos(i*4))
            cx=x+m.cos(a)*q
            cy=foot+m.sin(a)*(.36*q)
            aura(layer,cx,cy,4+u*13,3+u*9,(232,191,128),.33*remain)
        for i in range(4):
            arc(layer,x,foot,r,ry,16+i*90,76+i*90,color((255,216,132),.91*remain),5-2.4*u)
            arc(layer,x,foot,r*.79,ry*.79,30+i*90,68+i*90,color((144,87,42),.7*remain),1.25)
        return
    if age<.22:
        q=1-age/.22
        aura(layer,x,foot-19,28+u*17,21,(255,167,58),.77*q)
        for i in range(8):
            spark(layer,x+m.cos(i*TAU/8)*12,foot-20+m.sin(i*TAU/8)*9,i*TAU/8,(8+i%3*3)*q+2,color((255,239,172),.97*q))
    rng=random.Random(97)
    for i in range(18):
        a=i*TAU/18+rng.uniform(-.30,.30)
        speed=rng.uniform(47,102)
        reach=speed*(1-(1-u)**1.42)
        rx=x+m.cos(a)*reach
        ry=foot-22+m.sin(a)*reach*.55-m.sin(u*m.pi)*rng.uniform(6,38)
        size=rng.uniform(1.3,4.5)*(1-.35*u)
        if i<12:
            poly(layer,[(rx-size,ry-.2*size),(rx-.3*size,ry-size),(rx+1.1*size,ry-.4*size),(rx+.4*size,ry+size)],color((123,93,70),.98*remain))
            poly(layer,[(rx-size,ry-.2*size),(rx-.3*size,ry-size),(rx+1.1*size,ry-.4*size),(rx-.2*size,ry+.2*size)],color((235,206,150),.93*remain))
        else:
            spark(layer,rx,ry,a,4+4*remain,color((255,190,77),.95*remain))

def ice_effect(layer,x,y,age,back=False):
    if not (0<=age<=.56):return
    u=age/.56
    r=8+84*(1-(1-u)**2)
    a=(1-u)**1.42
    if back:
        aura(layer,x,y-4,31+u*45,23+u*23,(68,176,248),.39*a)
        for i in range(3):
            start=22+i*120-18*u
            arc(layer,x,y+17,r,8+r*.28,start,start+75,color((106,213,247),.91*a),3.3-1.6*u)
            arc(layer,x,y+17,r-3,5+r*.26,start+8,start+55,color((235,252,255),a),1)
        return
    early=clamp(1-age/.19)
    if early:
        aura(layer,x,y,24+u*15,21+u*10,(178,229,255),.64*early)
        for i in range(6):
            angle=i*TAU/6
            spark(layer,x+m.cos(angle)*7,y+m.sin(angle)*7,angle,5+23*early,color((237,252,255),.98*early))
    for i in range(14):
        angle=i*TAU/14+.19*m.sin(i*8)
        dx,dy=m.cos(angle),m.sin(angle)
        reach=(28+i%5*10)*m.sin(u*m.pi*.58)
        xx=x+dx*reach; yy=y+dy*reach*.84-11*u
        length=(7+i%4*2.8)*(1-.53*u)
        side=(length*.26)
        tip=(xx+dx*length,yy+dy*length)
        ul=(xx-dy*side,yy+dx*side)
        ur=(xx+dy*side,yy-dx*side)
        tail=(xx-dx*length*.56,yy-dy*length*.56)
        poly(layer,[tip,ul,tail,ur],color((78,178,238),a))
        poly(layer,[tip,ul,(xx,yy),ur],color((218,249,255),a))
        if i%3==1:spark(layer,xx+dy*8,yy-dx*8,angle,2.4,color((226,250,255),a))
    for i in range(5):
        angle=i*TAU/5+u
        xx=x+m.cos(angle)*(29+58*u)
        yy=y+16+m.sin(angle)*(9+17*u)-u*15
        spark(layer,xx,yy,angle,3.3,color((171,229,255),.85*a))


def main():
    output = Path(__file__).resolve().parents[2] / 'source/rendered2d/production/effects/tower-impact'
    output.mkdir(parents=True, exist_ok=True)
    for name, draw in (('stone', stone_effect), ('frost', ice_effect)):
        for index in range(FRAME_COUNT):
            frame, front = blank(), blank()
            age = (index + .4) / FPS
            draw(frame, W / 2, H / 2, age, True)
            draw(front, W / 2, H / 2, age)
            frame.alpha_composite(front)
            image = frame.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
            assert image.getbbox(), (name, index)
            image.save(output / f'fx_tower_{name}_impact_{index + 1}.png', optimize=True)

if __name__ == '__main__':
    main()
