"""Tiny editable work tools. Runtime switches ToolAxe/ToolHoe root scale by action."""
import bpy
from mathutils import Vector, Matrix
import json, struct
from pathlib import Path


def hide_exported_tools(filename):
    """Hide only GLB roots after non-singular export, preserving child matrices.

    Blender's exporter derives child transforms from parent matrix inverses;
    exporting a zero-scale parent can collapse the children too. JSON root
    visibility scales are safe to set after all transforms have been exported.
    """
    path=Path(filename);raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0]
    data=json.loads(raw[20:20+length])
    for node in data['nodes']:
        if node.get('name') in ('ToolAxe','ToolHoe'):
            if 'matrix' in node:raise RuntimeError('Tool visibility root must export as TRS')
            node['scale']=[0,0,0]
    encoded=json.dumps(data,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
    remaining=raw[20+length:]
    path.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(encoded)+len(remaining))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+remaining)


def add_work_tools(rig, height):
    def material(name, color):
        mat = bpy.data.materials.new(name)
        mat.diffuse_color = (*color, 1)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        nodes.clear()
        out = nodes.new('ShaderNodeOutputMaterial')
        rgb = nodes.new('ShaderNodeRGB'); rgb.outputs[0].default_value = (*color, 1)
        mat.node_tree.links.new(rgb.outputs[0], out.inputs['Surface'])
        return mat
    wood = material('Tool wood', (.40,.20,.08))
    metal = material('Tool iron', (.42,.46,.48))
    body=bpy.data.objects['Body'];hand_index=body.vertex_groups['Hand.R'].index
    weighted=[]
    for vertex in body.data.vertices:
        weight=next((g.weight for g in vertex.groups if g.group==hand_index),0)
        if weight>.25: weighted.append((body.matrix_world@vertex.co,weight*weight))
    if not weighted: raise RuntimeError('Right palm has no skin weights')
    grip=sum((p*w for p,w in weighted),Vector())/sum(w for _,w in weighted)
    bpy.context.view_layer.update()
    hand=rig.pose.bones['Hand.R']
    bone_parent=rig.matrix_world@hand.matrix@Matrix.Translation((0,hand.bone.length,0))
    roots = []
    for name in ['ToolAxe', 'ToolHoe']:
        mount = bpy.data.objects.new(name+'Mount', None)
        bpy.context.collection.objects.link(mount)
        mount.parent = rig; mount.parent_type = 'BONE'; mount.parent_bone = 'Hand.R'
        # Align the shaft to the weighted palm, not an approximate bone tip.
        # Bone-parent compensation preserves this bind position and lets the
        # tool follow the existing hand rotation in every exported action.
        mount.matrix_parent_inverse=bone_parent.inverted()
        mount.location=grip
        # Preserve bind rotation in a nonzero-scale mount. A zero-scale matrix
        # loses its rotation during glTF decomposition; only the identity child
        # is hidden and later scaled by the runtime action switch.
        root=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(root);root.parent=mount
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=height*.012, depth=height*.38)
        handle = bpy.context.object; handle.name = name+'Handle'; handle.parent=root
        handle.location=(0,0,-height*.06); handle.data.materials.append(wood)
        bpy.ops.mesh.primitive_cube_add(size=1)
        blade=bpy.context.object;blade.name=name+'Blade';blade.parent=root
        blade.location=(height*.04,0,-height*.22)
        blade.scale=(height*.10,height*.026,height*.075) if name=='ToolAxe' else (height*.15,height*.035,height*.035)
        blade.data.materials.append(metal)
        root.scale=(0,0,0)
        roots.append(root)
    return roots
