from __future__ import annotations

import csv
import io
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "docs" / "import-samples"


CSV_ROWS = [
    ["MyDietitian import örneği", "", "", "", "", "", "", "", "", "", ""],
    ["Bu ilk iki satır açıklama amaçlıdır", "", "", "", "", "", "", "", "", "", ""],
    ["Tarif Adı", "Açıklama", "Malzeme", "Miktar", "Birim", "Rol", "Etiketler", "Yapılış", "Hazırlık Süresi", "Pişirme Süresi", "Porsiyon"],
    ["Fırın Sebzeli Omlet", "Sebzeli hafif akşam öğünü", "Yumurta", "2", "adet", "zorunlu", "aksam, protein", "Yumurtaları çırp\nSebzeleri ekle\nFırında pişir", "10 dk", "15 dk", "2"],
    ["Fırın Sebzeli Omlet", "Sebzeli hafif akşam öğünü", "Kabak", "1", "adet", "zorunlu", "aksam, protein", "Yumurtaları çırp\nSebzeleri ekle\nFırında pişir", "10 dk", "15 dk", "2"],
    ["Fırın Sebzeli Omlet", "Sebzeli hafif akşam öğünü", "Beyaz peynir", "40", "gr", "opsiyonel", "aksam, protein", "Yumurtaları çırp\nSebzeleri ekle\nFırında pişir", "10 dk", "15 dk", "2"],
    ["Laktossuz Muzlu Smoothie", "Hızlı kahvaltı alternatifi", "Muz", "1", "adet", "zorunlu", "kahvalti, smoothie", "Tüm malzemeleri blenderdan geçir\nSoğuk servis et", "5 dk", "", "1"],
    ["Laktossuz Muzlu Smoothie", "Hızlı kahvaltı alternatifi", "Laktozsuz süt", "250", "ml", "zorunlu", "kahvalti, smoothie", "Tüm malzemeleri blenderdan geçir\nSoğuk servis et", "5 dk", "", "1"],
    ["Laktossuz Muzlu Smoothie", "Hızlı kahvaltı alternatifi", "Yulaf", "2", "tbsp", "opsiyonel", "kahvalti, smoothie", "Tüm malzemeleri blenderdan geçir\nSoğuk servis et", "5 dk", "", "1"],
]


XLSX_ROWS = [
    ["İçe aktarma test dosyası", "", "", "", "", "", "", "", "", "", ""],
    ["Tarif başlığı ikinci satırda değil", "", "", "", "", "", "", "", "", "", ""],
    ["tarif adı", "açıklama", "malzeme", "miktar", "birim", "rol", "etiketler", "hazırlanışı", "hazırlık süresi", "pişirme süresi", "porsiyon"],
    ["Yoğurtlu Yulaf Kasesi", "Soğuk tüketilen pratik ara öğün", "Süzme yoğurt", "3", "tbsp", "zorunlu", "ara-ogun, pratik", "Yoğurdu kâseye al\nYulaf ve meyveyi ekle", "5 dk", "", "1"],
    ["Yoğurtlu Yulaf Kasesi", "Soğuk tüketilen pratik ara öğün", "Yulaf", "4", "tbsp", "zorunlu", "ara-ogun, pratik", "Yoğurdu kâseye al\nYulaf ve meyveyi ekle", "5 dk", "", "1"],
    ["Yoğurtlu Yulaf Kasesi", "Soğuk tüketilen pratik ara öğün", "Çilek", "4", "adet", "opsiyonel", "ara-ogun, pratik", "Yoğurdu kâseye al\nYulaf ve meyveyi ekle", "5 dk", "", "1"],
    ["Mercimekli Sebze Çorbası", "Lif oranı yüksek öğle seçeneği", "Kırmızı mercimek", "1", "su bardağı", "zorunlu", "ogle, corba", "Sebzeleri doğra\nMercimekle birlikte kaynat\nBlenderdan geçir", "15 dk", "25 dk", "4"],
    ["Mercimekli Sebze Çorbası", "Lif oranı yüksek öğle seçeneği", "Havuç", "1", "adet", "zorunlu", "ogle, corba", "Sebzeleri doğra\nMercimekle birlikte kaynat\nBlenderdan geçir", "15 dk", "25 dk", "4"],
    ["Mercimekli Sebze Çorbası", "Lif oranı yüksek öğle seçeneği", "Kimyon", "1", "tsp", "opsiyonel", "ogle, corba", "Sebzeleri doğra\nMercimekle birlikte kaynat\nBlenderdan geçir", "15 dk", "25 dk", "4"],
]


