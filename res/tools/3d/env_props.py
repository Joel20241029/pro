"""Reusable real-mesh forest, ground and village decorations."""
import math
from env_common import empty, box, rod, cylinder, ellipsoid, mesh, stone_ring, MATS
import bpy


def pine(root):
    body=empty('Body',root)
    cylinder('Trunk',(0,0,.57),.13,1.14,'WoodHoney',body,8)
    for k,(z,r) in enumerate([(.50,.65),(.92,.52),(1.28,.39),(1.57,.25)]):
        n=9;vs=[]
        for radius,height in [(r,z),(r*.85,z+.11),(r*.48,z+.38),(.025,z+.67)]:
            vs.extend([(radius*math.cos(i*math.tau/n),radius*math.sin(i*math.tau/n),height+(.03 if i%2 else 0)) for i in range(n)])
        fs=[]
        for j in range(3):
            for i in range(n):fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
        fs.extend([tuple(reversed(range(n))),tuple(range(3*n,4*n))])
        o=mesh('RoundedNeedleTier',vs,fs,'LeafDark' if k%2==0 else 'Leaf',body)
        for p in o.data.polygons:p.use_smooth=True
    for i,p in enumerate([(-.35,-.35,.85),(.25,-.40,1.21),(-.16,-.22,1.58)]):empty('DecorationSocket'+str(i),root,p)


def fruit(root):
    body=empty('Body',root)
    # Unit prop; runtime scales/instances onto DecorationSockets.
    ellipsoid('Apple',(0,0,0),(.11,.10,.11),'Apple',body,8,5)
    rod('Stem',(0,0,.09),(.015,0,.17),.015,'WoodDark',body)
    mesh('Leaf',[(0,0,.13),(.07,.015,.18),(.11,0,.16),(.06,-.025,.13)],[(0,1,2),(0,2,3)],'LeafLight',body)


def flower(root):
    body=empty('Body',root)
    for i in range(5):
        a=i*math.tau/5
        ellipsoid('Petal',(.066*math.cos(a),.066*math.sin(a),.014),(.055,.055,.025),'Petal',body,6,4)
    ellipsoid('Pollen',(0,0,.035),(.037,.037,.025),'Grain',body,6,4)


def grass(root):
    body=empty('Body',root)
    for i in range(7):
        a=i*2.4;x=.08*math.cos(a);y=.08*math.sin(a);h=.14+(i%3)*.05
        # Three-sided folded blade reads from every view, not a camera-facing card.
        vs=[(x-.025,y,0),(x+.025,y,0),(x,y+.023,0),(x+.055*math.cos(a),y+.055*math.sin(a),h)]
        mesh('GrassBlade',vs,[(0,1,3),(1,2,3),(2,0,3)],'LeafLight' if i%2 else 'Grass',body)


def rock(root):
    body=empty('Body',root)
    for i,(x,y,z,s) in enumerate([(0,0,.16,.30),(.24,.09,.08,.16),(-.20,-.07,.06,.13)]):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1)
        o=bpy.context.object;o.name='RiverStone';o.parent=body;o.location=(x,y,z);o.scale=(s,s*.8,s*.66);o.data.materials.append(MATS['StoneLight' if i else 'Stone'])


def wall(root):
    body=empty('Body',root)
    for x in [-.75,0,.75]:
        box('Post',(x,0,.42),(.16,.18,.84),'WoodHoney',body)
        mesh('PointedCap',[(x-.08,-.09,.84),(x+.08,-.09,.84),(x+.08,.09,.84),(x-.08,.09,.84),(x,0,.98)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],'WoodLight',body)
        box('StoneFoot',(x,0,.09),(.22,.24,.18),'Stone',body)
    for z in [.22,.54]:box('HorizontalRail',(0,.025,z),(1.65,.10,.13),'WoodLight',body)
    for x in [-.57,-.38,-.19,.19,.38,.57]:box('Picket',(x,-.015,.41),(.13,.09,.60),'WoodHoney',body,.018)
    empty('AttachLeft',root,(-.82,0,0));empty('AttachRight',root,(.82,0,0))


def sign(root):
    body=empty('Body',root)
    for x in [-.35,.35]:box('SignPost',(x,0,.40),(.095,.10,.80),'WoodDark',body)
    box('SignBoard',(0,-.035,.66),(.98,.12,.40),'WoodHoney',body,.05)
    for z in [.49,.83]:box('Frame',(0,-.108,z),(.92,.035,.045),'WoodLight',body,.01)
    for x in [-.43,.43]:box('Frame',(x,-.108,.66),(.045,.035,.29),'WoodLight',body,.01)
    empty('TextAnchor',root,(0,-.115,.66))


