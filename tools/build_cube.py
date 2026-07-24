from __future__ import annotations

import json
import struct
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r"D:\ユーザー\DigiEggMan\デスクトップ\絶滅脱出ver2\絶滅脱出_認証コード解読機ボックス_テクスチャ用.png")
ASSETS = ROOT / "assets"
TEXTURE_PATH = ASSETS / "authentication-box-atlas.png"
MODEL_PATH = ASSETS / "authentication-box.glb"


def build_atlas() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    # 展開図の各700pxセルから黒い区切り線を除いて切り出す。
    cells = {
        "front": (700, 700),
        "right": (1400, 700),
        "back": (700, 2100),
        "left": (0, 700),
        "top": (700, 0),
        "bottom": (700, 1400),
    }
    order = ["front", "right", "back", "left", "top", "bottom"]
    # WebGL 1でもミップマップを使える2の累乗サイズにする。
    atlas = Image.new("RGBA", (2048, 1024), (255, 255, 255, 255))
    inset = 14
    for index, name in enumerate(order):
        x, y = cells[name]
        face = source.crop((x + inset, y + inset, x + 700 - inset, y + 700 - inset))
        # 黄色い正面の反対側だけ、テクスチャを180度回転する。
        if name == "back":
            face = face.transpose(Image.Transpose.ROTATE_180)
        face = face.resize((512, 512), Image.Resampling.LANCZOS)
        atlas.paste(face, ((index % 3) * 512, (index // 3) * 512))
    atlas.save(TEXTURE_PATH, optimize=True)


def pack_floats(values: list[float]) -> bytes:
    return struct.pack("<" + "f" * len(values), *values)


def build_glb() -> None:
    positions: list[float] = []
    normals: list[float] = []
    uvs: list[float] = []
    indices: list[int] = []

    faces = [
        # front, right, back, left, top, bottom
        ([(-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)], (0, 0, 1)),
        ([(1, -1, 1), (1, -1, -1), (1, 1, -1), (1, 1, 1)], (1, 0, 0)),
        ([(1, -1, -1), (-1, -1, -1), (-1, 1, -1), (1, 1, -1)], (0, 0, -1)),
        ([(-1, -1, -1), (-1, -1, 1), (-1, 1, 1), (-1, 1, -1)], (-1, 0, 0)),
        ([(-1, 1, 1), (1, 1, 1), (1, 1, -1), (-1, 1, -1)], (0, 1, 0)),
        ([(-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1)], (0, -1, 0)),
    ]
    for face_index, (corners, normal) in enumerate(faces):
        col, row = face_index % 3, face_index // 3
        u0, u1 = col / 4, (col + 1) / 4
        v0, v1 = row / 2, (row + 1) / 2
        face_uvs = [(u0, v1), (u1, v1), (u1, v0), (u0, v0)]
        base = len(positions) // 3
        for corner, uv in zip(corners, face_uvs):
            positions.extend(corner)
            normals.extend(normal)
            uvs.extend(uv)
        indices.extend([base, base + 1, base + 2, base, base + 2, base + 3])

    chunks: list[bytes] = []
    views: list[dict] = []

    def add_view(data: bytes, target: int | None = None) -> int:
        offset = sum(len(chunk) for chunk in chunks)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target is not None:
            view["target"] = target
        views.append(view)
        chunks.append(data + b"\x00" * ((-len(data)) % 4))
        return len(views) - 1

    position_view = add_view(pack_floats(positions), 34962)
    normal_view = add_view(pack_floats(normals), 34962)
    uv_view = add_view(pack_floats(uvs), 34962)
    index_view = add_view(struct.pack("<" + "H" * len(indices), *indices), 34963)
    image_view = add_view(TEXTURE_PATH.read_bytes())
    binary = b"".join(chunks)

    document = {
        "asset": {"version": "2.0", "generator": "Codex authentication-box prototype"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "AuthenticationBox"}],
        "meshes": [{"name": "AuthenticationBox", "primitives": [{
            "attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2},
            "indices": 3,
            "material": 0,
        }]}],
        "materials": [{
            "name": "BoxTexture",
            "pbrMetallicRoughness": {
                "baseColorTexture": {"index": 0},
                "metallicFactor": 0.0,
                "roughnessFactor": 0.72,
            },
        }],
        "textures": [{"sampler": 0, "source": 0}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "images": [{"bufferView": image_view, "mimeType": "image/png", "name": "BoxAtlas"}],
        "accessors": [
            {"bufferView": position_view, "componentType": 5126, "count": 24, "type": "VEC3", "min": [-1, -1, -1], "max": [1, 1, 1]},
            {"bufferView": normal_view, "componentType": 5126, "count": 24, "type": "VEC3"},
            {"bufferView": uv_view, "componentType": 5126, "count": 24, "type": "VEC2", "min": [0, 0], "max": [1, 1]},
            {"bufferView": index_view, "componentType": 5123, "count": 36, "type": "SCALAR", "min": [0], "max": [23]},
        ],
        "bufferViews": views,
        "buffers": [{"byteLength": len(binary)}],
    }
    json_chunk = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    json_chunk += b" " * ((-len(json_chunk)) % 4)
    total_length = 12 + 8 + len(json_chunk) + 8 + len(binary)
    glb = (
        struct.pack("<4sII", b"glTF", 2, total_length)
        + struct.pack("<I4s", len(json_chunk), b"JSON") + json_chunk
        + struct.pack("<I4s", len(binary), b"BIN\x00") + binary
    )
    MODEL_PATH.write_bytes(glb)


if __name__ == "__main__":
    ASSETS.mkdir(exist_ok=True)
    build_atlas()
    build_glb()
    print(f"Created {TEXTURE_PATH.relative_to(ROOT)}")
    print(f"Created {MODEL_PATH.relative_to(ROOT)}")
