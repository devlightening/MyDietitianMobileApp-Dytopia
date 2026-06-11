from __future__ import annotations

import re
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory

import fitz
from docx import Document
from lxml import etree


W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
XML = "http://www.w3.org/XML/1998/namespace"
NS = {"w": W, "r": R}


def qn(tag: str) -> str:
    prefix, name = tag.split(":")
    return f"{{{ {'w': W, 'r': R}[prefix] }}}{name}"


def get_text(el: etree._Element) -> str:
    return "".join(el.xpath(".//w:t/text()", namespaces=NS)).strip()


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().rstrip(".")


def set_run_props(rpr: etree._Element) -> None:
    fonts = etree.SubElement(rpr, qn("w:rFonts"))
    for attr in ("ascii", "hAnsi", "cs", "eastAsia"):
        fonts.set(qn(f"w:{attr}"), "Times New Roman")
    sz = etree.SubElement(rpr, qn("w:sz"))
    sz.set(qn("w:val"), "24")
    szcs = etree.SubElement(rpr, qn("w:szCs"))
    szcs.set(qn("w:val"), "24")
    color = etree.SubElement(rpr, qn("w:color"))
    color.set(qn("w:val"), "000000")
    lang = etree.SubElement(rpr, qn("w:lang"))
    lang.set(qn("w:val"), "tr-TR")
    lang.set(qn("w:eastAsia"), "tr-TR")
    lang.set(qn("w:bidi"), "tr-TR")


def paragraph(text: str, style: str | None = None, align: str | None = None, bold: bool = False) -> etree._Element:
    p = etree.Element(qn("w:p"))
    ppr = etree.SubElement(p, qn("w:pPr"))
    if style:
        pstyle = etree.SubElement(ppr, qn("w:pStyle"))
        pstyle.set(qn("w:val"), style)
    if align:
        jc = etree.SubElement(ppr, qn("w:jc"))
        jc.set(qn("w:val"), align)
    spacing = etree.SubElement(ppr, qn("w:spacing"))
    spacing.set(qn("w:after"), "120")
    spacing.set(qn("w:line"), "360")
    spacing.set(qn("w:lineRule"), "auto")
    r = etree.SubElement(p, qn("w:r"))
    rpr = etree.SubElement(r, qn("w:rPr"))
    set_run_props(rpr)
    if bold:
        etree.SubElement(rpr, qn("w:b"))
        etree.SubElement(rpr, qn("w:bCs"))
    t = etree.SubElement(r, qn("w:t"))
    t.text = text
    return p


def list_line(label: str, page: int | str) -> etree._Element:
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

    r = etree.SubElement(p, qn("w:r"))
    rpr = etree.SubElement(r, qn("w:rPr"))
    set_run_props(rpr)
    t = etree.SubElement(r, qn("w:t"))
    t.text = label.rstrip(".")

    r = etree.SubElement(p, qn("w:r"))
    etree.SubElement(r, qn("w:tab"))

    r = etree.SubElement(p, qn("w:r"))
    rpr = etree.SubElement(r, qn("w:rPr"))
    set_run_props(rpr)
    t = etree.SubElement(r, qn("w:t"))
    t.text = str(page)
    return p


def page_break() -> etree._Element:
    p = etree.Element(qn("w:p"))
    r = etree.SubElement(p, qn("w:r"))
    br = etree.SubElement(r, qn("w:br"))
    br.set(qn("w:type"), "page")
    return p


def caption_lists_from_docx(docx_path: Path) -> tuple[list[str], list[str]]:
    doc = Document(docx_path)
    after_intro = False
    intro_label = "\u0047\u0130\u0052\u0130\u015e"
    tables: list[str] = []
    figures: list[str] = []
    for p in doc.paragraphs:
        text = p.text.strip()
        if text == intro_label:
            after_intro = True
        if not after_intro:
            continue
        if p.style.name == "TableCaption" and re.match(r"^Tablo\s+\d+\.\d+\.", text):
            tables.append(norm(text))
        elif p.style.name == "FigureCaption" and re.match(r"^Şekil\s+\d+\.\d+\.", text):
            figures.append(norm(text))
    return tables, figures