def campfire(root):
    body=empty('Body',root)
    for i in range(8):
        a=i*math.tau/8;ellipsoid('FireRingStone',(.38*math.cos(a),.38*math.sin(a),.09),(.13,.12,.11),'Stone' if i%2 else 'StoneLight',body,8,5)
    for a in [.3,2.4,4.5]:rod('CharredLog',(-.30*math.cos(a),-.30*math.sin(a),.10),(.30*math.cos(a),.30*math.sin(a),.15),.07,'WoodDark',body)
    flame=empty('Flame',root,(0,0,.15))
    for x,y,h,r,mat in [(0,0,.57,.18,'FireOrange'),(-.13,0,.36,.11,'FireOrange'),(.10,.05,.43,.10,'FireYellow'),(0,-.10,.28,.12,'FireYellow')]:
        n=6;vs=[]
        for radius,z in [(r,.0),(r*.85,h*.4),(r*.38,h*.76),(0,h)]:
            vs.extend([(x+radius*math.cos(i*math.tau/n)+(z/h)**2*.07,y+radius*math.sin(i*math.tau/n),z) for i in range(n)])
        fs=[]
        for j in range(3):
            for i in range(n):fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
        mesh('FlameTongue',vs,fs,mat,flame)


def torch(root):
    body=empty('Body',root);box('TorchPost',(0,0,.40),(.09,.09,.8),'WoodHoney',body)
    cylinder('Brazier',(0,0,.78),.14,.14,'Iron',body,8)
    mesh('TorchFlame',[(-.10,-.07,.84),(.10,-.07,.84),(.10,.07,.84),(-.10,.07,.84),(.04,0,1.16)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],'FireOrange',body)


def path(root):
    body=empty('Body',root)
    # Repeatable two-metre section; actual gameplay PATH remains the sole spline.
    box('EarthPath',(0,0,-.015),(1.6,2,.035),'Path',body,.025)
    for i,(x,y) in enumerate([(-.66,-.72),(.65,-.30),(-.68,.37),(.66,.78)]):
        ellipsoid('EdgePebble',(x,y,.02),(.07,.10,.035),'StoneLight',body,6,4)
    empty('PathStart',root,(0,-1,0));empty('PathEnd',root,(0,1,0))


def pad(root):
    """Low ring with a genuinely empty centre, reserved for an unbuilt tower."""
    body=empty('Body',root)
    templates={}
    for i in range(9):
        a=i*math.tau/9;mat='StoneLight' if i%3 else 'Stone'
        if mat not in templates:
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1)
            o=bpy.context.object;o.data.materials.append(MATS[mat]);templates[mat]=o.data
            for face in o.data.polygons:face.use_smooth=True
        else:
            o=bpy.data.objects.new('RingStone',templates[mat]);bpy.context.collection.objects.link(o)
        o.name='RingStone';o.parent=body;o.location=(.38*math.cos(a),.38*math.sin(a),.065)
        o.scale=(.125,.105,.065);o.rotation_euler.z=a+math.pi/2


def log_pile(root):
    """Five real cylinders, with lighter end-grain caps and an open woodpile profile."""
    body=empty('Body',root);template=None
    for y,z in [(-.22,.105),(0,.105),(.22,.105),(-.11,.285),(.11,.285)]:
        if template is None:
            bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=.10,depth=.85)
            o=bpy.context.object;o.data.materials.append(MATS['WoodHoney']);o.data.materials.append(MATS['EndGrain'])
            for face in o.data.polygons:
                face.material_index=1 if abs(face.normal.z)>.8 else 0
                face.use_smooth=abs(face.normal.z)<.8
            template=o.data
        else:
            o=bpy.data.objects.new('StackedTimber',template);bpy.context.collection.objects.link(o)
        o.name='StackedTimber';o.parent=body;o.location=(0,y,z);o.rotation_euler.y=math.pi/2


def bush(root):
    """Three low rounded foliage clusters; distinct from the thin grass prop."""
    body=empty('Body',root);templates={}
    for x,y,z,scale,mat in [(-.22,0,.18,(.28,.25,.20),'Leaf'),(.22,.02,.19,(.29,.25,.21),'Leaf'),(0,.10,.27,(.30,.27,.29),'LeafLight')]:
        if mat not in templates:
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1)
            o=bpy.context.object;o.data.materials.append(MATS[mat]);templates[mat]=o.data
            for face in o.data.polygons:face.use_smooth=True
        else:
            o=bpy.data.objects.new('BushCluster',templates[mat]);bpy.context.collection.objects.link(o)
        o.name='BushCluster';o.parent=body;o.location=(x,y,z);o.scale=scale
