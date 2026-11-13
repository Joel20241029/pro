"""Editable stylized humanoid rig and small shared action vocabulary.

Run inside Blender. Coordinates are proportional to the authored character height;
the generated GLB uses standard Y-up, while the editable source uses Blender Z-up.
These controls affect presentation only, never the game's age/job/sex rules.
"""
import math
import bpy
from mathutils import Vector, Quaternion, Euler


def segment_distance(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - a - ab * t).length


def humanoid(mesh, height, kind="male"):
    """Bind the clean A-pose mesh to a 16-bone, genuinely skinned armature."""
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    rig = bpy.context.object
    rig.name = "Skeleton"
    bones = rig.data.edit_bones
    bones.remove(bones[0])
    coords = {
        "Root": ((0, 0, 0), (0, 0, .1), None),
        "Hips": ((0, 0, .24), (0, 0, .34), "Root"),
        "Spine": ((0, 0, .34), (0, 0, .535), "Hips"),
        "Head": ((0, 0, .535), (0, 0, .83), "Spine"),
    }
    for side, sign in [("L", 1), ("R", -1)]:
        coords.update({
            "UpperArm." + side: ((sign * .115, 0, .515), (sign * .225, 0, .405), "Spine"),
            "Forearm." + side: ((sign * .225, 0, .405), (sign * .29, -.005, .335), "UpperArm." + side),
            "Hand." + side: ((sign * .29, -.005, .335), (sign * .325, -.01, .305), "Forearm." + side),
            "Thigh." + side: ((sign * .082, 0, .255), (sign * .092, 0, .145), "Hips"),
            "Shin." + side: ((sign * .092, 0, .145), (sign * .095, 0, .055), "Thigh." + side),
            "Foot." + side: ((sign * .095, 0, .055), (sign * .095, -.085, .045), "Shin." + side),
        })
    # Authored neutral references have different neck/hip landmarks. Child is
    # not a uniformly scaled adult: a larger head and shorter trunk need their
    # own bind locations. Values are normalized to each model's full height.
    profiles = {
        "female": {"neck": .55, "shoulder": .53, "hip": .27, "knee": .15, "ankle": .055},
        "child": {"neck": .585, "shoulder": .515, "hip": .28, "knee": .15, "ankle": .06},
        "elder": {"neck": .56, "shoulder": .535, "hip": .29, "knee": .16, "ankle": .055},
    }
    profile = profiles.get(kind)
    if profile:
        neck, shoulder, hip = profile["neck"], profile["shoulder"], profile["hip"]
        coords["Hips"] = ((0, 0, hip), (0, 0, hip+.09), "Root")
        coords["Spine"] = ((0, 0, hip+.09), (0, 0, neck), "Hips")
        coords["Head"] = ((0, 0, neck), (0, 0, .84), "Spine")
        for side, sign in [("L", 1), ("R", -1)]:
            coords["UpperArm."+side] = ((sign*.115,0,shoulder),(sign*.225,0,shoulder-.115),"Spine")
            coords["Forearm."+side] = ((sign*.225,0,shoulder-.115),(sign*.29,-.005,shoulder-.19),"UpperArm."+side)
            coords["Hand."+side] = ((sign*.29,-.005,shoulder-.19),(sign*.325,-.01,shoulder-.22),"Forearm."+side)
            coords["Thigh."+side] = ((sign*.082,0,hip),(sign*.092,0,profile["knee"]),"Hips")
            coords["Shin."+side] = ((sign*.092,0,profile["knee"]),(sign*.095,0,profile["ankle"]),"Thigh."+side)
            coords["Foot."+side] = ((sign*.095,0,profile["ankle"]),(sign*.095,-.085,.045),"Shin."+side)
    for name, (start, end, parent) in coords.items():
        bone = bones.new(name)
        bone.head = Vector(start) * height
        bone.tail = Vector(end) * height
        if parent:
            bone.parent = bones[parent]
        bone.use_deform = name != "Root"
    bpy.ops.object.mode_set(mode="OBJECT")
    groups = {name: mesh.vertex_groups.new(name=name) for name in coords if name != "Root"}
    segments = {name: (Vector(a) * height, Vector(b) * height) for name, (a, b, _) in coords.items()}
    braid_vertices = set()
    if kind == "female":
        # Reference hair is neutral dark brown, the tunic is saturated orange.
        # UV colors distinguish the braid behind the shoulder from adjacent
        # cloth, preventing a single braid being torn across arm/body weights.
        image = next(n.image for n in mesh.data.materials[0].node_tree.nodes if n.type == "TEX_IMAGE")
        pixels=list(image.pixels); w,h=image.size
        for loop in mesh.data.loops:
            p=mesh.data.vertices[loop.vertex_index].co
            if p.z < height*.37 or p.y < -height*.04: continue
            uv=mesh.data.uv_layers.active.data[loop.index].uv
            offset=4*(min(h-1,max(0,int(uv.y*h)))*w+min(w-1,max(0,int(uv.x*w))))
            r,g,b=pixels[offset:offset+3]
            if max(r,g,b) < .48 and r < g*1.95 and b > g*.55:
                braid_vertices.add(loop.vertex_index)
        hair_positions={tuple(round(c,5) for c in mesh.data.vertices[i].co) for i in braid_vertices}
        braid_vertices.update(v.index for v in mesh.data.vertices if tuple(round(c,5) for c in v.co) in hair_positions)
    bound_weights = []
    for vertex in mesh.data.vertices:
        p = vertex.co
        side = "L" if p.x >= 0 else "R"
        neck_line = profile["neck"]+.015 if profile else .55
        leg_line = profile["hip"]-.02 if profile else .235
        arm_top = profile["shoulder"]+.025 if profile else .54
        if p.z >= height * neck_line:
            weights = [("Head", 1.0)]
        elif vertex.index in braid_vertices:
            weights = [("Head", 1.0)]
        elif p.z < height * leg_line and (not profile or abs(p.x) < height*.19):
            names = [kind + "." + side for kind in ["Thigh", "Shin", "Foot"]]
            weights = proximity_weights(p, names, segments, height)
        elif abs(p.x) > height * .135 and p.z < height * arm_top:
            names = [kind + "." + side for kind in ["UpperArm", "Forearm", "Hand"]]
            if abs(p.x) < height * .18:
                names.append("Spine")
            weights = proximity_weights(p, names, segments, height)
        elif p.z > height * (neck_line-.06):
            weights = proximity_weights(p, ["Spine", "Head"], segments, height)
        else:
            weights = proximity_weights(p, ["Hips", "Spine"], segments, height)
        for name, weight in weights:
            groups[name].add([vertex.index], weight, "REPLACE")
        bound_weights.append(dict(weights))
    if kind == "female":
        # Reconstruction joins a few braid/cloth seam triangles. Smooth the
        # skin boundary over mesh adjacency rather than leave rigid alternating
        # Head/Arm triangles that become spikes in raised-arm poses.
        neighbors=[set() for _ in mesh.data.vertices]
        same_position={}
        for v in mesh.data.vertices: same_position.setdefault(tuple(round(c,5) for c in v.co),[]).append(v.index)
        for edge in mesh.data.edges:
            a,b=edge.vertices;neighbors[a].add(b);neighbors[b].add(a)
        for coincident in same_position.values():
            common=set().union(*(neighbors[i] for i in coincident))
            for i in coincident: neighbors[i].update(common)
        for _ in range(4):
            updated=[]
            for i,old in enumerate(bound_weights):
                if mesh.data.vertices[i].co.z > height*.61 or not neighbors[i]: updated.append(old);continue
                mixed={k:v*.55 for k,v in old.items()}
                for j in neighbors[i]:
                    for k,v in bound_weights[j].items():mixed[k]=mixed.get(k,0)+v*.45/len(neighbors[i])
                top=sorted(mixed.items(),key=lambda item:-item[1])[:4];total=sum(v for _,v in top)
                updated.append({k:v/total for k,v in top})
            bound_weights=updated
        all_indices=list(range(len(mesh.data.vertices)))
        for group in groups.values():group.remove(all_indices)
        for i,weights in enumerate(bound_weights):
            for name,weight in weights.items():groups[name].add([i],weight,'REPLACE')
    mesh.parent = rig
    modifier = mesh.modifiers.new("Skeletal deformation", "ARMATURE")
    modifier.object = rig
    for pose in rig.pose.bones:
        pose.rotation_mode = "QUATERNION"
    return rig


