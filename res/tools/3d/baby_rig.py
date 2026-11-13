"""Swaddled infant: true two-part skinning, reclining rest and subtle breathing."""
import math
import bpy
from mathutils import Vector, Matrix


def bind_baby(mesh, height):
    # Reference faces -Y. Recline 70 degrees: face points mainly up with a
    # small camera-facing component; head lies farther away along +Y.
    rotate = Matrix.Rotation(math.radians(-70), 3, 'X')
    for v in mesh.data.vertices:
        v.co = rotate @ v.co
    low_z=min(v.co.z for v in mesh.data.vertices)
    center_y=(min(v.co.y for v in mesh.data.vertices)+max(v.co.y for v in mesh.data.vertices))/2
    offset=Vector((0,-center_y,-low_z))
    for v in mesh.data.vertices: v.co += offset
    bpy.ops.object.armature_add(enter_editmode=True)
    rig=bpy.context.object;rig.name='Skeleton'
    bones=rig.data.edit_bones;bones.remove(bones[0])
    for name,a,b,parent in [('Root',(0,0,0),(0,0,.08),None),('Breath',(0,0,.12),(0,0,.62),'Root'),('Head',(0,0,.62),(0,0,.93),'Breath')]:
        bone=bones.new(name);bone.head=rotate@(Vector(a)*height)+offset;bone.tail=rotate@(Vector(b)*height)+offset
        if parent: bone.parent=bones[parent]
        bone.use_deform=name!='Root'
    bpy.ops.object.mode_set(mode='OBJECT')
    groups={name:mesh.vertex_groups.new(name=name) for name in ['Breath','Head']}
    inverse=rotate.inverted()
    for v in mesh.data.vertices:
        z=(inverse@(v.co-offset)).z/height
        head=max(0,min(1,(z-.57)/.10))
        groups['Breath'].add([v.index],1-head,'REPLACE');groups['Head'].add([v.index],head,'REPLACE')
    mesh.parent=rig;mod=mesh.modifiers.new('Skeletal deformation','ARMATURE');mod.object=rig
    rig.animation_data_create();action=bpy.data.actions.new('idle');action.use_fake_user=True;rig.animation_data.action=action
    for f in range(1,62,3):
        phase=(f-1)/60*math.tau
        body=rig.pose.bones['Breath'];body.scale=(1+.008*math.sin(phase),1,1+.014*math.sin(phase));body.keyframe_insert('scale',frame=f)
        head=rig.pose.bones['Head'];head.rotation_mode='XYZ';head.rotation_euler.x=.008*math.sin(phase);head.keyframe_insert('rotation_euler',frame=f)
    action.frame_start=1;action.frame_end=61
    bpy.context.scene.frame_set(1)
    return rig,['idle']
