from __future__ import annotations

import re
import shutil
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory

from lxml import etree


W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
V = "urn:schemas-microsoft-com:vml"
XML = "http://www.w3.org/XML/1998/namespace"

NS = {"w": W, "r": R, "a": A, "wp": WP, "v": V}


def qn(tag: str) -> str:
    prefix, name = tag.split(":")
    return f"{{{ {'w': W, 'r': R, 'a': A, 'wp': WP, 'v': V}[prefix] }}}{name}"


def ensure(parent: etree._Element, tag: str, first: bool = False) -> etree._Element:
    child = parent.find(qn(tag))
    if child is None:
        child = etree.Element(qn(tag))
        if first:
            parent.insert(0, child)
        else:
            parent.append(child)
    return child


def remove_children(parent: etree._Element, local_names: set[str]) -> None:
    for child in list(parent):
        if etree.QName(child).localname in local_names:
            parent.remove(child)


def set_run_props(rpr: etree._Element, *, bold: bool | None = None) -> None:
    fonts = ensure(rpr, "w:rFonts", first=True)
    for attr in ("ascii", "hAnsi", "cs", "eastAsia"):
        fonts.set(qn(f"w:{attr}"), "Times New Roman")
    sz = ensure(rpr, "w:sz")
    sz.set(qn("w:val"), "24")
    szcs = ensure(rpr, "w:szCs")
    szcs.set(qn("w:val"), "24")
    color = ensure(rpr, "w:color")
    color.set(qn("w:val"), "000000")
    lang = ensure(rpr, "w:lang")
    lang.set(qn("w:val"), "tr-TR")
    lang.set(qn("w:eastAsia"), "tr-TR")
    lang.set(qn("w:bidi"), "tr-TR")
    remove_children(
        rpr,
        {
            "i",
            "iCs",
            "u",
            "highlight",
            "shd",
            "em",
            "smallCaps",
            "caps",
            "strike",
            "dstrike",
        },
    )
    if bold is True:
        ensure(rpr, "w:b")
        ensure(rpr, "w:bCs")


def set_para_style(p: etree._Element, style_id: str) -> None:
    ppr = ensure(p, "w:pPr", first=True)
    pstyle = ppr.find(qn("w:pStyle"))
    if pstyle is None:
        pstyle = etree.Element(qn("w:pStyle"))
        ppr.insert(0, pstyle)
    pstyle.set(qn("w:val"), style_id)


def get_para_text(p: etree._Element) -> str:
    return "".join(p.xpath(".//w:t/text()", namespaces=NS)).strip()


def set_para_text(p: etree._Element, text: str) -> None:
    for child in list(p):
        if etree.QName(child).localname != "pPr":
            p.remove(child)
    r = etree.SubElement(p, qn("w:r"))
    rpr = etree.SubElement(r, qn("w:rPr"))
    set_run_props(rpr)
    t = etree.SubElement(r, qn("w:t"))
    t.text = text


def add_bool_ppr(p: etree._Element, tag: str) -> None:
    ppr = ensure(p, "w:pPr", first=True)
    if ppr.find(qn(tag)) is None:
        ppr.append(etree.Element(qn(tag)))


def set_alignment(p: etree._Element, val: str) -> None:
    ppr = ensure(p, "w:pPr", first=True)
    jc = ensure(ppr, "w:jc")
    jc.set(qn("w:val"), val)


def set_spacing(p: etree._Element, *, before: int = 0, after: int = 120, line: int = 360) -> None:
    ppr = ensure(p, "w:pPr", first=True)
    spacing = ensure(ppr, "w:spacing")
    spacing.set(qn("w:before"), str(before))
    spacing.set(qn("w:after"), str(after))
    spacing.set(qn("w:line"), str(line))
    spacing.set(qn("w:lineRule"), "auto")


def paragraph(text: str = "", style: str | None = None, align: str | None = None, bold: bool = False) -> etree._Element:
    p = etree.Element(qn("w:p"))
    ppr = etree.SubElement(p, qn("w:pPr"))
    if style:
        pstyle = etree.SubElement(ppr, qn("w:pStyle"))
        pstyle.set(qn("w:val"), style)
    if align:
        jc = etree.SubElement(ppr, qn("w:jc"))
        jc.set(qn("w:val"), align)
    r = etree.SubElement(p, qn("w:r"))
    rpr = etree.SubElement(r, qn("w:rPr"))
    set_run_props(rpr, bold=bold)
    t = etree.SubElement(r, qn("w:t"))
    t.text = text
    return p


