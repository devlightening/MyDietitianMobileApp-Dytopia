from __future__ import annotations

from pathlib import Path

import fitz
from PIL import Image, ImageDraw, ImageFont


PDF = Path(r"C:\Users\hy971\source\repos\MyDietitianMobileApp\Dytopia_Bitirme_Tezi_TarsusUni_Final_Teknik_Kusursuz.pdf")
OUT = Path(r"C:\Users\hy971\source\repos\MyDietitianMobileApp\qa_rendered_pages")


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for old in OUT.glob("page-*.png"):
        old.unlink()
    for old in OUT.glob("contact-*.png"):
        old.unlink()

    doc = fitz.open(PDF)
    zoom = 2.0
    mat = fitz.Matrix(zoom, zoom)
    rendered: list[Path] = []
    for i, page in enumerate(doc, start=1):
        pix = page.get_pixmap(matrix=mat, alpha=False)
        path = OUT / f"page-{i:03d}.png"
        pix.save(path)
        rendered.append(path)

    thumbs = []
    for path in rendered:
        img = Image.open(path).convert("RGB")
        img.thumbnail((240, 340))
        thumbs.append((path, img.copy()))

    sheet_w = 4 * 300
    sheet_h = 4 * 390
    for sheet_idx in range(0, len(thumbs), 16):
        sheet = Image.new("RGB", (sheet_w, sheet_h), "white")
        draw = ImageDraw.Draw(sheet)
        for local_idx, (path, img) in enumerate(thumbs[sheet_idx : sheet_idx + 16]):
            row, col = divmod(local_idx, 4)
            x = col * 300 + 30
            y = row * 390 + 30
            sheet.paste(img, (x, y))
            draw.text((x, y + img.height + 8), path.stem, fill=(0, 0, 0))
        sheet.save(OUT / f"contact-{sheet_idx // 16 + 1:02d}.png")

    print(f"rendered={len(rendered)} out={OUT}")


if __name__ == "__main__":
    main()
