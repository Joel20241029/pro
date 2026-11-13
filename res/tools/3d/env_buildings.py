"""Texture-free timber/stone architecture; imported by build-environment.py."""
import math
from env_common import empty, box, rod, beam, cylinder, ellipsoid, mesh, stone_ring, banner, join_patch, patch_meshes, PATCH_MODULES, ASSEMBLY_PATCHES


def roof(parent, z, width=2.05, depth=1.65, rise=.58, tile=False):
    """Broad hip roof, separate scalloped eaves and visible layered courses."""
    if PATCH_MODULES:parent=empty('RoofPatch',parent)
    x=width/2;y=depth/2;r=x*.72
    verts=[(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z),(-r,0,z+rise),(r,0,z+rise),(-x,-y,z-.10),(x,-y,z-.10),(x,y,z-.10),(-x,y,z-.10)]
    mesh('HipRoof',verts,[(0,1,5,4),(1,2,5),(2,3,4,5),(3,0,4),(0,6,7,1),(1,7,8,2),(2,8,9,3),(3,9,6,0),(6,9,8,7)],'Tile' if tile else 'Thatch',parent,.018)
    mat='Tile' if tile else 'ThatchLight'
    # Broad overhang with twenty inexpensive three-dimensional straw/tile rolls.
    for side in [-1,1]:
        ribs=6 if width<1.5 else 10
        for i in range(ribs):
            px=-x+.10+i*(width-.20)/(ribs-1)
            rod('RoofRib',(px,side*y,z+.025),(px*.72,side*.04,z+rise+.015),.042,mat,parent)
        rod('EaveRim',(-x,side*y,z),(x,side*y,z),.06,mat,parent)
        for t in [.38,.70]:rod('RoofCourse',(-x+(x-r)*t,side*y*(1-t),z+rise*t),(x-(x-r)*t,side*y*(1-t),z+rise*t),.025,'Thatch' if not tile else 'WoodDark',parent)
    rod('Ridge',(-r-.08,0,z+rise+.03),(r+.08,0,z+rise+.03),.075,'WoodHoney',parent)
    for sx in [-1,1]:cylinder('RidgeEnd',(sx*(r+.06),0,z+rise+.06),.09,.12,'WoodDark',parent,8)
    if PATCH_MODULES:join_patch(parent,'RoofPatch')


def window(parent,x,y,z,width=.34):
    if ASSEMBLY_PATCHES:parent=empty('WindowPatch',parent)
    box('WindowRecess',(x,y,z),(width,.035,.33),'WoodDark',parent,.02)
    for dx in [-width/2,width/2]:box('WindowFrame',(x+dx,y-.035,z),(.045,.06,.29),'WoodLight',parent,.012)
    for dz in [-.17,.17]:box('WindowFrame',(x,y-.035,z+dz),(width+.07,.065,.045),'WoodLight',parent,.012)
    box('WindowMullion',(x,y-.045,z),(.035,.04,.29),'Cream',parent,.006)
    box('WindowMullion',(x,y-.051,z),(width-.05,.04,.035),'Cream',parent,.006)
    if ASSEMBLY_PATCHES:join_patch(parent,'WindowPatch')


def house_unit(parent,x,y,z,width=1.65,depth=1.25,tile=False):
    unit=empty('DwellingModule',parent,(x,y,z))
    box('Foundation',(0,0,.11),(width+.14,depth+.13,.22),'StoneLight',unit,.07)
    box('PlasterWall',(0,0,.65),(width,depth,1.05),'Plaster',unit,.055)
    for sx in [-1,1]:
        for sy in [-1,1]:box('CornerTimber',(sx*(width/2-.05),sy*(depth/2-.025),.68),(.12,.10,1.1),'WoodHoney',unit,.018)
    box('DoorShadow',(0,-depth/2-.025,.49),(.38,.045,.75),'WoodDark',unit,.035)
    for i in range(3):box('DoorPlank',(-.115+i*.115,-depth/2-.055,.49),(.105,.05,.69),'WoodHoney',unit,.015)
    rod('DoorLatch',(.09,-depth/2-.10,.44),(.09,-depth/2-.10,.55),.025,'Gold',unit)
    box('Threshold',(0,-depth/2-.15,.12),(.52,.36,.13),'Stone',unit,.035)
    if width>=1.2:
        for sx in [-1,1]:window(unit,sx*width*.31,-depth/2-.025,.70,.28)
    roof(unit,1.20,width+.35,depth+.38,.54,tile)
    return unit


