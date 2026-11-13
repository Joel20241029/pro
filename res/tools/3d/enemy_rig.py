"""Enemy-only deform rigs. Authored against the ten inspected Hyper3D meshes.

Normalized landmarks are presentation authoring data, measured from each model's
full height/width/length after placing its feet on Z=0. No gameplay values live here.
Run in Blender; GLB export converts Z-up / forward -Y to Y-up / forward +Z.
"""
import math
import bpy
from mathutils import Vector, Quaternion, Euler

# Head height includes hair/helmet. Different limb profiles deliberately prevent
# the thin runner/shaman from inheriting the commander's short broad proportions.
HUMAN = {
    'enemy_raider': dict(hip=.30,knee=.17,ankle=.055,neck=.63,shoulder=.58,sx=.13,ex=.225,ez=.465,hx=.29,hz=.36,legx=.095,relax=18),
    'enemy_runner': dict(hip=.34,knee=.19,ankle=.055,neck=.66,shoulder=.61,sx=.115,ex=.205,ez=.50,hx=.27,hz=.39,legx=.08,relax=19),
    'enemy_armored': dict(hip=.31,knee=.17,ankle=.06,neck=.65,shoulder=.60,sx=.145,ex=.23,ez=.49,hx=.30,hz=.40,legx=.105,relax=13),
    'enemy_disruptor': dict(hip=.37,knee=.21,ankle=.055,neck=.70,shoulder=.65,sx=.12,ex=.205,ez=.53,hx=.27,hz=.405,legx=.085,relax=18),
    'enemy_chief': dict(hip=.29,knee=.155,ankle=.055,neck=.66,shoulder=.61,sx=.20,ex=.29,ez=.49,hx=.365,hz=.375,legx=.13,relax=10),
    'enemy_commander': dict(hip=.28,knee=.145,ankle=.055,neck=.63,shoulder=.58,sx=.165,ex=.255,ez=.47,hx=.33,hz=.365,legx=.11,relax=12),
    'enemy_shaman': dict(hip=.29,knee=.16,ankle=.055,neck=.68,shoulder=.62,sx=.155,ex=.255,ez=.47,hx=.335,hz=.28,legx=.105,relax=12),
}
QUADRUPED = {
    'enemy_boar': dict(shoulder=.65,hip=.63,front=.33,rear=.72,head=.35,tail=.82,stance=.25),
    'enemy_wolfking': dict(shoulder=.53,hip=.51,front=.30,rear=.68,head=.28,tail=.76,stance=.20),
    'enemy_tuskking': dict(shoulder=.65,hip=.61,front=.34,rear=.72,head=.34,tail=.84,stance=.25),
}


def _weights(p, names, segments, scale):
    ranked=[]
    for name in names:
        a,b=segments[name];ab=b-a;t=max(0,min(1,(p-a).dot(ab)/ab.length_squared))
        ranked.append((name,(p-a-ab*t).length))
    raw=[(name,1/(distance+scale*.022)**4) for name,distance in sorted(ranked,key=lambda v:v[1])[:3]]
    total=sum(w for _,w in raw)
    return [(name,w/total) for name,w in raw]


def _armature(mesh, coords, classify, scale):
    bpy.ops.object.armature_add(enter_editmode=True,location=(0,0,0));rig=bpy.context.object;rig.name='Skeleton'
    bones=rig.data.edit_bones;bones.remove(bones[0])
    for name,(a,b,parent) in coords.items():
        bone=bones.new(name);bone.head=a;bone.tail=b;bone.use_deform=name!='Root'
        if parent:bone.parent=bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    segments={name:(Vector(a),Vector(b)) for name,(a,b,_) in coords.items()}
    groups={name:mesh.vertex_groups.new(name=name) for name in coords if name!='Root'}
    for v in mesh.data.vertices:
        names=classify(v.co)
        for name,w in _weights(v.co,names,segments,scale):groups[name].add([v.index],w,'REPLACE')
    mesh.parent=rig;mod=mesh.modifiers.new('Skeletal deformation','ARMATURE');mod.object=rig
    for bone in rig.pose.bones:bone.rotation_mode='QUATERNION'
    rig.show_in_front=True
    return rig


