"""Export the currently opened, hand-edited pen .blend to the game GLB.

Run without rebuilding the model:
  blender --background assets/models/three-color-pen.blend --python tools/export_pen.py
"""
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "models" / "three-color-pen.glb"

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=str(OUTPUT),
    export_format="GLB",
    use_selection=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
    export_apply=True,
)
print(f"Exported edited Blender source to {OUTPUT}")