def house(root,level):
    body=empty('Body',root)
    house_unit(body,0,0,0,tile=level>=8)
    # Actual massing changes: side annex, then upper storey/central roof.
    if level>=4:house_unit(body,.91,.15,0,.64,.98,level>=8)
    if level>=8:
        upper=empty('UpperStorey',body,(0,.10,.83))
        box('UpperWall',(0,0,.43),(1.15,.87,.77),'Plaster',upper)
        for x in [-.52,.52]:box('UpperPost',(x,-.45,.43),(.09,.08,.78),'WoodHoney',upper)
        window(upper,0,-.455,.45,.35);roof(upper,.85,1.55,1.18,.46,True)
    if level>=12:
        house_unit(body,-.95,.12,0,.68,1.02,True)
        box('PorchFloor',(0,-.91,.18),(1.02,.48,.14),'WoodHoney',body)
        for x in [-.44,.44]:box('PorchPost',(x,-1.03,.55),(.09,.09,.76),'WoodLight',body)
        porch=empty('PorchRoof',body,(0,-.90,0));roof(porch,.97,1.14,.62,.22,False)
    # Separate count modules: runtime can use these sockets for extra occupied rooms.
    for i,x in enumerate([-.95,.95]):empty('RoomSocket'+str(i),root,(x,.12,0))


def stone(root,level):
    body=empty('Body',root);courses={1:2,4:3,8:4,12:5}[level];h=.27*courses
    for k in range(courses):
        ring=empty('StoneCourse',body);ring.rotation_euler.z=(k%2)*math.pi/8
        stone_ring(ring,.135+k*.27,.73 if level<8 else .82,.25,8,.30)
        if ASSEMBLY_PATCHES:join_patch(ring,'StoneCourse')
    cylinder('Platform',(0,0,h),.85 if level<8 else .94,.15,'WoodDark',body,12)
    for i in range(6):box('PlatformPlank',(-.58+i*.23,0,h+.1),(.215,1.24,.08),'WoodLight',body,.012)
    if level>=4:
        for a in [0,math.pi/2,math.pi,math.pi*1.5]:
            p=(.77*math.cos(a),.77*math.sin(a),h-.12)
            box('Battlement',p,(.30,.28,.32),'StoneLight',body,.045)
    if level>=8:
        for a in [0,math.pi/2,math.pi,math.pi*1.5]:
            box('StoneButtress',(.78*math.cos(a),.78*math.sin(a),.29),(.25,.25,.58),'Stone',body,.05)
        for x in [-.52,.52]:banner(body,x,-.72,h-.15,.48)
    if level>=12:
        cylinder('GoldCollar',(0,0,h-.10),.835,.08,'Gold',body,12)
    weapon=empty('Weapon',root,(0,0,h+.15))
    for x in [-.34,.34]:
        beam('CatapultSupport',(x,-.30,0),(x,0,.53),.15,.15,'WoodHoney',weapon)
        beam('CatapultSupport',(x,.32,0),(x,0,.53),.15,.15,'WoodHoney',weapon)
    rod('CatapultAxle',(-.45,0,.47),(.45,0,.47),.075,'Iron',weapon)
    arm=empty('ThrowArm',weapon,(0,0,.48))
    beam('ThrowingBeam',(0,.43,-.27),(0,-.52,.48),.13,.16,'WoodLight',arm)
    ellipsoid('SlingCup',(0,-.48,.46),(.23,.24,.09),'WoodDark',arm,8,5)
    ellipsoid('LoadedStone',(0,-.48,.56),(.16,.17,.17),'StoneLight',arm,8,5)
    empty('Muzzle',weapon,(0,-.48,1.08))
    if ASSEMBLY_PATCHES:
        patch_meshes(body,{'PlatformPlank'},'PlatformPatch')
        patch_meshes(weapon,{'CatapultSupport','CatapultAxle'},'CatapultFrame')
        patch_meshes(arm,None,'ThrowArmRigid')


def pavilion_roof(parent,z,radius,rise,mat):
    if ASSEMBLY_PATCHES:parent=empty('PavilionRoofPatch',parent)
    verts=[];n=8
    # Upturned octagonal eaves create the original wood/stone pavilion silhouette.
    for r,h in [(radius,z+.08),(radius*.72,z+.12),(radius*.25,z+rise),(.04,z+rise+.10)]:
        verts.extend([(r*math.cos(i*math.tau/n),r*math.sin(i*math.tau/n),h) for i in range(n)])
    faces=[]
    for k in range(3):
        for i in range(n):faces.append((k*n+i,k*n+(i+1)%n,(k+1)*n+(i+1)%n,(k+1)*n+i))
    faces.append(tuple(range(3*n,4*n)));mesh('PagodaRoof',verts,faces,mat,parent,.012)
    for i in range(n):
        a=i*math.tau/n
        rod('RoofRidge',(.04*math.cos(a),.04*math.sin(a),z+rise+.11),(radius*math.cos(a),radius*math.sin(a),z+.10),.025,'TealLight' if mat=='Teal' else 'ThatchLight',parent)
    if ASSEMBLY_PATCHES:join_patch(parent,'PavilionRoofPatch')