def humanoid(mesh,h,kind):
    p=HUMAN[kind];coords={
      'Root':((0,0,0),(0,0,h*.1),None),
      'Hips':((0,0,h*p['hip']),(0,0,h*(p['hip']+.10)),'Root'),
      'Spine':((0,0,h*(p['hip']+.10)),(0,0,h*p['neck']),'Hips'),
      'Head':((0,0,h*p['neck']),(0,0,h*.86),'Spine')}
    for side,s in [('L',1),('R',-1)]:
        coords.update({
          'UpperArm.'+side:((s*p['sx']*h,0,p['shoulder']*h),(s*p['ex']*h,0,p['ez']*h),'Spine'),
          'Forearm.'+side:((s*p['ex']*h,0,p['ez']*h),(s*p['hx']*h,-.005*h,p['hz']*h),'UpperArm.'+side),
          'Hand.'+side:((s*p['hx']*h,-.005*h,p['hz']*h),(s*(p['hx']+.022)*h,-.02*h,(p['hz']-.045)*h),'Forearm.'+side),
          'Thigh.'+side:((s*p['legx']*h,0,p['hip']*h),(s*p['legx']*h,0,p['knee']*h),'Hips'),
          'Shin.'+side:((s*p['legx']*h,0,p['knee']*h),(s*p['legx']*h,0,p['ankle']*h),'Thigh.'+side),
          'Foot.'+side:((s*p['legx']*h,0,p['ankle']*h),(s*p['legx']*h,-.08*h,.035*h),'Shin.'+side)})
    def classify(v):
        x,z=abs(v.x)/h,v.z/h;side='L' if v.x>=0 else 'R'
        if z>=p['neck']+.01:return ['Head']
        if z<p['hip']-.025 and x<p['legx']+.085:
            return [n+'.'+side for n in ['Thigh','Shin','Foot']]
        # A slanted boundary follows the outer torso rather than an arbitrary
        # constant X cutoff, keeping wide belts and breastplates off the arms.
        arm_boundary=p['sx']-.015+max(0,p['shoulder']-z)*.30
        if x>arm_boundary and z<p['shoulder']+.015:
            names=[n+'.'+side for n in ['UpperArm','Forearm','Hand']]
            if x<p['sx']+.035:names.append('Spine')
            return names
        return ['Spine','Head'] if z>p['neck']-.055 else ['Hips','Spine']
    rig=_armature(mesh,coords,classify,h)
    # Bake only a modest relaxed-arm correction into the rest mesh. Large armour
    # shoulders get smaller corrections to avoid shoulder plate penetration.
    for side,s in [('L',1),('R',-1)]:
        name='UpperArm.'+side;axis=rig.data.bones[name].matrix_local.to_3x3().inverted()@Vector((0,1,0))
        rig.pose.bones[name].rotation_quaternion=Quaternion(axis,s*math.radians(p['relax']))
    bpy.context.view_layer.update();bpy.context.view_layer.objects.active=mesh
    bpy.ops.object.modifier_apply(modifier='Skeletal deformation');bpy.context.view_layer.objects.active=rig
    bpy.ops.object.mode_set(mode='POSE');bpy.ops.pose.armature_apply(selected=False);bpy.ops.object.mode_set(mode='OBJECT')
    mod=mesh.modifiers.new('Skeletal deformation','ARMATURE');mod.object=rig
    return rig


