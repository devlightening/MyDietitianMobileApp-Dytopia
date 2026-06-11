from __future__ import annotations

import re
import shutil
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory

from lxml import etree


ROOT = Path(r"C:\Users\hy971\source\repos\MyDietitianMobileApp")
SRC = ROOT / "Last_Dytopia_Bitirme_Tezi_TarsusUni_Final_Teknik_Kusursuz.docx"
OUT = ROOT / "Last_Dytopia_Bitirme_Tezi_TarsusUni_Final_Teknik_Kusursuz_v2.docx"

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
REL = "http://schemas.openxmlformats.org/package/2006/relationships"
XML = "http://www.w3.org/XML/1998/namespace"
NS = {"w": W, "r": R, "rel": REL}


def qn(tag: str) -> str:
    prefix, name = tag.split(":")
    return f"{{{ {'w': W, 'r': R}[prefix] }}}{name}"


def text(el: etree._Element) -> str:
    return "".join(el.xpath(".//w:t/text()", namespaces=NS)).strip()


def ensure(parent: etree._Element, tag: str, first: bool = False) -> etree._Element:
    child = parent.find(qn(tag))
    if child is None:
        child = etree.Element(qn(tag))
        if first:
            parent.insert(0, child)
        else:
            parent.append(child)
    return child


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
    for tag in ("w:i", "w:iCs", "w:u"):
        for node in rpr.findall(qn(tag)):
            rpr.remove(node)
    if bold is True:
        ensure(rpr, "w:b")
        ensure(rpr, "w:bCs")


def set_p_alignment(p: etree._Element, val: str) -> None:
    ppr = ensure(p, "w:pPr", first=True)
    jc = ensure(ppr, "w:jc")
    jc.set(qn("w:val"), val)


def set_p_spacing(p: etree._Element, before: int = 0, after: int = 120, line: int = 360) -> None:
    ppr = ensure(p, "w:pPr", first=True)
    spacing = ensure(ppr, "w:spacing")
    spacing.set(qn("w:before"), str(before))
    spacing.set(qn("w:after"), str(after))
    spacing.set(qn("w:line"), str(line))
    spacing.set(qn("w:lineRule"), "auto")


def set_p_style(p: etree._Element, style_id: str | None) -> None:
    ppr = ensure(p, "w:pPr", first=True)
    for old in ppr.findall(qn("w:pStyle")):
        ppr.remove(old)
    if style_id:
        pstyle = etree.Element(qn("w:pStyle"))
        pstyle.set(qn("w:val"), style_id)
        ppr.insert(0, pstyle)


def set_plain_paragraph(p: etree._Element, value: str, *, style: str | None = None, align: str | None = None, bold: bool = False) -> None:
    ppr = p.find(qn("w:pPr"))
    for child in list(p):
        if etree.QName(child).localname != "pPr":
            p.remove(child)
    if ppr is None:
        ppr = etree.Element(qn("w:pPr"))
        p.insert(0, ppr)
    set_p_style(p, style)
    if align:
        set_p_alignment(p, align)
    set_p_spacing(p)
    r = etree.SubElement(p, qn("w:r"))
    rpr = etree.SubElement(r, qn("w:rPr"))
    set_run_props(rpr, bold=bold)
    t = etree.SubElement(r, qn("w:t"))
    t.text = value


def paragraph(value: str, *, style: str | None = None, align: str | None = None, bold: bool = False) -> etree._Element:
    p = etree.Element(qn("w:p"))
    etree.SubElement(p, qn("w:pPr"))
    set_plain_paragraph(p, value, style=style, align=align, bold=bold)
    return p


def copy_section_break(src: etree._Element) -> etree._Element:
    clone = etree.fromstring(etree.tostring(src))
    set_plain_paragraph(clone, "")
    return clone