def caption_pages_from_pdf(pdf_path: Path, tables: list[str], figures: list[str]) -> tuple[dict[str, int], dict[str, int], int]:
    pdf = fitz.open(pdf_path)
    intro_index = None
    intro_label = "\u0047\u0130\u0052\u0130\u015e"
    page_texts: list[str] = []
    for i, page in enumerate(pdf):
        text = norm(page.get_text("text"))
        page_texts.append(text)
        lines = [line.strip() for line in page.get_text("text").splitlines()]
        if intro_index is None and intro_label in lines:
            intro_index = i
    if intro_index is None:
        raise RuntimeError("GİRİŞ page not found in PDF")

    def find_page(caption: str) -> int:
        needle = norm(caption)
        for i in range(intro_index, len(page_texts)):
            if needle in page_texts[i]:
                return i - intro_index + 1
        short = needle[:60]
        for i in range(intro_index, len(page_texts)):
            if short in page_texts[i]:
                return i - intro_index + 1
        raise RuntimeError(f"Caption not found in PDF: {caption}")

    return ({c: find_page(c) for c in tables}, {c: find_page(c) for c in figures}, len(pdf))


def toc_line(label: str, page: str, level: int) -> etree._Element:
    p = list_line(label, page)
    ppr = p.find(qn("w:pPr"))
    pstyle = etree.Element(qn("w:pStyle"))
    pstyle.set(qn("w:val"), f"TOC{level}")
    ppr.insert(0, pstyle)
    if level > 1:
        ind = etree.SubElement(ppr, qn("w:ind"))
        ind.set(qn("w:left"), str((level - 1) * 360))
    return p


def replace_para_text(p: etree._Element, text: str) -> None:
    for child in list(p):
        if etree.QName(child).localname != "pPr":
            p.remove(child)
    r = etree.SubElement(p, qn("w:r"))
    rpr = etree.SubElement(r, qn("w:rPr"))
    set_run_props(rpr)
    t = etree.SubElement(r, qn("w:t"))
    t.text = text