def quadruped(mesh,h,kind):
    p=QUADRUPED[kind];xs=[v.co.x for v in mesh.data.vertices];ys=[v.co.y for v in mesh.data.vertices]
    width=max(xs)-min(xs);low=min(ys);length=max(ys)-low
    y=lambda t:low+length*t
    coords={
      'Root':((0,0,0),(0,0,h*.1),None),
      'Hips':((0,y(p['rear']),h*p['hip']),(0,y(.53),h*.58),'Root'),
      'Spine':((0,y(.53),h*.58),(0,y(p['front']),h*p['shoulder']),'Hips'),
      'Head':((0,y(p['head']),h*.60),(0,y(.13),h*.64),'Spine'),
      'TailBase':((0,y(p['tail']-.10),h*.58),(0,y(p['tail']),h*.70),'Hips'),
      'TailTip':((0,y(p['tail']),h*.70),(0,y(.96),h*(.91 if kind=='enemy_wolfking' else .76)),'TailBase')}
    for side,s in [('L',1),('R',-1)]:
        x=s*width*p['stance']
        for limb,t,top,parent in [('Front',p['front'],p['shoulder'],'Spine'),('Hind',p['rear'],p['hip'],'Hips')]:
            knee_y=y(t+(.045 if limb=='Hind' else -.005));ankle_y=y(t)
            coords[limb+'Upper.'+side]=((x,y(t),h*top),(x,knee_y,h*.28),parent)
            coords[limb+'Lower.'+side]=((x,knee_y,h*.28),(x,ankle_y,h*.08),limb+'Upper.'+side)
            coords[limb+'Paw.'+side]=((x,ankle_y,h*.08),(x,ankle_y-length*.055,h*.045),limb+'Lower.'+side)
    def classify(v):
        z=v.z/h;t=(v.y-low)/length;side='L' if v.x>=0 else 'R'
        if t>p['tail']-.025 and z>.48:return ['TailBase','TailTip']
        # Tusks, muzzle and mane ride with the skull; front legs stay excluded.
        if (t<p['head']-.04 and z>.38) or t<.13:return ['Head']
        if z<.48 and abs(v.x)>width*.10:
            limb='Front' if t<(p['front']+p['rear'])/2 else 'Hind'
            names=[limb+n+'.'+side for n in ['Upper','Lower','Paw']]
            if z>.40:names.append('Spine' if limb=='Front' else 'Hips')
            return names
        if t<p['head']+.05:return ['Head','Spine']
        return ['Hips','Spine']
    return _armature(mesh,coords,classify,h)


def create_actions(rig,mesh,h,kind):
    """31 real skinned frames per clip. Foot-floor correction is baked in Root.

    Stance alternation is presentation only; gameplay speed/position remains in
    the existing deterministic simulation. End frame matches first frame.
    """
    four=kind in QUADRUPED;heavy=kind in ['enemy_chief','enemy_commander','enemy_tuskking']
    for name in ['idle','walk']:
        action=bpy.data.actions.new(name);action.use_fake_user=True;rig.animation_data_create();rig.animation_data.action=action
        for frame in range(1,32):
            bpy.context.scene.frame_set(frame)
            phase=(frame-1)/30*math.tau;swing=math.sin(phase);p=rig.pose.bones
            for bone in p:bone.rotation_quaternion=(1,0,0,0);bone.location=(0,0,0)
            turns={n:[0.,0.,0.] for n in p.keys()}
            turns['Spine'][0]=.008*math.sin(phase);turns['Head'][2]=.012*math.sin(phase)
            if four:
                turns['TailBase'][2]=.10*math.sin(phase);turns['TailTip'][2]=.09*math.sin(phase-.5)
                if name=='walk':
                    for side,s in [('L',1),('R',-1)]:
                        for limb,d in [('Front',s),('Hind',-s)]:
                            turns[limb+'Upper.'+side][0]=d*(.27 if heavy else .34)*swing
                            turns[limb+'Lower.'+side][0]=max(0,-d*swing)*.28
                            turns[limb+'Paw.'+side][0]=-d*.10*swing
                    turns['Spine'][2]=.018*swing;turns['Head'][0]=.025*math.sin(phase*2)
            elif name=='walk':
                for side,s in [('L',1),('R',-1)]:
                    turns['Thigh.'+side][0]=s*(.30 if heavy else .40)*swing
                    turns['Shin.'+side][0]=max(0,-s*swing)*.34
                    turns['Foot.'+side][0]=-s*.08*swing
                    turns['UpperArm.'+side][0]=-s*(.18 if heavy else .27)*swing
                    turns['Forearm.'+side][0]=-.08
                turns['Spine'][2]=.025*swing
            for bone in p:
                rest=rig.data.bones[bone.name].matrix_local.to_quaternion()
                bone.rotation_quaternion=rest.inverted()@Euler(turns[bone.name],'XYZ').to_quaternion()@rest
            bpy.context.view_layer.update()
            evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());minimum=min((evaluated.matrix_world@v.co).z for v in evaluated.data.vertices)
            root=rig.data.bones['Root'].matrix_local.to_3x3()
            p['Root'].location=root.inverted()@Vector((0,0,-minimum+h*.005))
            for bone in p:
                bone.keyframe_insert('rotation_quaternion',frame=frame,group=bone.name)
                if bone.name=='Root':bone.keyframe_insert('location',frame=frame,group=bone.name)
        action.frame_start=1;action.frame_end=31
    rig.animation_data.action=bpy.data.actions['idle'];bpy.context.scene.frame_set(1)
    return ['idle','walk']