def add_tabbed_line(label: str, page: str, level: int = 1) -> etree._Element:
    p = etree.Element(qn("w:p"))
    ppr = etree.SubElement(p, qn("w:pPr"))
    ind = etree.SubElement(ppr, qn("w:ind"))
    ind.set(qn("w:left"), str((level - 1) * 360))
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


def split_toc_line(value: str) -> tuple[str, str] | None:
    if "\t" in value:
        label, page = value.rsplit("\t", 1)
        return label.strip(), page.strip()
    match = re.match(r"^(.*?)(\d+|[ivxlcdm]+)$", value.strip(), flags=re.IGNORECASE)
    if match:
        return match.group(1).strip(), match.group(2).strip()
    return None


def patch_styles(path: Path) -> None:
    tree = etree.parse(str(path))
    root = tree.getroot()
    for style in root.xpath(".//w:style", namespaces=NS):
        rpr = ensure(style, "w:rPr")
        style_id = style.get(qn("w:styleId"), "")
        set_run_props(rpr, bold=style_id in {"Heading1", "Heading2", "Heading3", "Balk1", "Balk2", "Balk3"})
    doc_defaults = root.find(qn("w:docDefaults"))
    if doc_defaults is None:
        doc_defaults = etree.Element(qn("w:docDefaults"))
        root.insert(0, doc_defaults)
    rpr_default = ensure(ensure(doc_defaults, "w:rPrDefault"), "w:rPr")
    set_run_props(rpr_default)
    tree.write(str(path), encoding="UTF-8", xml_declaration=True, standalone=True)


def make_page_footer(blank: bool) -> etree._Element:
    ftr = etree.Element(qn("w:ftr"), nsmap={"w": W, "r": R})
    p = etree.SubElement(ftr, qn("w:p"))
    ppr = etree.SubElement(p, qn("w:pPr"))
    jc = etree.SubElement(ppr, qn("w:jc"))
    jc.set(qn("w:val"), "center")
    if blank:
        return ftr
    r = etree.SubElement(p, qn("w:r"))
    fld = etree.SubElement(r, qn("w:fldChar"))
    fld.set(qn("w:fldCharType"), "begin")
    r = etree.SubElement(p, qn("w:r"))
    instr = etree.SubElement(r, qn("w:instrText"))
    instr.set(f"{{{XML}}}space", "preserve")
    instr.text = " PAGE "
    r = etree.SubElement(p, qn("w:r"))
    fld = etree.SubElement(r, qn("w:fldChar"))
    fld.set(qn("w:fldCharType"), "separate")
    r = etree.SubElement(p, qn("w:r"))
    rpr = etree.SubElement(r, qn("w:rPr"))
    set_run_props(rpr)
    t = etree.SubElement(r, qn("w:t"))
    t.text = "1"
    r = etree.SubElement(p, qn("w:r"))
    fld = etree.SubElement(r, qn("w:fldChar"))
    fld.set(qn("w:fldCharType"), "end")
    return ftr


def patch_footers(tmp_path: Path) -> None:
    rels = etree.parse(str(tmp_path / "word" / "_rels" / "document.xml.rels")).getroot()
    rel_map = {rel.get("Id"): rel.get("Target") for rel in rels}
    doc = etree.parse(str(tmp_path / "word" / "document.xml")).getroot()
    body = doc.find(qn("w:body"))
    first_sect = None
    for p in body.xpath("./w:p", namespaces=NS):
        sects = p.xpath("./w:pPr/w:sectPr", namespaces=NS)
        if sects:
            first_sect = sects[0]
            break
    blank_targets = set()
    if first_sect is not None:
        for ref in first_sect.xpath("./w:footerReference[@w:type='first']", namespaces=NS):
            target = rel_map.get(ref.get(qn("r:id")))
            if target:
                blank_targets.add(target)
    for footer in (tmp_path / "word").glob("footer*.xml"):
        blank = footer.name in blank_targets
        etree.ElementTree(make_page_footer(blank)).write(str(footer), encoding="UTF-8", xml_declaration=True, standalone=True)