def page_break_paragraph() -> etree._Element:
    p = etree.Element(qn("w:p"))
    r = etree.SubElement(p, qn("w:r"))
    br = etree.SubElement(r, qn("w:br"))
    br.set(qn("w:type"), "page")
    return p


def field_paragraph(instr: str) -> etree._Element:
    p = etree.Element(qn("w:p"))
    ppr = etree.SubElement(p, qn("w:pPr"))
    spacing = etree.SubElement(ppr, qn("w:spacing"))
    spacing.set(qn("w:after"), "120")

    r = etree.SubElement(p, qn("w:r"))
    fld = etree.SubElement(r, qn("w:fldChar"))
    fld.set(qn("w:fldCharType"), "begin")

    r = etree.SubElement(p, qn("w:r"))
    instr_text = etree.SubElement(r, qn("w:instrText"))
    instr_text.set(f"{{{XML}}}space", "preserve")
    instr_text.text = f" {instr} "

    r = etree.SubElement(p, qn("w:r"))
    fld = etree.SubElement(r, qn("w:fldChar"))
    fld.set(qn("w:fldCharType"), "separate")

    r = etree.SubElement(p, qn("w:r"))
    t = etree.SubElement(r, qn("w:t"))
    t.text = "Alan güncelleniyor..."

    r = etree.SubElement(p, qn("w:r"))
    fld = etree.SubElement(r, qn("w:fldChar"))
    fld.set(qn("w:fldCharType"), "end")
    return p


def add_tc_field(p: etree._Element, caption_text: str, table_id: str) -> None:
    instr = f' TC "{caption_text.replace(chr(34), chr(39))}" \\f {table_id} \\l 1 '
    r = etree.SubElement(p, qn("w:r"))
    rpr = etree.SubElement(r, qn("w:rPr"))
    set_run_props(rpr)
    etree.SubElement(rpr, qn("w:vanish"))
    fld = etree.SubElement(r, qn("w:fldChar"))
    fld.set(qn("w:fldCharType"), "begin")

    r = etree.SubElement(p, qn("w:r"))
    rpr = etree.SubElement(r, qn("w:rPr"))
    set_run_props(rpr)
    etree.SubElement(rpr, qn("w:vanish"))
    instr_text = etree.SubElement(r, qn("w:instrText"))
    instr_text.set(f"{{{XML}}}space", "preserve")
    instr_text.text = instr

    r = etree.SubElement(p, qn("w:r"))
    rpr = etree.SubElement(r, qn("w:rPr"))
    set_run_props(rpr)
    etree.SubElement(rpr, qn("w:vanish"))
    fld = etree.SubElement(r, qn("w:fldChar"))
    fld.set(qn("w:fldCharType"), "end")


def page_field_footer(blank: bool = False) -> etree._Element:
    root = etree.Element(qn("w:ftr"), nsmap={"w": W, "r": R})
    p = etree.SubElement(root, qn("w:p"))
    ppr = etree.SubElement(p, qn("w:pPr"))
    jc = etree.SubElement(ppr, qn("w:jc"))
    jc.set(qn("w:val"), "center")
    if blank:
        return root
    fld = etree.SubElement(p, qn("w:fldSimple"))
    fld.set(qn("w:instr"), "PAGE")
    r = etree.SubElement(fld, qn("w:r"))
    rpr = etree.SubElement(r, qn("w:rPr"))
    set_run_props(rpr)
    t = etree.SubElement(r, qn("w:t"))
    t.text = "1"
    return root


def add_or_update_style(styles_root: etree._Element, style_id: str, name: str, *, bold: bool = False, center: bool = False) -> None:
    style = styles_root.xpath(f"./w:style[@w:styleId='{style_id}']", namespaces=NS)
    if style:
        style = style[0]
    else:
        style = etree.SubElement(styles_root, qn("w:style"))
        style.set(qn("w:type"), "paragraph")
        style.set(qn("w:styleId"), style_id)
        style_name = etree.SubElement(style, qn("w:name"))
        style_name.set(qn("w:val"), name)
        based = etree.SubElement(style, qn("w:basedOn"))
        based.set(qn("w:val"), "Normal")
        ui = etree.SubElement(style, qn("w:uiPriority"))
        ui.set(qn("w:val"), "50")
    name_el = ensure(style, "w:name")
    name_el.set(qn("w:val"), name)
    rpr = ensure(style, "w:rPr")
    set_run_props(rpr, bold=bold)
    ppr = ensure(style, "w:pPr")
    spacing = ensure(ppr, "w:spacing")
    spacing.set(qn("w:before"), "0")
    spacing.set(qn("w:after"), "120")
    spacing.set(qn("w:line"), "360")
    spacing.set(qn("w:lineRule"), "auto")
    if center:
        jc = ensure(ppr, "w:jc")
        jc.set(qn("w:val"), "center")


