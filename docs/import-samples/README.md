# Tarif İçe Aktarma Test Dosyaları

Bu klasörde web panel içe aktarma ekranında deneyebileceğiniz örnek dosyalar bulunur.

Dosyalar:
- `01_tarif_import_baslik_kaymali.csv`
- `02_tarif_import_turkce_basliklar.xlsx`
- `03_tarif_import_serbest_belge.docx`
- `04_tarif_import_metin_pdf.pdf`

Önerilen testler:
- CSV: başlık üçüncü satırda olduğu için header detection çalışmalı.
- XLSX: Türkçe başlıklar ve etiket/adım metadata alanları okunmalı.
- DOCX: heading + paragraf + madde işaretli yapı serbest belge parserı ile ayrışmalı.
- PDF: seçilebilir metin içeren örnek belge içe alınmalı.

Not:
- PDF örneği özellikle metin çıkarmayı garanti etmek için ASCII ağırlıklı üretildi.
- Taranmış görsel PDF bu sürümde bilinçli olarak desteklenmez.