DOCX_BLOCKS = [
    ("Fırın Kabak Mücveri", [
        "Açıklama: Fırınlanmış, hafif bir sebze tarifi.",
        "Etiketler: aksam, firin, sebze",
        "Hazırlık Süresi: 15 dk",
        "Pişirme Süresi: 25 dk",
        "Porsiyon: 3",
        "Malzemeler:",
        "- 2 adet kabak",
        "- 1 adet yumurta",
        "- 3 yemek kaşığı yulaf unu",
        "- 30 gr beyaz peynir",
        "Hazırlanışı:",
        "1. Kabakları rendeleyin.",
        "2. Tüm malzemeleri karıştırın.",
        "3. Karışımı tepsiye yayıp pişirin.",
    ]),
    ("Avokadolu Lor Tabağı", [
        "Açıklama: Kahvaltı için dengeli tabak önerisi.",
        "Etiketler: kahvalti, pratik",
        "Hazırlık Süresi: 8 dk",
        "Malzemeler:",
        "- 1 adet avokado",
        "- 60 gr lor peyniri",
        "- 1 tatlı kaşığı zeytinyağı",
        "Yapılışı:",
        "1. Avokadoyu dilimleyin.",
        "2. Lor peyniri ve zeytinyağı ile servis edin.",
    ]),
]


PDF_LINES = [
    "Firin Kabak Mucveri",
    "Aciklama: Firinlanmis, hafif bir sebze tarifi.",
    "Etiketler: aksam, firin, sebze",
    "Hazirlik: 15 dk",
    "Porsiyon: 3",
    "Malzemeler:",
    "- 2 adet kabak",
    "- 1 adet yumurta",
    "- 3 tbsp yulaf unu",
    "- 30 gr beyaz peynir",
    "Hazirlanisi:",
    "1. Kabaklari rendele.",
    "2. Tum malzemeleri karistir.",
    "3. Tepsiye yay ve pisir.",
    "",
    "Laktossuz Muzlu Smoothie",
    "Aciklama: Kahvalti icin hizli icecek.",
    "Malzemeler:",
    "- 1 adet muz",
    "- 250 ml laktozsuz sut",
    "- 2 tbsp yulaf",
    "Hazirlanisi:",
    "1. Tum malzemeleri blenderdan gecir.",
    "2. Soguk servis et.",
]


def ensure_output_dir() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def write_csv() -> Path:
    path = OUTPUT_DIR / "01_tarif_import_baslik_kaymali.csv"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerows(CSV_ROWS)
    return path


def column_name(index: int) -> str:
    name = ""
    while index > 0:
        index, rem = divmod(index - 1, 26)
        name = chr(65 + rem) + name
    return name


def inline_string_cell(cell_ref: str, value: str) -> str:
    safe = escape(value)
    return f'<c r="{cell_ref}" t="inlineStr"><is><t xml:space="preserve">{safe}</t></is></c>'


def build_sheet_xml(rows: list[list[str]]) -> str:
    xml_rows: list[str] = []
    for row_index, row in enumerate(rows, start=1):
        cells = []
        for col_index, value in enumerate(row, start=1):
            if value == "":
                continue
            cell_ref = f"{column_name(col_index)}{row_index}"
            cells.append(inline_string_cell(cell_ref, value))
        xml_rows.append(f'<row r="{row_index}">{"".join(cells)}</row>')
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<dimension ref="A1:K{len(rows)}"/>'
        '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'
        '<sheetFormatPr defaultRowHeight="15"/>'
        f'<sheetData>{"".join(xml_rows)}</sheetData>'
        '</worksheet>'
    )


