from __future__ import annotations

import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory

from lxml import etree


DOCX = Path(r"C:\Users\hy971\source\repos\MyDietitianMobileApp\Last_Dytopia_Bitirme_Tezi_TarsusUni_Final_Teknik_Kusursuz_v2.docx")
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W}


def qn(tag: str) -> str:
    prefix, name = tag.split(":")
    return f"{{{ {'w': W}[prefix] }}}{name}"


def ensure(parent: etree._Element, tag: str, first: bool = False) -> etree._Element:
    child = parent.find(qn(tag))
    if child is None:
        child = etree.Element(qn(tag))
        if first:
            parent.insert(0, child)
        else:
            parent.append(child)
    return child


def text(p: etree._Element) -> str:
    return "".join(p.xpath(".//w:t/text()", namespaces=NS)).strip()


def set_run_props(rpr: etree._Element, bold: bool = False) -> None:
    fonts = ensure(rpr, "w:rFonts", first=True)
    for attr in ("ascii", "hAnsi", "cs", "eastAsia"):
        fonts.set(qn(f"w:{attr}"), "Times New Roman")
    for tag in ("w:sz", "w:szCs"):
        node = ensure(rpr, tag)
        node.set(qn("w:val"), "24")
    color = ensure(rpr, "w:color")
    color.set(qn("w:val"), "000000")
    for tag in ("w:i", "w:iCs", "w:u"):
        for node in rpr.findall(qn(tag)):
            rpr.remove(node)
    if bold:
        ensure(rpr, "w:b")
        ensure(rpr, "w:bCs")


def tabbed_line(label: str, page: str) -> etree._Element:
    p = etree.Element(qn("w:p"))
    ppr = etree.SubElement(p, qn("w:pPr"))
    tabs = etree.SubElement(ppr, qn("w:tabs"))
    tab = etree.SubElement(tabs, qn("w:tab"))
    tab.set(qn("w:val"), "right")
    tab.set(qn("w:leader"), "dot")
    tab.set(qn("w:pos"), "9000")
    spacing = etree.SubElement(ppr, qn("w:spacing"))
    spacing.set(qn("w:after"), "60")
    spacing.set(qn("w:line"), "360")
    spacing.set(qn("w:lineRule"), "auto")
    for value, is_tab in ((label, False), ("", True), (page, False)):
        r = etree.SubElement(p, qn("w:r"))
        rpr = etree.SubElement(r, qn("w:rPr"))
        set_run_props(rpr)
        if is_tab:
            etree.SubElement(r, qn("w:tab"))
        else:
            t = etree.SubElement(r, qn("w:t"))
            t.text = value
    return p


def main() -> None:
    with TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        with zipfile.ZipFile(DOCX) as z:
            z.extractall(tmp_path)

        for xml_path in [tmp_path / "word" / "document.xml", *sorted((tmp_path / "word").glob("footer*.xml")), *sorted((tmp_path / "word").glob("header*.xml"))]:
            if not xml_path.exists():
                continue
            tree = etree.parse(str(xml_path))
            root = tree.getroot()
            for r in root.xpath(".//w:r", namespaces=NS):
                rpr = ensure(r, "w:rPr", first=True)
                set_run_props(rpr)
            for color in root.xpath(".//w:color", namespaces=NS):
                color.set(qn("w:val"), "000000")
            tree.write(str(xml_path), encoding="UTF-8", xml_declaration=True, standalone=True)

        document_xml = tmp_path / "word" / "document.xml"
        tree = etree.parse(str(document_xml))
        root = tree.getroot()
        body = root.find(qn("w:body"))
        in_toc = False
        for idx, child in enumerate(list(body)):
            if etree.QName(child).localname != "p":
                continue
            value = text(child)
            if value == "İÇİNDEKİLER":
                in_toc = True
                continue
            if in_toc and value == "KISALTMALAR":
                break
            normalized = value.replace("\t", "")
            if normalized == "TABLOLAR LİSTESİxi":
                body.remove(child)
                body.insert(idx, tabbed_line("TABLOLAR LİSTESİ", "xi"))
            elif normalized == "ŞEKİLLER LİSTESİxii":
                body.remove(child)
                body.insert(idx, tabbed_line("ŞEKİLLER LİSTESİ", "xii"))
        tree.write(str(document_xml), encoding="UTF-8", xml_declaration=True, standalone=True)

        tmp_out = DOCX.with_suffix(".post.tmp.docx")
        if tmp_out.exists():
            tmp_out.unlink()
        with zipfile.ZipFile(tmp_out, "w", zipfile.ZIP_DEFLATED) as z:
            for item in tmp_path.rglob("*"):
                if item.is_file():
                    z.write(item, item.relative_to(tmp_path).as_posix())
        tmp_out.replace(DOCX)
    print("post_word_fix_ok")


if __name__ == "__main__":
    main()