def set_table_borders(tbl_pr: etree._Element) -> None:
    borders = tbl_pr.find(qn("w:tblBorders"))
    if borders is not None:
        tbl_pr.remove(borders)
    borders = etree.SubElement(tbl_pr, qn("w:tblBorders"))
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = etree.SubElement(borders, qn(f"w:{edge}"))
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), "4")
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), "000000")


def widths_for_header(header: list[str], cols: int) -> list[int]:
    header_key = "|".join(header)
    if cols == 6 and "Pipeline" in header_key:
        return [2250, 1200, 1200, 1300, 1300, 2150]
    if cols == 6 and "ID" in header_key and "Aktör" in header_key:
        return [650, 1350, 2700, 1450, 1450, 1150]
    if cols == 6 and "Endpoint" in header_key:
        return [1900, 650, 1650, 1650, 1650, 800]
    if cols == 5:
        return [2200, 1050, 1200, 1200, 3300]
    if cols == 3 and "Alan" in header_key and "Literatürdeki" in header_key:
        return [1800, 3600, 3600]
    if cols == 3 and "İş Paketi" in header_key:
        return [1300, 4300, 3400]
    if cols == 3:
        return [2100, 3450, 3450]
    if cols == 2 and "API" in header_key:
        return [1800, 7200]
    if cols == 2:
        return [3000, 6000]
    if cols == 1:
        return [9000]
    base = 9000 // cols
    return [base] * cols


def normalize_table(tbl: etree._Element) -> None:
    rows = tbl.xpath("./w:tr", namespaces=NS)
    if not rows:
        return
    header = [" ".join(tc.xpath(".//w:t/text()", namespaces=NS)).strip() for tc in rows[0].xpath("./w:tc", namespaces=NS)]
    cols = max(len(rows[0].xpath("./w:tc", namespaces=NS)), 1)
    widths = widths_for_header(header, cols)
    total = sum(widths)

    tbl_pr = ensure(tbl, "w:tblPr", first=True)
    tbl_w = ensure(tbl_pr, "w:tblW")
    tbl_w.set(qn("w:type"), "dxa")
    tbl_w.set(qn("w:w"), str(total))
    layout = ensure(tbl_pr, "w:tblLayout")
    layout.set(qn("w:type"), "fixed")
    indent = tbl_pr.find(qn("w:tblInd"))
    if indent is None:
        indent = etree.SubElement(tbl_pr, qn("w:tblInd"))
    indent.set(qn("w:type"), "dxa")
    indent.set(qn("w:w"), "0")
    set_table_borders(tbl_pr)
    for shd in tbl_pr.xpath(".//w:shd", namespaces=NS):
        shd.getparent().remove(shd)

    grid = tbl.find(qn("w:tblGrid"))
    if grid is not None:
        tbl.remove(grid)
    grid = etree.Element(qn("w:tblGrid"))
    for width in widths:
        col = etree.SubElement(grid, qn("w:gridCol"))
        col.set(qn("w:w"), str(width))
    insert_at = 1 if tbl.find(qn("w:tblPr")) is not None else 0
    tbl.insert(insert_at, grid)

    for row_index, tr in enumerate(rows):
        tr_pr = ensure(tr, "w:trPr", first=True)
        for h in tr_pr.findall(qn("w:trHeight")):
            tr_pr.remove(h)
        if row_index == 0 and tr_pr.find(qn("w:tblHeader")) is None:
            hdr = etree.SubElement(tr_pr, qn("w:tblHeader"))
            hdr.set(qn("w:val"), "true")
        cells = tr.xpath("./w:tc", namespaces=NS)
        for idx, tc in enumerate(cells):
            tc_pr = ensure(tc, "w:tcPr", first=True)
            for shd in tc_pr.xpath(".//w:shd", namespaces=NS):
                shd.getparent().remove(shd)
            tc_w = ensure(tc_pr, "w:tcW")
            tc_w.set(qn("w:type"), "dxa")
            tc_w.set(qn("w:w"), str(widths[min(idx, len(widths) - 1)]))
            valign = ensure(tc_pr, "w:vAlign")
            valign.set(qn("w:val"), "center")
            margins = ensure(tc_pr, "w:tcMar")
            for side in ("top", "left", "bottom", "right"):
                node = margins.find(qn(f"w:{side}"))
                if node is None:
                    node = etree.SubElement(margins, qn(f"w:{side}"))
                node.set(qn("w:w"), "60")
                node.set(qn("w:type"), "dxa")
            for p in tc.xpath(".//w:p", namespaces=NS):
                set_p_alignment(p, "center")
                set_p_spacing(p, after=40, line=300)
                for r in p.xpath(".//w:r", namespaces=NS):
                    rpr = ensure(r, "w:rPr", first=True)
                    set_run_props(rpr, bold=(row_index == 0))