def patch_styles(path: Path) -> None:
    tree = etree.parse(str(path))
    root = tree.getroot()

    for style in root.xpath(".//w:style", namespaces=NS):
        rpr = style.find(qn("w:rPr"))
        if rpr is None:
            rpr = etree.SubElement(style, qn("w:rPr"))
        style_id = style.get(qn("w:styleId"), "")
        bold = style_id in {"Heading1", "Heading2", "Heading3", "Balk1", "Balk2", "Balk3"}
        set_run_props(rpr, bold=bold)
        ppr = style.find(qn("w:pPr"))
        if ppr is not None:
            for colorish in ppr.xpath(".//w:color|.//w:shd", namespaces=NS):
                colorish.getparent().remove(colorish)

    doc_defaults = root.find(qn("w:docDefaults"))
    if doc_defaults is None:
        doc_defaults = etree.Element(qn("w:docDefaults"))
        root.insert(0, doc_defaults)
    rpr_default = ensure(ensure(doc_defaults, "w:rPrDefault"), "w:rPr")
    set_run_props(rpr_default)
    ppr_default = ensure(ensure(doc_defaults, "w:pPrDefault"), "w:pPr")
    spacing = ensure(ppr_default, "w:spacing")
    spacing.set(qn("w:line"), "360")
    spacing.set(qn("w:lineRule"), "auto")
    spacing.set(qn("w:after"), "120")

    add_or_update_style(root, "FrontMatterTitle", "FrontMatterTitle", bold=True, center=True)
    add_or_update_style(root, "TableCaption", "TableCaption", bold=False, center=False)
    add_or_update_style(root, "FigureCaption", "FigureCaption", bold=False, center=False)
    add_or_update_style(root, "ThesisBody", "ThesisBody", bold=False, center=False)

    tree.write(str(path), encoding="UTF-8", xml_declaration=True, standalone=True)


def patch_settings(path: Path) -> None:
    tree = etree.parse(str(path))
    root = tree.getroot()
    update = root.find(qn("w:updateFields"))
    if update is None:
        update = etree.Element(qn("w:updateFields"))
        root.insert(0, update)
    update.set(qn("w:val"), "true")
    lang = root.find(qn("w:themeFontLang"))
    if lang is None:
        lang = etree.SubElement(root, qn("w:themeFontLang"))
    lang.set(qn("w:val"), "tr-TR")
    lang.set(qn("w:eastAsia"), "tr-TR")
    lang.set(qn("w:bidi"), "tr-TR")
    tree.write(str(path), encoding="UTF-8", xml_declaration=True, standalone=True)


def normalize_runs(root: etree._Element) -> None:
    for rpr in root.xpath(".//w:rPr", namespaces=NS):
        set_run_props(rpr)
    for r in root.xpath(".//w:r[not(w:rPr)]", namespaces=NS):
        rpr = etree.Element(qn("w:rPr"))
        set_run_props(rpr)
        r.insert(0, rpr)
    for color in root.xpath(".//w:color", namespaces=NS):
        color.set(qn("w:val"), "000000")
    for sz in root.xpath(".//w:sz|.//w:szCs", namespaces=NS):
        sz.set(qn("w:val"), "24")
    for fonts in root.xpath(".//w:rFonts", namespaces=NS):
        for attr in ("ascii", "hAnsi", "cs", "eastAsia"):
            fonts.set(qn(f"w:{attr}"), "Times New Roman")


def replace_texts(root: etree._Element) -> None:
    replacements = {
        "Tablo 0.1. Çalışmanın iş paketleri ve hedef çıktıları": "Tablo 1.1. Çalışmanın iş paketleri ve hedef çıktıları",
        "Tablo 0.1. Çalışmanın iş paketleri ve hedef çıktıları.": "Tablo 1.1. Çalışmanın iş paketleri ve hedef çıktıları.",
        "Tablo 1.1. Literatürdeki çalışmaların karşılaştırılması": "Tablo 1.2. Literatürdeki çalışmaların karşılaştırılması",
        "Tablo 1.1. Literatürdeki çalışmaların karşılaştırılması.": "Tablo 1.2. Literatürdeki çalışmaların karşılaştırılması.",
    }
    for p in root.xpath(".//w:p", namespaces=NS):
        text = get_para_text(p)
        if text in replacements:
            set_para_text(p, replacements[text])