def slow(root,level):
    body=empty('Body',root);h={1:.83,4:1.02,8:1.30,12:1.49}[level]
    stone_ring(body,.17,.77,.34,8,.35);cylinder('Plinth',(0,0,.36),.78,.12,'StoneLight',body,8)
    for i in range(6):
        a=i*math.tau/6
        box('PavilionPost',(.53*math.cos(a),.53*math.sin(a),(.38+h)/2),(.12,.12,h-.38),'WoodHoney',body)
    pavilion_roof(body,h,.92,.43,'Thatch' if level==1 else 'Teal')
    if level>=8:pavilion_roof(body,h+.40,.58,.28,'Teal')
    if level>=12:
        for x in [-.55,.55]:banner(body,x,-.52,h-.05,.52)
        cylinder('GoldBase',(0,0,.45),.64,.08,'Gold',body,8)
    top=h+.46+( .30 if level>=8 else 0)
    weapon=empty('Weapon',root,(0,0,top))
    for i,(x,y,z,s) in enumerate([(0,0,.20,1),(-.18,0,.10,.7),(.16,.05,.12,.65)]):
        v=[(x+math.cos(a*math.tau/5)*.10*s,y+math.sin(a*math.tau/5)*.10*s,z-.15*s) for a in range(5)]
        v.append((x,y,z+.24*s));mesh('IceCrystal',v,[(j,(j+1)%5,5) for j in range(5)]+[(4,3,2,1,0)],'CrystalLight' if i==0 else 'Crystal',weapon)
    empty('Muzzle',weapon,(0,0,.44))
    if ASSEMBLY_PATCHES:
        patch_meshes(body,{'DressedStone','Plinth'},'StoneBase')
        patch_meshes(weapon,{'IceCrystal'},'CrystalPatch')


def gate(root,level):
    body=empty('Body',root);h={1:1.20,4:1.40,8:1.57,12:1.76}[level]
    for x in [-.74,.74]:
        box('GatePier',(x,0,.25),(.40,.56,.5),'Stone',body,.065)
        box('GatePost',(x,0,h/2+.15),(.23,.29,h),'WoodHoney',body)
        if level>=8:box('StonePierCladding',(x,0,.53),(.42,.47,.44),'StoneLight',body)
    box('Lintel',(0,0,h),(1.85,.40,.22),'WoodDark',body)
    # Damage motion tilts only the door leaves about the stable ground origin.
    doors=empty('GateDoors',body)
    for i in range(8):box('GatePlank',(-.58+i*.166,.05,h*.43),(.15,.12,h*.78),'WoodHoney',doors,.02)
    for z in [.33,h*.70]:box('GateBrace',(0,-.04,z),(1.33,.10,.12),'WoodLight',doors)
    for x in [-.16,.16]:cylinder('DoorKnocker',(x,-.12,.63),.06,.04,'Gold',doors,8,rot=(math.pi/2,0,0))
    roof(body,h+.14,2.06,.96,.42,level>=8)
    if level>=4:
        for x in [-1.02,1.02]:
            beam('SideSupport',(x,0,.18),(x*.71,0,h),.15,.18,'WoodHoney',body)
    if level>=12:
        roof(body,h+.53,1.48,.78,.33,True)
        for x in [-.83,.83]:banner(body,x,-.27,h-.15,.58)
    empty('HealthAnchor',root,(0,0,h+1.0))


def waterwheel(parent,x,y,z,radius=.45):
    wheel=empty('Waterwheel',parent,(x,y,z));wheel.rotation_euler.y=math.pi/2
    rigid=empty('WheelRigid',wheel) if PATCH_MODULES else wheel
    cylinder('Hub',(0,0,0),.10,.28,'WoodDark',rigid,8)
    for i in range(8):
        a=i*math.tau/8
        beam('Spoke',(0,0,0),(radius*math.cos(a),radius*math.sin(a),0),.055,.07,'WoodHoney',rigid)
        box('Bucket',(radius*math.cos(a),radius*math.sin(a),0),(.20,.13,.28),'WoodLight',rigid,.014,rot=(0,0,a+math.pi/2))
    if PATCH_MODULES:join_patch(rigid,'WheelRigid')
    return wheel


