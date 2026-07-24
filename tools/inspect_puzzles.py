from pathlib import Path

from pypdf import PdfReader


BASE = Path(r"D:\ユーザー\DigiEggMan\デスクトップ\絶滅脱出ver2\PDF")
NAMES = [
    "絶滅脱出_1_2_小謎_AB.pdf",
    "絶滅脱出_1_3_小謎_CD.pdf",
    "絶滅脱出_1_4_小謎_EG.pdf",
    "絶滅脱出_1_4_小謎_F12.pdf",
    "絶滅脱出_1_5_解答欄.pdf",
]

for name in NAMES:
    reader = PdfReader(BASE / name)
    print(f"=== {name} / {len(reader.pages)} pages ===")
    for index, page in enumerate(reader.pages):
        width = float(page.mediabox.width)
        height = float(page.mediabox.height)
        text = (page.extract_text() or "")[:3000]
        print(f"-- page {index + 1} {width:.0f}x{height:.0f} --\n{text}")