def patch_toc(body: etree._Element) -> None:
    replacements = {
        "BİRİNCİ BÖLÜM TEORİK ALT YAPI": ("BÖLÜM I", "TEORİK ALT YAPI"),
        "İKİNCİ BÖLÜM MATERYAL VE METOT": ("BÖLÜM II", "MATERYAL VE METOT"),
        "ÜÇÜNCÜ BÖLÜM BULGULAR VE TARTIŞMA": ("BÖLÜM III", "BULGULAR VE TARTIŞMA"),
    }
    in_toc = False
    idx = 0
    while idx < len(body):
        child = body[idx]
        if etree.QName(child).localname != "p":
            idx += 1
            continue
        value = text(child)
        if value == "İÇİNDEKİLER":
            in_toc = True
        elif in_toc and value == "KISALTMALAR":
            break
        if in_toc:
            split = split_toc_line(value)
            if split and split[0] in replacements:
                first, second = replacements[split[0]]
                body.remove(child)
                body.insert(idx, paragraph(first, align="center", bold=True))
                body.insert(idx + 1, paragraph(second, align="center", bold=True))
                idx += 2
                continue
            if split:
                label, page = split
                body.remove(child)
                # Keep front matter and chapter end entries at level 1; numbered subheads and appendix entries indented.
                level = 2 if re.match(r"^(\d+\.\d+|Ek\s+[A-Z]\.)", label) or label in {"Problem Tanımı", "Araştırma Sorusu", "Amaç ve Kapsam", "Çalışmanın Özgün Değeri", "İş Paketleri ve Zaman Planı"} else 1
                body.insert(idx, add_tabbed_line(label, page, level=level))
        idx += 1


