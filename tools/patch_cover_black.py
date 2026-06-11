from __future__ import annotations

import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory

from lxml import etree


DOCX = Path(r"C:\Users\hy971\source\repos\MyDietitianMobileApp\Dytopia_Bitirme_Tezi_TarsusUni_Final_Teknik_Kusursuz.docx")
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W}


def qn(tag: str) -> str:
    prefix, name = tag.split(":")
    return f"{{{ {'w': W}[prefix] }}}{name}"


def text(el: etree._Element) -> str:
    return "".join(el.xpath(".//w:t/text()", namespaces=NS)).strip()


def main() -> None:
    with TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        with zipfile.ZipFile(DOCX) as z:
            z.extractall(tmp_path)

        document_xml = tmp_path / "word" / "document.xml"
        tree = etree.parse(str(document_xml))
        root = tree.getroot()
        body = root.find(qn("w:body"))

        # Remove image-only cover decoration/background paragraphs before the first visible text.
        while len(body) and etree.QName(body[0]).localname == "p" and not text(body[0]) and body[0].xpath(".//w:drawing|.//w:pict", namespaces=NS):
            body.remove(body[0])

        for color in root.xpath(".//w:color[@w:val='FFFFFF']", namespaces=NS):
            color.set(qn("w:val"), "000000")

        first_tarsus = None
        for idx, child in enumerate(body):
            if etree.QName(child).localname == "p" and text(child) == "TARSUS - 2026":
                first_tarsus = idx
                break
        if first_tarsus is not None:
            target = body[first_tarsus + 1] if first_tarsus + 1 < len(body) and etree.QName(body[first_tarsus + 1]).localname == "p" else None
            if target is None:
                target = etree.Element(qn("w:p"))
                body.insert(first_tarsus + 1, target)
            if not target.xpath(".//w:br[@w:type='page']", namespaces=NS):
                r = etree.SubElement(target, qn("w:r"))
                br = etree.SubElement(r, qn("w:br"))
                br.set(qn("w:type"), "page")

        tree.write(str(document_xml), encoding="UTF-8", xml_declaration=True, standalone=True)

        tmp_out = DOCX.with_suffix(".cover.tmp.docx")
        if tmp_out.exists():
            tmp_out.unlink()
        with zipfile.ZipFile(tmp_out, "w", zipfile.ZIP_DEFLATED) as z:
            for item in tmp_path.rglob("*"):
                if item.is_file():
                    z.write(item, item.relative_to(tmp_path).as_posix())
        tmp_out.replace(DOCX)

    print("cover patched")


if __name__ == "__main__":
    main()