def farm(root,level):
    ground=empty('Ground',root)
    soil=empty('SoilPatch',ground) if PATCH_MODULES else ground
    box('TilledEarth',(0,0,.035),(1.90,1.42,.07),'Soil',soil,.035)
    count={1:3,4:4,8:5,12:6}[level]
    for j in range(4):
        y=-.52+j*.34
        box('RaisedFurrow',(0,y,.085),(1.79,.23,.07),'WoodDark',soil,.03)
        for i in range(count):
            plant=empty('WheatPlant',ground) if PATCH_MODULES else ground
            x=-.75+i*1.5/max(1,count-1);height=.23+(i+j)%3*.045
            rod('WheatStem',(x,y,.11),(x,y,.11+height),.013,'Grass',plant)
            # Six separate plump kernels form a recognizable ear of wheat.
            for k in range(3):
                for side in [-1,1]:
                    cx=x+side*.025;cz=.13+height+k*.04
                    verts=[(cx-.024,y,cz),(cx+.024,y,cz),(cx,y-.025,cz),(cx,y+.025,cz),(cx+side*.012,y,cz+.055),(cx-side*.008,y,cz-.03)]
                    mesh('WheatKernel',verts,[(0,2,4),(2,1,4),(1,3,4),(3,0,4),(2,0,5),(1,2,5),(3,1,5),(0,3,5)],'Grain',plant)
            for side in [-1,1]:mesh('WheatLeaf',[(x,y,.18),(x+side*.10,y,.29),(x+side*.045,y+.025,.23)],[(0,1,2)],'Grass',plant)
            if PATCH_MODULES:join_patch(plant,'WheatPlant')
    if PATCH_MODULES:join_patch(soil,'SoilPatch')
    above=empty('AboveGround',root)
    if level>=4:
        box('IrrigationTrough',(1.03,.10,.12),(.17,1.48,.20),'StoneLight',above)
        box('Water',(1.03,.10,.225),(.10,1.37,.016),'Crystal',above,.003)
    if level>=8:
        box('WheelBase',(1.11,.42,.19),(.34,.38,.38),'Stone',above)
        waterwheel(above,1.15,.42,.67,.43 if level==8 else .53)
    if level>=12:
        canopy=empty('WheelCanopy',above,(1.15,.42,0))
        roof(canopy,1.23,.75,.70,.25,False)
    empty('WorkSocket',root,(0,-.85,0))


def logging(root,level):
    body=empty('Body',root)
    box('Workbench',(0,-.23,.58),(1.15,.50,.15),'WoodHoney',body)
    for x in [-.45,.45]:box('BenchLeg',(x,-.23,.28),(.12,.38,.56),'WoodDark',body)
    for i in range(3):
        for j in range(2 if level>=4 else 1):cylinder('StackedLog',(-.53+i*.38,.42,.16+j*.26),.15,1.08,'WoodHoney',body,8,rot=(math.pi/2,0,0))
    for x in [-.83,.83]:box('ShedPost',(x,.42,.64),(.14,.14,1.28),'WoodHoney',body)
    roof(body,1.32,2.0,1.20,.42,level>=8)
    axe=empty('Axe',body,(.35,-.23,.73))
    rod('AxeHandle',(0,0,0),(.20,0,.45),.035,'WoodLight',axe)
    box('AxeHead',(.19,0,.38),(.25,.07,.16),'Iron',axe,.02)
    if level>=4:
        for x in [-.83,.83]:box('FrontPost',(x,-.24,.64),(.13,.13,1.28),'WoodHoney',body)
        box('SawRack',(-.66,-.40,.72),(.09,.14,.73),'WoodLight',body)
    if level>=8:
        saw=empty('SawBlade',body,(.10,-.23,.77))
        cylinder('CircularSaw',(0,0,0),.28,.035,'Iron',saw,12,rot=(math.pi/2,0,0))
        for i in range(10):
            a=i*math.tau/10
            mesh('SawTooth',[(.26*math.cos(a),-.02,.26*math.sin(a)),(.34*math.cos(a+.09),-.02,.34*math.sin(a+.09)),(.26*math.cos(a+.27),-.02,.26*math.sin(a+.27))],[(0,1,2)],'Iron',saw)
    if level>=12:
        roof(body,1.70,1.35,.92,.28,True)
        for x in [-.81,.81]:banner(body,x,-.28,1.20,.42)
    empty('WorkSocket',root,(0,-.72,0))