def write_xlsx() -> Path:
    path = OUTPUT_DIR / "02_tarif_import_turkce_basliklar.xlsx"
    sheet_xml = build_sheet_xml(XLSX_ROWS)
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '</Types>',
        )
        archive.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            '</Relationships>',
        )
        archive.writestr(
            "xl/workbook.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets><sheet name="Tarifler" sheetId="1" r:id="rId1"/></sheets>'
            '</workbook>',
        )
        archive.writestr(
            "xl/_rels/workbook.xml.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            '</Relationships>',
        )
        archive.writestr("xl/worksheets/sheet1.xml", sheet_xml)
    return path


def paragraph_xml(text: str, heading: bool = False) -> str:
    safe = escape(text)
    if heading:
        return (
            '<w:p>'
            '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>'
            f'<w:r><w:t xml:space="preserve">{safe}</w:t></w:r>'
            '</w:p>'
        )
    return f'<w:p><w:r><w:t xml:space="preserve">{safe}</w:t></w:r></w:p>'


def write_docx() -> Path:
    path = OUTPUT_DIR / "03_tarif_import_serbest_belge.docx"
    body_parts = []
    for title, lines in DOCX_BLOCKS:
        body_parts.append(paragraph_xml(title, heading=True))
        body_parts.extend(paragraph_xml(line) for line in lines)

    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:body>'
        + "".join(body_parts)
        + '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>'
        '</w:body></w:document>'
    )

    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            '</Types>',
        )
        archive.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            '</Relationships>',
        )
        archive.writestr("word/document.xml", document_xml)
    return path


def build_pdf_bytes(lines: list[str]) -> bytes:
    def pdf_escape(value: str) -> str:
        return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    text_stream = ["BT", "/F1 12 Tf", "14 TL", "50 760 Td"]
    for line in lines:
        if line == "":
            text_stream.append("T*")
            continue
        text_stream.append(f"({pdf_escape(line)}) Tj")
        text_stream.append("T*")
    text_stream.append("ET")
    stream_data = "\n".join(text_stream).encode("latin-1", errors="ignore")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream_data), stream_data),
    ]

    content = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(content))
        content.extend(f"{index} 0 obj\n".encode("ascii"))
        content.extend(obj)
        content.extend(b"\nendobj\n")

    xref_start = len(content)
    content.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    content.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        content.extend(f"{offset:010d} 00000 n \n".encode("ascii"))

    trailer = (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_start}\n%%EOF"
    )
    content.extend(trailer.encode("ascii"))
    return bytes(content)


def write_pdf() -> Path:
    path = OUTPUT_DIR / "04_tarif_import_metin_pdf.pdf"
    path.write_bytes(build_pdf_bytes(PDF_LINES))
    return path


def write_readme(files: list[Path]) -> None:
    readme = OUTPUT_DIR / "README.md"
    lines = [
        "# Tarif İçe Aktarma Test Dosyaları",
        "",
        "Bu klasörde web panel içe aktarma ekranında deneyebileceğiniz örnek dosyalar bulunur.",
        "",
        "Dosyalar:",
    ]
    for file in files:
        lines.append(f"- `{file.name}`")
    lines.extend([
        "",
        "Önerilen testler:",
        "- CSV: başlık üçüncü satırda olduğu için header detection çalışmalı.",
        "- XLSX: Türkçe başlıklar ve etiket/adım metadata alanları okunmalı.",
        "- DOCX: heading + paragraf + madde işaretli yapı serbest belge parserı ile ayrışmalı.",
        "- PDF: seçilebilir metin içeren örnek belge içe alınmalı.",
        "",
        "Not:",
        "- PDF örneği özellikle metin çıkarmayı garanti etmek için ASCII ağırlıklı üretildi.",
        "- Taranmış görsel PDF bu sürümde bilinçli olarak desteklenmez.",
    ])
    readme.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    ensure_output_dir()
    files = [
        write_csv(),
        write_xlsx(),
        write_docx(),
        write_pdf(),
    ]
    write_readme(files)
    print(f"Örnek dosyalar oluşturuldu: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
