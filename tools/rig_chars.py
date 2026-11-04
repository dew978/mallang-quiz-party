# 미니 유물레이더스 rig_chars.py를 그대로 따른 뼈대 심기 (이 게임용 새 캐릭터 5종).
# blender -b --python rig.py -- <name:yaw> ...   (yaw: 앞이 +X가 되게 돌릴 대략의 각도)
# 결과: 게임 assets/models/char_<name>.glb (5000 삼각형, 512 그림) + _lod (1500 삼각형, 256 그림), 미리보기 png
import bpy, bmesh, math, os, sys, json
import numpy as np
from mathutils import Vector, Quaternion

SRC = r"C:\Users\ndh10\AppData\Local\Temp\partygen\raiders\model"
PREV = r"C:\Users\ndh10\AppData\Local\Temp\partygen\raiders"
DST = r"C:\Users\ndh10\AppData\Local\Claude-Data\claude_pzs8sxrjxfjjc\scratch-workspaces\98090040-f77b-41c3-bc4f-93f5d350e96d\8c14519e-8689-4b29-8f6c-77286182a39e\scratch-2026-11-03-b76e3a\assets\models"
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
JOBS = [(a.split(':')[0], int(a.split(':')[1]) if ':' in a else 90) for a in argv if not a.startswith('-')]
PREVIEW_ONLY = '--preview' in argv

def best_yaw(V, hint):
    P = V - V.mean(0); best, score = hint, -1
    for a in range(hint - 30, hint + 31, 3):
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
        R = np.stack([P[:, 0] * c - P[:, 1] * s, P[:, 0] * s + P[:, 1] * c, P[:, 2]], 1)
        q = lambda A: set(map(tuple, np.floor(A / 0.04).astype(int)))
        A, B = q(R), q(R * np.array([1, -1, 1]))
        sc = len(A & B) / len(A | B)
        if sc > score: best, score = a, sc
    return best

def measure(V):
    zmin, zmax = V[:, 2].min(), V[:, 2].max(); H = zmax - zmin
    Z = (V[:, 2] - zmin) / H; Y = V[:, 1] / H; X = V[:, 0] / H
    n = 50; width = np.zeros(n); gap = np.zeros(n, bool)
    for i in range(n):
        m = (Z >= i / n) & (Z < (i + 1) / n)
        if m.any(): width[i] = np.abs(Y[m]).max(); gap[i] = not (np.abs(Y[m]) < 0.03).any()
    i = 2
    while i < n * 0.45 and (gap[i] or gap[i + 1]): i += 1
    crotch = i / n if i > 4 else 0.3
    lo, hi = int(n * 0.5), int(n * 0.82)
    neck = (lo + int(np.argmin(width[lo:hi]))) / n
    sh_z = neck - 0.06; sh_y = width[int(sh_z * n)] * 0.8
    band = (Z > crotch - 0.15) & (Z < neck); wmax = np.abs(Y[band]).max()
    arm = band & (np.abs(Y) > wmax * 0.8)
    hand_z = Z[arm].min(); hand_y = np.abs(Y[arm & (Z < hand_z + 0.05)]).mean()
    leg = Z < crotch - 0.05
    return dict(H=float(H), zmin=float(zmin), crotch=float(crotch), neck=float(neck), sh_z=float(sh_z), sh_y=float(sh_y),
                hand_z=float(hand_z), hand_y=float(hand_y), leg_y=float(np.abs(Y[leg]).mean()), x=float(np.median(X[leg])))

def clear():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)
    for a in list(bpy.data.armatures): bpy.data.armatures.remove(a)
    for i in list(bpy.data.images): bpy.data.images.remove(i)

