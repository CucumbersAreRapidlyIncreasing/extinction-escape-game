"""Build the three-colour puzzle pen in Blender and export .blend + .glb.

Run with:
  blender --background --python tools/build_pen.py

Dimensions are in metres and follow the supplied orthographic reference.  The
only inferred measurement is overall length (145 mm), chosen to match a common
three-colour retractable ballpoint pen.
"""
from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "assets" / "models"
BLEND_PATH = MODEL_DIR / "three-color-pen.blend"
GLB_PATH = MODEL_DIR / "three-color-pen.glb"


def material(name, rgba, metallic=0.0, roughness=0.35):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = rgba
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def finish(obj, mat, bevel=0.00025, smooth=True):
    obj.data.materials.append(mat)
    if smooth:
        for poly in obj.data.polygons:
            poly.use_smooth = True
    if bevel:
        mod = obj.modifiers.new("Micro bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    return obj


def cylinder(name, radius, depth, z, mat, vertices=64, bevel=0.0002):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(0, 0, z))
    obj = bpy.context.object
    obj.name = name
    return finish(obj, mat, bevel)


def lathe(name, profile, mat, segments=96):
    verts, faces = [], []
    for z, radius in profile:
        for i in range(segments):
            a = math.tau * i / segments
            verts.append((radius * math.cos(a), radius * math.sin(a), z))
    for ring in range(len(profile) - 1):
        for i in range(segments):
            j = (i + 1) % segments
            a, b = ring * segments + i, ring * segments + j
            c, d = (ring + 1) * segments + j, (ring + 1) * segments + i
            faces.append((a, b, c, d))
    faces.append(tuple(reversed(range(segments))))
    top = (len(profile) - 1) * segments
    faces.append(tuple(top + i for i in range(segments)))
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj, mat, 0.00012)


def rounded_box(name, size, location, mat, rotation_z=0.0, bevel=0.0007):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=(0, 0, rotation_z))
    obj = bpy.context.object
    obj.name = name
    obj.scale = Vector(size) / 2
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, mat, bevel, smooth=False)


def torus(name, major, minor, z, mat):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=72, minor_segments=12, location=(0, 0, z))
    obj = bpy.context.object
    obj.name = name
    return finish(obj, mat, 0.00008)


def clip_curve(mat):
    curve = bpy.data.curves.new("Clip_Profile", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 16
    curve.bevel_depth = 0.00115
    curve.bevel_resolution = 5
    spline = curve.splines.new("BEZIER")
    points = [
        (0, 0.0050, 0.0680), (0, 0.0075, 0.0605),
        (0, 0.0081, 0.0470), (0, 0.0077, 0.0335),
        (0, 0.0072, 0.0245), (0, 0.0062, 0.0215),
    ]
    spline.bezier_points.add(len(points) - 1)
    for bp, co in zip(spline.bezier_points, points):
        bp.co = co
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    obj = bpy.data.objects.new("Clip", curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    rounded_box("Clip_Base", (0.0050, 0.0024, 0.0085), (0, 0.0054, 0.0638), mat, bevel=0.0012)
    return obj


def lever(name, angle_deg, mat):
    angle = math.radians(angle_deg)
    radius = 0.0062
    x, y = radius * math.sin(angle), radius * math.cos(angle)
    obj = rounded_box(name, (0.0040, 0.0027, 0.0175), (x, y, 0.0620), mat, rotation_z=-angle, bevel=0.00115)
    obj["puzzle_part"] = "selector_lever"
    obj["ink"] = name.removeprefix("Lever_").lower()
    return obj


def build():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)

    white = material("Warm white ABS", (0.91, 0.92, 0.90, 1), roughness=0.27)
    white_side = material("Soft grip white", (0.80, 0.82, 0.80, 1), roughness=0.42)
    seam = material("Mechanism shadow", (0.055, 0.060, 0.060, 1), roughness=0.32)
    metal = material("Polished steel", (0.42, 0.46, 0.48, 1), metallic=0.92, roughness=0.16)
    red = material("Red selector", (0.82, 0.018, 0.012, 1), roughness=0.24)
    blue = material("Blue selector", (0.018, 0.16, 0.78, 1), roughness=0.23)
    black = material("Black selector", (0.012, 0.014, 0.015, 1), roughness=0.22)

    # 145 mm overall: tip -72.5 mm to rear button +72.5 mm.
    lathe("Lower_Body", [
        (-0.0685, 0.00125), (-0.0672, 0.00235), (-0.0640, 0.00415),
        (-0.0590, 0.00525), (-0.0510, 0.00555), (-0.0260, 0.00555),
        (-0.0242, 0.00540),
    ], white_side)
    cylinder("Main_Barrel", 0.00538, 0.0825, 0.0170, white, bevel=0.00033)
    cylinder("Selector_Housing", 0.00585, 0.0180, 0.0588, white, bevel=0.00048)
    cylinder("Rear_Plunger", 0.00325, 0.0100, 0.0675, white, bevel=0.00055)
    torus("Barrel_Seam", 0.00535, 0.00012, -0.0244, seam)
    torus("Housing_Seam", 0.00562, 0.00011, 0.0500, seam)

    # Conical stainless writing tip and the tiny ballpoint nib.
    lathe("Metal_Tip", [(-0.0725, 0.00034), (-0.0716, 0.00058), (-0.0688, 0.00128), (-0.0679, 0.00136)], metal, 64)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=0.00036, location=(0, 0, -0.07255))
    nib = bpy.context.object
    nib.name = "Ballpoint_Nib"
    finish(nib, metal, 0)

    # Small barrel-joint rings add the characteristic manufactured detail.
    for index, z in enumerate((-0.0250, -0.02455, -0.0241)):
        torus(f"Grip_Ring_{index+1}", 0.00530, 0.00010, z, seam)

    clip_curve(white)
    # Rear-view order from the reference: clip 0°, red 45°, blue 180°, black 325°.
    lever("Lever_Red", 45, red)
    lever("Lever_Blue", 180, blue)
    lever("Lever_Black", 325, black)

    # Shallow slots beneath each lever remain visible around its edges.
    for name, angle_deg in (("Red", 45), ("Blue", 180), ("Black", 325)):
        a = math.radians(angle_deg)
        rounded_box(f"Slot_{name}", (0.00445, 0.00065, 0.0184),
                    (0.0060 * math.sin(a), 0.0060 * math.cos(a), 0.0619),
                    seam, rotation_z=-a, bevel=0.0007)

    # Organised collections make the .blend useful as an editable source asset.
    body_collection = bpy.data.collections.new("PEN_BODY")
    mechanism_collection = bpy.data.collections.new("SELECTOR_MECHANISM")
    bpy.context.scene.collection.children.link(body_collection)
    bpy.context.scene.collection.children.link(mechanism_collection)
    for obj in list(bpy.context.scene.collection.objects):
        target = mechanism_collection if obj.name.startswith(("Lever_", "Slot_")) else body_collection
        for collection in list(obj.users_collection):
            collection.objects.unlink(obj)
        target.objects.link(obj)

    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "MILLIMETERS"
    scene.render.engine = "BLENDER_EEVEE"
    scene["reference"] = "ChatGPT Image 2026年7月24日 13_22_04.png"
    scene["design_note"] = "145 mm inferred overall length; lever angles copied from supplied orthographic drawing"

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH), export_format="GLB", use_selection=True,
        export_materials="EXPORT", export_cameras=False, export_lights=False,
        export_apply=True,
    )
    print(f"Saved {BLEND_PATH}")
    print(f"Exported {GLB_PATH}")


if __name__ == "__main__":
    build()