def proximity_weights(point, names, segments, height):
    ranked = sorted([(name, segment_distance(point, *segments[name])) for name in names], key=lambda v: v[1])[:3]
    raw = [(name, 1.0 / (distance + height * .025) ** 4) for name, distance in ranked]
    total = sum(weight for _, weight in raw)
    return [(name, weight / total) for name, weight in raw]


def natural_rest(rig, mesh, kind="male"):
    """Bake relaxed arms into rest mesh so paused first frames never show an A-pose."""
    for side, sign in [("L", 1), ("R", -1)]:
        name = "UpperArm." + side
        local_axis = rig.data.bones[name].matrix_local.to_3x3().inverted() @ Vector((0, 1, 0))
        rig.pose.bones[name].rotation_quaternion = Quaternion(local_axis, sign * math.radians(27 if kind == "child" else 34))
    bpy.context.view_layer.update()
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.modifier_apply(modifier="Skeletal deformation")
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    modifier = mesh.modifiers.new("Skeletal deformation", "ARMATURE")
    modifier.object = rig
    bpy.context.view_layer.update()


def create_actions(rig, height, kind):
    """Small interpolated bone clips; 30 fps is playback timing, not bitmap frames."""
    actions = ["idle", "walk"] if kind in ("child", "elder") else ["idle", "walk", "farm", "chop", "care"]
    for name in actions:
        rig.animation_data_create()
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        rig.animation_data.action = action
        for frame in range(1, 32, 3):
            t = (frame - 1) / 30
            phase = t * math.tau
            for bone in rig.pose.bones:
                bone.rotation_quaternion = (1, 0, 0, 0)
                bone.location = (0, 0, 0)
            p = rig.pose.bones
            turns = {name: [0.0, 0.0, 0.0] for name in p.keys()}
            turns["Spine"][0] = .015 * math.sin(phase)
            if name == "walk":
                swing = math.sin(phase)
                p["Hips"].location.y = height * .009 * (1 - math.cos(phase * 2))
                for side, sign in [("L", 1), ("R", -1)]:
                    turns["Thigh." + side][0] = sign * .42 * swing
                    turns["Shin." + side][0] = max(0, -sign * swing) * .35
                    turns["UpperArm." + side][0] = -sign * .30 * swing
                    turns["Forearm." + side][0] = -.12
                turns["Spine"][2] = .035 * swing
            elif name == "chop":
                lift = .5 - .5 * math.cos(phase)
                turns["Spine"][0] = .12 + .18 * lift
                for side in ["L", "R"]:
                    turns["UpperArm." + side][0] = -.65 - 1.05 * (1 - lift)
                    turns["Forearm." + side][0] = -.35 - .35 * (1 - lift)
                turns["Spine"][2] = .1 * math.sin(phase)
            elif name == "farm":
                bend = .5 - .5 * math.cos(phase)
                turns["Spine"][0] = .22 + .24 * bend
                for side in ["L", "R"]:
                    turns["UpperArm." + side][0] = -.65 + .3 * bend
                    turns["Forearm." + side][0] = -.25
            elif name == "care":
                turns["Spine"][0] = .15
                turns["UpperArm.R"][0] = -.70
                turns["Forearm.R"][0] = -.65 + .20 * math.sin(phase * 2)
                turns["Hand.R"][2] = .16 * math.sin(phase * 2)
                turns["Head"][0] = .08
            if kind == "elder":
                turns["Spine"][0] += .12
            for bone in rig.pose.bones:
                rest = rig.data.bones[bone.name].matrix_local.to_quaternion()
                bone.rotation_quaternion = rest.inverted() @ Euler(turns[bone.name], "XYZ").to_quaternion() @ rest
                bone.keyframe_insert("rotation_quaternion", frame=frame, group=bone.name)
                if bone.name == "Hips":
                    bone.keyframe_insert("location", frame=frame, group=bone.name)
        action.frame_start = 1
        action.frame_end = 31
    rig.animation_data.action = bpy.data.actions["idle"]
    bpy.context.scene.frame_set(1)
    return actions