def rig(name, hint, tris):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, name + '.glb'))
    o = next(x for x in bpy.data.objects if x not in before and x.type == 'MESH')
    o.name = name
    bpy.context.view_layer.objects.active = o
    for x in bpy.context.selected_objects: x.select_set(False)
    o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005); bm.to_mesh(o.data); bm.free()
    t0 = sum(len(p.vertices) - 2 for p in o.data.polygons)
    md = o.modifiers.new('dec', 'DECIMATE'); md.ratio = min(1, tris / t0); bpy.ops.object.modifier_apply(modifier='dec')
    V = np.array([v.co[:] for v in o.data.vertices])
    yaw = best_yaw(V, hint)
    cs, sn = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    for v in o.data.vertices: v.co = Vector((v.co.x * cs - v.co.y * sn, v.co.x * sn + v.co.y * cs, v.co.z))
    V = np.array([v.co[:] for v in o.data.vertices])
    m = measure(V); m['yaw'] = yaw
    s = 1 / m['H']
    for v in o.data.vertices: v.co = Vector(((v.co.x - m['x'] * m['H']) * s, v.co.y * s, (v.co.z - m['zmin']) * s))
    o.data.update()
    arm = bpy.data.objects.new(name + '_arm', bpy.data.armatures.new(name + '_arm')); bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm; o.select_set(False); arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    def bone(n, a, b, parent=None, connect=False):
        e = arm.data.edit_bones.new(n); e.head = Vector(a); e.tail = Vector(b)
        if parent: e.parent = arm.data.edit_bones[parent]; e.use_connect = connect
    cr, nk, top = m['crotch'], m['neck'], 1.0
    waist = cr + (nk - cr) * 0.4; knee = cr * 0.52
    bone('hips', (0, 0, cr), (0, 0, waist)); bone('spine', (0, 0, waist), (0, 0, nk), 'hips', True); bone('head', (0, 0, nk), (0, 0, top * 0.95), 'spine', True)
    for sg, sd in ((1, 'L'), (-1, 'R')):
        el = ((m['sh_y'] + m['hand_y']) / 2, (m['sh_z'] + m['hand_z']) / 2)
        bone('arm_u.' + sd, (0, sg * m['sh_y'], m['sh_z']), (0, sg * el[0], el[1]), 'spine')
        bone('arm_l.' + sd, (0, sg * el[0], el[1]), (0.02, sg * m['hand_y'], m['hand_z']), 'arm_u.' + sd, True)
        bone('leg_u.' + sd, (0, sg * m['leg_y'], cr), (0, sg * m['leg_y'], knee), 'hips')
        bone('leg_l.' + sd, (0, sg * m['leg_y'], knee), (0.02, sg * m['leg_y'], 0), 'leg_u.' + sd, True)
    bpy.ops.object.mode_set(mode='OBJECT')
    o.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    un = sum(1 for v in o.data.vertices if not v.groups)
    print('RIG', name, 'tris', t0, '->', sum(len(p.vertices) - 2 for p in o.data.polygons), 'unweighted', un, json.dumps({k: round(v, 3) for k, v in m.items()}), flush=True)
    return o, arm

def pose(arm, p):
    for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = Quaternion()
    for k, deg in p.items():
        pb = arm.pose.bones[k]; ax = pb.bone.matrix_local.to_3x3().inverted() @ Vector((0, 1, 0))
        pb.rotation_quaternion = Quaternion(ax, math.radians(deg))

RUN = {'leg_u.L': -45, 'leg_l.L': 35, 'leg_u.R': 30, 'leg_l.R': 50, 'arm_u.L': 50, 'arm_l.L': -40, 'arm_u.R': -70, 'arm_l.R': -60, 'spine': 10, 'head': -6}

def export(o, arm, path, tex):
    for x in bpy.context.selected_objects: x.select_set(False)
    o.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    for n in o.data.materials[0].node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image and n.image.size[0] > tex: n.image.scale(tex, tex)
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format='GLB', export_yup=True,
                              export_animations=False, export_skins=True, export_image_format='JPEG', export_jpeg_quality=85)
    print('GLB', os.path.basename(path), os.path.getsize(path) // 1024, 'KB', flush=True)

def preview(made):
    sc = bpy.context.scene
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try: sc.render.engine = eng; break
        except TypeError: pass
    w = sc.world or bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs[0].default_value = (0.75, 0.78, 0.85, 1); bg.inputs[1].default_value = 1.6
    for nm, loc, e in (('key', (6, -4, 8), 4.0), ('fill', (6, 6, 4), 1.5)):
        d = bpy.data.lights.new(nm, 'SUN'); d.energy = e; ob = bpy.data.objects.new(nm, d); sc.collection.objects.link(ob)
        ob.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 85
    for i, (o, arm, name) in enumerate(made): arm.location = (0, (i - (len(made) - 1) / 2) * 0.9, 0)
    try: sc.view_settings.view_transform = 'Standard'
    except TypeError: pass
    for tag, p in (('rest', {}), ('run', RUN)):
        for o, arm, name in made: pose(arm, p)
        d = Vector((1, 0.35, 0.18)).normalized(); cam.location = Vector((0, 0, 0.5)) + d * (3.2 + len(made) * 1.1)
        cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        sc.render.resolution_x, sc.render.resolution_y = 400 * len(made), 520
        sc.render.filepath = os.path.join(PREV, f'rig_{tag}.png'); bpy.ops.render.render(write_still=True)
    for o, arm, name in made: pose(arm, {})

made = []
for lod in ([False] if PREVIEW_ONLY else [False, True]):
    clear(); made = []
    for name, hint in JOBS:
        o, arm = rig(name, hint, 1500 if lod else 5000)
        made.append((o, arm, name))
        if not PREVIEW_ONLY: export(o, arm, os.path.join(DST, name + ('_lod' if lod else '') + '.glb'), 256 if lod else 512)
    if not lod: preview(made)
