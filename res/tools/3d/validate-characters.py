"""Read-only GLB skin/action validation; no Blender or Laya dependency."""
import json, math, struct, sys, hashlib
from pathlib import Path

def load(path):
    raw=path.read_bytes()
    assert raw[:4]==b'glTF' and struct.unpack_from('<I',raw,8)[0]==len(raw)
    length=struct.unpack_from('<I',raw,12)[0]
    return json.loads(raw[20:20+length]),raw[28+length:]

def values(document,binary,index):
    accessor=document['accessors'][index];view=document['bufferViews'][accessor['bufferView']]
    fmt,size={5121:('B',1),5123:('H',2),5125:('I',4),5126:('f',4)}[accessor['componentType']]
    width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[accessor['type']]
    offset=view.get('byteOffset',0)+accessor.get('byteOffset',0)
    stride=view.get('byteStride',width*size)
    return [struct.unpack_from('<'+fmt*width,binary,offset+i*stride) for i in range(accessor['count'])]

root=Path(sys.argv[1]);reports=[]
for name in ['male','female','child','elder','baby']:
    path=root/(name+'.glb');doc,binary=load(path)
    assert len(doc['skins'])==1 and 'KHR_materials_unlit' in doc['extensionsUsed']
    body=next(n for n in doc['nodes'] if n.get('name')=='Body' and 'mesh' in n)
    attributes=doc['meshes'][body['mesh']]['primitives'][0]['attributes']
    weights=values(doc,binary,attributes['WEIGHTS_0']);joints=values(doc,binary,attributes['JOINTS_0'])
    assert all(abs(sum(w)-1)<.001 for w in weights)
    assert all(all(v<len(doc['skins'][0]['joints']) for v in row) for row in joints)
    assert all(all(math.isfinite(v) for v in row) for row in values(doc,binary,attributes['POSITION']))
    actions=sorted(a['name'] for a in doc['animations'])
    assert actions==sorted(['idle'] if name=='baby' else ['idle','walk'] if name in ['child','elder'] else ['idle','walk','farm','chop','care'])
    tools=[n for n in doc['nodes'] if n.get('name') in ['ToolAxe','ToolHoe']]
    assert len(tools)==(2 if name in ['male','female'] else 0)
    assert all(n['scale']==[0,0,0] for n in tools)
    for tool in tools:
        for index in tool['children']:
            assert all(abs(v)>1e-7 for v in doc['nodes'][index].get('scale',[1,1,1])), 'Hidden parent collapsed tool child transform'
    reports.append({'id':name,'bytes':path.stat().st_size,'bones':len(doc['skins'][0]['joints']),
        'actions':actions,'skinnedVertices':len(weights),'tools':[n['name'] for n in tools],
        'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
print(json.dumps(reports,indent=2))
