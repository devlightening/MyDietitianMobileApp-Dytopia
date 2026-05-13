import json
import sys

from pypdf import PdfReader


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Dosya yolu verilmedi."}, ensure_ascii=False))
        return 1

    path = sys.argv[1]

    try:
        reader = PdfReader(path)
        pages = []
        for page in reader.pages:
            text = page.extract_text() or ""
            if text.strip():
                pages.append(text)

        text = "\n\n".join(pages).strip()
        if not text:
            print(json.dumps({"success": False, "error": "UNSUPPORTED_PDF_IMAGE_ONLY", "text": ""}, ensure_ascii=False))
            return 0

        print(json.dumps({"success": True, "text": text}, ensure_ascii=False))
        return 0
    except Exception as exc:  # pragma: no cover - runtime helper
        print(json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