def patch_docx(docx_path: Path, tables: list[str], figures: list[str], table_pages: dict[str, int], figure_pages: dict[str, int]) -> None:
    with TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        with zipfile.ZipFile(docx_path) as z:
            z.extractall(tmp_path)

        document_xml = tmp_path / "word" / "document.xml"
        tree = etree.parse(str(document_xml))
        root = tree.getroot()
        body = root.find(qn("w:body"))

        # Convert the main TOC result to static, field-free lines and remove the stale appendix-list heading.
        toc_title_idx = toc_end_idx = None
        for idx, child in enumerate(body):
            if etree.QName(child).localname != "p":
                continue
            text = get_text(child)
            if text == "İÇİNDEKİLER":
                toc_title_idx = idx
            elif toc_title_idx is not None and text == "TABLOLAR LİSTESİ":
                toc_end_idx = idx
                break
        if toc_title_idx is not None and toc_end_idx is not None:
            idx = toc_title_idx + 1
            while idx < toc_end_idx:
                p = body[idx]
                text = get_text(p)
                style = p.xpath("./w:pPr/w:pStyle/@w:val", namespaces=NS)
                style_id = style[0] if style else ""
                is_toc_result = style_id in {"T1", "T2", "T3", "TOC1", "TOC2", "TOC3"}
                texts = p.xpath(".//w:t/text()", namespaces=NS)
                label = page = None
                if is_toc_result and len(texts) >= 2:
                    page = texts[-1].strip()
                    label = "".join(texts[:-1]).strip()
                elif "\t" in text:
                    label, page = text.rsplit("\t", 1)

                if label and label.startswith("EKLER LİSTESİ"):
                    body.remove(p)
                    toc_end_idx -= 1
                    continue
                if label and page:
                    level_match = re.search(r"(\d+)$", style_id)
                    level = int(level_match.group(1)) if level_match else 1
                    body.remove(p)
                    body.insert(idx, toc_line(label, page, level))
                idx += 1

        # Restore the student name in the ethics signature block.
        prev = ""
        for p in body.xpath("./w:p", namespaces=NS):
            text = get_text(p)
            if prev == "İMZA" and text == "Adı Soyadı":
                replace_para_text(p, "Halil İbrahim YILDIRIM")
                break
            if text:
                prev = text

        # Remove hidden TC helper fields from captions; static lists no longer need them.
        for p in body.xpath(".//w:p", namespaces=NS):
            for r in list(p.xpath("./w:r[w:instrText[contains(., ' TC ')] or w:fldChar]", namespaces=NS)):
                p.remove(r)

        start_idx = giris_idx = None
        for idx, child in enumerate(body):
            if etree.QName(child).localname != "p":
                continue
            text = get_text(child)
            if text == "TABLOLAR LİSTESİ" and start_idx is None:
                start_idx = idx
            elif start_idx is not None and text == "GİRİŞ":
                giris_idx = idx
                break
        if start_idx is None or giris_idx is None:
            raise RuntimeError("Could not locate TABLOLAR LİSTESİ to GİRİŞ block")

        sect_p = None
        for child in body[start_idx:giris_idx]:
            if etree.QName(child).localname == "p" and child.xpath("./w:pPr/w:sectPr", namespaces=NS):
                sect_p = etree.fromstring(etree.tostring(child))
                replace_para_text(sect_p, "")
                break
        if sect_p is None:
            sect_p = paragraph("")

        new_block: list[etree._Element] = [
            paragraph("TABLOLAR LİSTESİ", "Balk1", "center", bold=True),
            paragraph("Sayfa", None, "right"),
        ]
        new_block.extend(list_line(c, table_pages[c]) for c in tables)
        new_block.append(page_break())
        new_block.extend([paragraph("ŞEKİLLER LİSTESİ", "Balk1", "center", bold=True), paragraph("Sayfa", None, "right")])
        new_block.extend(list_line(c, figure_pages[c]) for c in figures)
        new_block.append(sect_p)

        for _ in range(giris_idx - start_idx):
            body.remove(body[start_idx])
        for offset, el in enumerate(new_block):
            body.insert(start_idx + offset, el)

        tree.write(str(document_xml), encoding="UTF-8", xml_declaration=True, standalone=True)

        settings_xml = tmp_path / "word" / "settings.xml"
        settings_tree = etree.parse(str(settings_xml))
        settings_root = settings_tree.getroot()
        for upd in settings_root.xpath("./w:updateFields", namespaces=NS):
            upd.set(qn("w:val"), "false")
        settings_tree.write(str(settings_xml), encoding="UTF-8", xml_declaration=True, standalone=True)

        tmp_out = docx_path.with_suffix(".patched.tmp.docx")
        if tmp_out.exists():
            tmp_out.unlink()
        with zipfile.ZipFile(tmp_out, "w", zipfile.ZIP_DEFLATED) as z:
            for item in tmp_path.rglob("*"):
                if item.is_file():
                    z.write(item, item.relative_to(tmp_path).as_posix())
        tmp_out.replace(docx_path)


if __name__ == "__main__":
    docx = Path(r"C:\Users\hy971\source\repos\MyDietitianMobileApp\Dytopia_Bitirme_Tezi_TarsusUni_Final_Teknik_Kusursuz.docx")
    pdf = Path(r"C:\Users\hy971\source\repos\MyDietitianMobileApp\Dytopia_Bitirme_Tezi_TarsusUni_Final_Teknik_Kusursuz.pdf")
    table_captions, figure_captions = caption_lists_from_docx(docx)
    table_pages, figure_pages, page_count = caption_pages_from_pdf(pdf, table_captions, figure_captions)
    patch_docx(docx, table_captions, figure_captions, table_pages, figure_pages)
    print(f"patched static lists; pages={page_count}; tables={len(table_captions)}; figures={len(figure_captions)}")