def is_empty_paragraph(el: etree._Element) -> bool:
    return etree.QName(el).localname == "p" and not get_para_text(el) and not el.xpath(".//w:drawing|.//w:pict", namespaces=NS)


def prev_nonempty(body: etree._Element, index: int) -> tuple[int, etree._Element] | None:
    j = index - 1
    while j >= 0:
        el = body[j]
        if not is_empty_paragraph(el):
            return j, el
        j -= 1
    return None


def move_table_captions_above(body: etree._Element) -> None:
    i = 0
    while i < len(body):
        el = body[i]
        if etree.QName(el).localname == "p" and re.match(r"^Tablo\s+\d+\.\d+\.", get_para_text(el)):
            prev = prev_nonempty(body, i)
            if prev is not None:
                table_idx, table_el = prev
                if etree.QName(table_el).localname == "tbl":
                    cap = el
                    body.remove(cap)
                    if i - 1 >= 0 and i - 1 < len(body) and is_empty_paragraph(body[i - 1]):
                        body.remove(body[i - 1])
                        if table_idx > i - 1:
                            table_idx -= 1
                    body.insert(table_idx, cap)
                    i = max(table_idx - 1, 0)
        i += 1


def add_table_geometry(tbl: etree._Element) -> None:
    tblpr = ensure(tbl, "w:tblPr", first=True)
    tblw = ensure(tblpr, "w:tblW")
    tblw.set(qn("w:type"), "pct")
    tblw.set(qn("w:w"), "5000")
    layout = ensure(tblpr, "w:tblLayout")
    layout.set(qn("w:type"), "autofit")
    indent = tblpr.find(qn("w:tblInd"))
    if indent is not None:
        tblpr.remove(indent)
    margins = ensure(tblpr, "w:tblCellMar")
    for side in ("top", "left", "bottom", "right"):
        item = margins.find(qn(f"w:{side}"))
        if item is None:
            item = etree.SubElement(margins, qn(f"w:{side}"))
        item.set(qn("w:w"), "80")
        item.set(qn("w:type"), "dxa")
    first_row = tbl.find(qn("w:tr"))
    if first_row is not None:
        trpr = ensure(first_row, "w:trPr", first=True)
        if trpr.find(qn("w:tblHeader")) is None:
            hdr = etree.SubElement(trpr, qn("w:tblHeader"))
            hdr.set(qn("w:val"), "true")
    for tr in tbl.xpath(".//w:tr", namespaces=NS):
        trpr = tr.find(qn("w:trPr"))
        if trpr is not None:
            for h in trpr.xpath("./w:trHeight", namespaces=NS):
                trpr.remove(h)


def page_numbering_for_section(sect: etree._Element, *, fmt: str, start: int | None = None, title_pg: bool = False) -> None:
    pg = sect.find(qn("w:pgNumType"))
    if pg is None:
        pg = etree.Element(qn("w:pgNumType"))
        sect.insert(0, pg)
    pg.set(qn("w:fmt"), fmt)
    if start is None:
        pg.attrib.pop(qn("w:start"), None)
    else:
        pg.set(qn("w:start"), str(start))
    title = sect.find(qn("w:titlePg"))
    if title_pg and title is None:
        sect.insert(0, etree.Element(qn("w:titlePg")))
    if not title_pg and title is not None:
        sect.remove(title)


def make_front_lists(old_sect_p: etree._Element) -> list[etree._Element]:
    sect_clone = etree.fromstring(etree.tostring(old_sect_p))
    set_para_text(sect_clone, "")
    new = [
        paragraph("İÇİNDEKİLER", "FrontMatterTitle", "center", bold=True),
        paragraph("Sayfa", None, "right", bold=False),
        field_paragraph('TOC \\o "1-3" \\h \\z \\u'),
        page_break_paragraph(),
        paragraph("TABLOLAR LİSTESİ", "Balk1", "center", bold=True),
        paragraph("Sayfa", None, "right", bold=False),
        field_paragraph('TOC \\f T \\h \\z'),
        page_break_paragraph(),
        paragraph("ŞEKİLLER LİSTESİ", "Balk1", "center", bold=True),
        paragraph("Sayfa", None, "right", bold=False),
        field_paragraph('TOC \\f F \\h \\z'),
        sect_clone,
    ]
    for p in new:
        if etree.QName(p).localname == "p":
            set_spacing(p, after=120)
    return new