def patch_document(path: Path) -> None:
    tree = etree.parse(str(path))
    root = tree.getroot()
    body = root.find(qn("w:body"))

    forbidden = ["DTHybrit", "TarsusFer", "Saim Gezer", "MovieLens", "SASRec", "GRU4Rec", "DeepFM"]
    all_text = " ".join(root.xpath(".//w:t/text()", namespaces=NS))
    leaked = [term for term in forbidden if term.lower() in all_text.lower()]
    if leaked:
        raise RuntimeError(f"Forbidden reference content in Dytopia docx: {leaked}")

    for r in root.xpath(".//w:r", namespaces=NS):
        rpr = ensure(r, "w:rPr", first=True)
        set_run_props(rpr)

    patch_toc(body)

    intro_seen = False
    for idx, child in enumerate(body):
        if etree.QName(child).localname != "p":
            continue
        value = text(child)
        if value == "GİRİŞ":
            intro_seen = True
        if not intro_seen:
            continue
        if re.match(r"^Tablo\s+\d+\.\d+\.", value):
            set_p_style(child, "TableCaption")
            set_p_alignment(child, "center")
            set_p_spacing(child, after=60)
            ppr = ensure(child, "w:pPr", first=True)
            ensure(ppr, "w:keepNext")
            ensure(ppr, "w:keepLines")
        elif re.match(r"^Şekil\s+\d+\.\d+\.", value):
            set_p_style(child, "FigureCaption")
            set_p_alignment(child, "center")
            set_p_spacing(child, before=60, after=120)
            ppr = ensure(child, "w:pPr", first=True)
            ensure(ppr, "w:keepLines")
            # Keep the previous image paragraph with this caption.
            if idx > 0:
                prev = body[idx - 1]
                if prev.xpath(".//w:drawing|.//w:pict", namespaces=NS):
                    ensure(ensure(prev, "w:pPr", first=True), "w:keepNext")
                    set_p_alignment(prev, "center")

    for tbl in root.xpath(".//w:tbl", namespaces=NS):
        normalize_table(tbl)

    # Restore the student name in the ethics signature block if Word placeholder text is present.
    prev_text = ""
    for p in body.xpath("./w:p", namespaces=NS):
        value = text(p)
        if prev_text == "İMZA" and value == "Adı Soyadı":
            set_plain_paragraph(p, "Halil İbrahim YILDIRIM", style=None, align="right")
            break
        if value:
            prev_text = value

    # Language: default Turkish; Abstract paragraphs English; common technical terms noProof.
    abstract = False
    technical_terms = {
        "Dytopia", "MyDietitian", "Access Key", "Premium Guard", "Tenant Isolation", "OpenAI",
        "API", "backend", "frontend", "React Native", "Expo", "Next.js", "PostgreSQL",
        "SignalR", "JWT", "Pipeline", "Accuracy", "Coverage", "Unresolved", "OpenAI key not configured",
    }
    for p in body.xpath("./w:p", namespaces=NS):
        value = text(p)
        if value == "ABSTRACT":
            abstract = True
        elif value == "ÖNSÖZ":
            abstract = False
        for r in p.xpath(".//w:r", namespaces=NS):
            r_text = "".join(r.xpath(".//w:t/text()", namespaces=NS))
            rpr = ensure(r, "w:rPr", first=True)
            lang = ensure(rpr, "w:lang")
            if abstract:
                lang.set(qn("w:val"), "en-US")
                lang.set(qn("w:eastAsia"), "en-US")
                lang.set(qn("w:bidi"), "en-US")
            if any(term.lower() in r_text.lower() for term in technical_terms):
                ensure(rpr, "w:noProof")

    tree.write(str(path), encoding="UTF-8", xml_declaration=True, standalone=True)


def patch_settings(path: Path) -> None:
    tree = etree.parse(str(path))
    root = tree.getroot()
    lang = root.find(qn("w:themeFontLang"))
    if lang is None:
        lang = etree.SubElement(root, qn("w:themeFontLang"))
    lang.set(qn("w:val"), "tr-TR")
    lang.set(qn("w:eastAsia"), "tr-TR")
    lang.set(qn("w:bidi"), "tr-TR")
    for upd in root.xpath("./w:updateFields", namespaces=NS):
        upd.set(qn("w:val"), "false")
    tree.write(str(path), encoding="UTF-8", xml_declaration=True, standalone=True)


def main() -> None:
    if OUT.exists():
        OUT.unlink()
    with TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        with zipfile.ZipFile(SRC) as z:
            z.extractall(tmp_path)
        patch_styles(tmp_path / "word" / "styles.xml")
        patch_settings(tmp_path / "word" / "settings.xml")
        patch_document(tmp_path / "word" / "document.xml")
        patch_footers(tmp_path)
        tmp_out = OUT.with_suffix(".tmp.docx")
        if tmp_out.exists():
            tmp_out.unlink()
        with zipfile.ZipFile(tmp_out, "w", zipfile.ZIP_DEFLATED) as z:
            for item in tmp_path.rglob("*"):
                if item.is_file():
                    z.write(item, item.relative_to(tmp_path).as_posix())
        shutil.move(str(tmp_out), OUT)
    print(OUT)


if __name__ == "__main__":
    main()
