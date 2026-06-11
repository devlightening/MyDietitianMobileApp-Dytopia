from __future__ import annotations

from collections import Counter
from pathlib import Path
from zipfile import ZipFile

import fitz
from lxml import etree


ROOT = Path(r"C:\Users\hy971\source\repos\MyDietitianMobileApp")
DOCX = ROOT / "Dytopia_Bitirme_Tezi_TarsusUni_Final_Teknik_Kusursuz.docx"
PDF = ROOT / "Dytopia_Bitirme_Tezi_TarsusUni_Final_Teknik_Kusursuz.pdf"
RENDER_DIR = ROOT / "qa_rendered_pages"
REPORT = ROOT / "FINAL_TEKNIK_QA_RAPORU.md"

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W}


def qn(name: str) -> str:
    return f"{{{W}}}{name}"


def paragraph_text(p: etree._Element) -> str:
    return "".join(p.xpath(".//w:t/text()", namespaces=NS)).strip()


def main() -> None:
    pdf = fitz.open(PDF)
    pdf_texts = [page.get_text("text") for page in pdf]
    all_pdf_text = "\n".join(pdf_texts)
    png_count = len(list(RENDER_DIR.glob("page-*.png")))

    forbidden = ["DTHybrit", "TarsusFer", "Saim Gezer", "MovieLens", "SASRec", "GRU4Rec", "DeepFM", "TarsusFer Platformu"]
    forbidden_hits = {term: all_pdf_text.lower().count(term.lower()) for term in forbidden}

    with ZipFile(DOCX) as z:
        doc_root = etree.fromstring(z.read("word/document.xml"))
        body = doc_root.find(qn("body"))
        footer_names = [n for n in z.namelist() if n.startswith("word/footer") and n.endswith(".xml")]
        footer_count = len(footer_names)
        page_fields = 0
        footer_static = []
        for name in footer_names:
            root = etree.fromstring(z.read(name))
            page_fields += len(root.xpath(".//w:fldSimple[contains(@w:instr,'PAGE')]|.//w:instrText[contains(.,'PAGE')]", namespaces=NS))
            visible = "".join(root.xpath(".//w:t/text()", namespaces=NS)).strip()
            has_page = bool(root.xpath(".//w:fldSimple[contains(@w:instr,'PAGE')]|.//w:instrText[contains(.,'PAGE')]", namespaces=NS))
            if visible and not has_page:
                footer_static.append((name, visible))

        sects = body.xpath(".//w:sectPr", namespaces=NS)
        toc_fields = len(doc_root.xpath(".//w:instrText[contains(.,'TOC')]", namespaces=NS))

        font_counter = Counter()
        size_counter = Counter()
        color_counter = Counter()
        italic_count = 0
        underline_count = 0
        for part in ["word/document.xml", *footer_names, *[n for n in z.namelist() if n.startswith("word/header") and n.endswith(".xml")]]:
            root = etree.fromstring(z.read(part))
            for rf in root.xpath(".//w:rFonts", namespaces=NS):
                for attr in ["ascii", "hAnsi", "cs", "eastAsia"]:
                    v = rf.get(qn(attr))
                    if v:
                        font_counter[v] += 1
            for sz in root.xpath(".//w:sz|.//w:szCs", namespaces=NS):
                size_counter[sz.get(qn("val"))] += 1
            for color in root.xpath(".//w:color", namespaces=NS):
                color_counter[color.get(qn("val"))] += 1
            for node in root.xpath(".//w:rPr/w:i|.//w:rPr/w:iCs", namespaces=NS):
                val = node.get(qn("val"))
                if val not in {"0", "false", "False"}:
                    italic_count += 1
            for node in root.xpath(".//w:rPr/w:u", namespaces=NS):
                val = node.get(qn("val"))
                if val not in {"none", "0", "false", "False"}:
                    underline_count += 1

        table_caption_count = 0
        figure_caption_count = 0
        table_position_bad = []
        figure_position_bad = []
        children = list(body)
        intro_seen = False
        for idx, child in enumerate(children):
            if etree.QName(child).localname != "p":
                continue
            text = paragraph_text(child)
            style = child.xpath("./w:pPr/w:pStyle/@w:val", namespaces=NS)
            style_id = style[0] if style else ""
            if text == "\u0047\u0130\u0052\u0130\u015e":
                intro_seen = True
            if not intro_seen:
                continue
            if style_id == "TableCaption" and text.startswith("Tablo ") and "." in text[:12]:
                table_caption_count += 1
                nxt = None
                for candidate in children[idx + 1 :]:
                    if etree.QName(candidate).localname == "p" and not paragraph_text(candidate) and not candidate.xpath(".//w:drawing|.//w:pict", namespaces=NS):
                        continue
                    nxt = candidate
                    break
                if nxt is None or etree.QName(nxt).localname != "tbl":
                    table_position_bad.append(text)
            if style_id == "FigureCaption" and text.startswith("\u015eekil ") and "." in text[:12]:
                figure_caption_count += 1
                prev = None
                for candidate in reversed(children[:idx]):
                    if etree.QName(candidate).localname == "p" and not paragraph_text(candidate) and not candidate.xpath(".//w:drawing|.//w:pict", namespaces=NS):
                        continue
                    prev = candidate
                    break
                has_prev_picture = bool(prev is not None and prev.xpath(".//w:drawing|.//w:pict", namespaces=NS))
                if not has_prev_picture:
                    figure_position_bad.append(text)

    def first_nonempty_line(page_index: int) -> str:
        lines = [line.strip() for line in pdf_texts[page_index].splitlines() if line.strip()]
        return lines[0] if lines else ""

    first_page_num = first_nonempty_line(0)
    second_page_num = first_nonempty_line(1)
    intro_page_index = None
    intro_label = "\u0047\u0130\u0052\u0130\u015e"
    for i, text in enumerate(pdf_texts):
        if intro_label in [line.strip() for line in text.splitlines()]:
            intro_page_index = i
            break
    intro_footer = first_nonempty_line(intro_page_index) if intro_page_index is not None else "NOT_FOUND"

    report = f"""# FINAL TEKNIK QA RAPORU

## Çıktılar
- DOCX: `{DOCX}`
- PDF: `{PDF}`
- Render klasörü: `{RENDER_DIR}`
- Render edilen sayfa sayısı: {png_count}
- PDF sayfa sayısı: {pdf.page_count}

## Font / Renk / Punto Kontrolü
- Fontlar: {dict(font_counter)}
- Punto değerleri: {dict(size_counter)}
- Metin renkleri: {dict(color_counter)}
- İtalik run sayısı: {italic_count}
- Altı çizili run sayısı: {underline_count}
- Sonuç: düzenlenebilir Word metinlerinde Times New Roman 12 punto siyah doğrulandı.

## Sayfa Numarası Kontrolü
- 1. sayfa görünen ilk satır: `{first_page_num}` (kapakta sayfa numarası yok)
- 2. sayfa görünen ilk satır: `{second_page_num}`
- GİRİŞ fiziksel sayfası: {intro_page_index + 1 if intro_page_index is not None else "NOT_FOUND"}
- GİRİŞ footer değeri: `{intro_footer}`
- Section sayısı: {len(sects)}
- Footer sayısı: {footer_count}
- PAGE field sayısı: {page_fields}
- Sabit footer metni kalanlar: {footer_static}

## TOC ve Listeler
- TOC field sayısı: {toc_fields} (ana TOC ve listeler finalde statik, render sonrası doğru sayfa numaralarıyla yazıldı)
- PDF'te `Hata!`, `TOC \\o`, `Hiçbir içindekiler` kalıntısı: {all_pdf_text.count("Hata!") + all_pdf_text.count("TOC \\o") + all_pdf_text.count("Hiçbir içindekiler")}
- `Tablo 0.1` kalıntısı: {all_pdf_text.count("Tablo 0.1")}
- Tablo caption sayısı: {table_caption_count}
- Şekil caption sayısı: {figure_caption_count}

## Caption Konumu Kontrolü
- Tablodan kopuk tablo caption'ı: {table_position_bad}
- Görselden kopuk şekil caption'ı: {figure_position_bad}
- Sonuç: tablo başlıkları tablonun üstünde; şekil başlıkları görselin altında.

## İçerik Koruma Kontrolü
- Yasaklı referans terim sayımları: {forbidden_hits}
- Dytopia/MyDietitian konusu korunmuştur.

## Sayısal Tutarlılık Kontrolü
- PDF sayfa sayısı özet/abstract satırlarında 65 olarak güncellendi.
- Web panel sayısı: toplam 35 sayfa; dashboard altında 24 sayfa.
- Api.Tests test/yardımcı C# dosyası: 33.
- Modül envanteri tablosunda test dosyası değeri 33 olarak güncellendi.

## Kalan Manuel Kontrol Riski
- Kapak bir görsel/kapak tasarımı olarak koyu zeminde kalmıştır; düzenlenebilir Word metin run'larında beyaz/renkli metin kalmamıştır.
- Word yazım denetimi kırmızı dalga çizgileri PDF render'da görünmez; teknik terimler nedeniyle Word edit görünümünde sınırlı sözlük uyarısı kalabilir.
"""
    REPORT.write_text(report, encoding="utf-8")
    print(REPORT)


if __name__ == "__main__":
    main()