def patch_document(path: Path) -> None:
    tree = etree.parse(str(path))
    root = tree.getroot()
    body = root.find(qn("w:body"))

    replace_texts(root)
    normalize_runs(root)

    for p in root.xpath(".//w:p", namespaces=NS):
        text = get_para_text(p)
        if re.match(r"^Tablo\s+\d+\.\d+\.", text):
            set_para_style(p, "TableCaption")
            add_bool_ppr(p, "w:keepNext")
            add_bool_ppr(p, "w:keepLines")
            set_alignment(p, "left")
            set_spacing(p, after=60)
            add_tc_field(p, text.rstrip("."), "T")
        elif re.match(r"^Şekil\s+\d+\.\d+\.", text):
            set_para_style(p, "FigureCaption")
            add_bool_ppr(p, "w:keepLines")
            set_alignment(p, "left")
            set_spacing(p, before=60, after=120)
            add_tc_field(p, text.rstrip("."), "F")
        elif re.match(r"^Denklem\s+\d+\.\d+\.", text):
            set_para_style(p, "Caption")
            set_alignment(p, "left")

        if re.match(r"^\d+\.\d+\.\d+\.", text):
            set_para_style(p, "Balk3")
        elif re.match(r"^\d+\.\d+\.", text):
            set_para_style(p, "Balk2")

        if text in {"ETİK BEYAN"}:
            set_para_style(p, "FrontMatterTitle")
        if text.startswith("SERBEST METİN MALZEME GİRDİLERİNİN") and p.xpath("./w:pPr/w:pStyle", namespaces=NS):
            set_para_style(p, "Normal")
            set_alignment(p, "center")

        if p.xpath(".//w:drawing|.//w:pict", namespaces=NS):
            add_bool_ppr(p, "w:keepNext")
            set_alignment(p, "center")

    for tbl in root.xpath(".//w:tbl", namespaces=NS):
        add_table_geometry(tbl)

    move_table_captions_above(body)

    start_idx = end_idx = None
    old_sect = None
    for idx, child in enumerate(body):
        if etree.QName(child).localname == "p" and get_para_text(child) == "İÇİNDEKİLER":
            start_idx = idx
        if etree.QName(child).localname == "p" and child.xpath("./w:pPr/w:sectPr", namespaces=NS):
            text = get_para_text(child)
            if start_idx is not None and text == "":
                end_idx = idx
                old_sect = child
                break
    if start_idx is not None and end_idx is not None and old_sect is not None:
        new_list_elements = make_front_lists(old_sect)
        for _ in range(end_idx - start_idx + 1):
            body.remove(body[start_idx])
        for offset, el in enumerate(new_list_elements):
            body.insert(start_idx + offset, el)

    sects = []
    for child in body:
        sects.extend(child.xpath("./w:pPr/w:sectPr", namespaces=NS))
    final_sect = body.find(qn("w:sectPr"))
    if final_sect is not None:
        sects.append(final_sect)
    for idx, sect in enumerate(sects):
        if idx == 0:
            page_numbering_for_section(sect, fmt="lowerRoman", start=0, title_pg=True)
        elif idx < len(sects) - 1:
            page_numbering_for_section(sect, fmt="lowerRoman", start=None, title_pg=False)
        else:
            page_numbering_for_section(sect, fmt="decimal", start=1, title_pg=False)

    tree.write(str(path), encoding="UTF-8", xml_declaration=True, standalone=True)


def patch_all_footers(root_dir: Path) -> None:
    for footer in sorted((root_dir / "word").glob("footer*.xml")):
        blank = footer.name == "footer3.xml"
        tree = etree.ElementTree(page_field_footer(blank=blank))
        tree.write(str(footer), encoding="UTF-8", xml_declaration=True, standalone=True)


def patch_docx(src: Path, dst: Path) -> None:
    if dst.exists():
        dst.unlink()
    with TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        with zipfile.ZipFile(src) as z:
            z.extractall(tmp_path)

        patch_styles(tmp_path / "word" / "styles.xml")
        patch_settings(tmp_path / "word" / "settings.xml")
        patch_document(tmp_path / "word" / "document.xml")
        patch_all_footers(tmp_path)

        with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
            for item in tmp_path.rglob("*"):
                if item.is_file():
                    z.write(item, item.relative_to(tmp_path).as_posix())


if __name__ == "__main__":
    src = Path(r"C:\Users\hy971\source\repos\MyDietitianMobileApp\Dytopia_Bitirme_Tezi_TarsusUni_Final_Akademik_Grafikli.docx")
    dst = Path(r"C:\Users\hy971\source\repos\MyDietitianMobileApp\Dytopia_Bitirme_Tezi_TarsusUni_Final_Teknik_Kusursuz.docx")
    shutil.copy2(src, dst.with_suffix(".source-backup.docx"))
    patch_docx(src, dst)
    print(dst)
