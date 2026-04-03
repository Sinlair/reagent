import json
import sys
from pathlib import Path
import urllib.request
import fitz


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: extract_pdf_images.py <pdf_url_or_path> <output_dir>", file=sys.stderr)
        return 1

    source = sys.argv[1]
    output_dir = Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)

    if source.startswith("http://") or source.startswith("https://"):
        pdf_path = output_dir / "source.pdf"
        urllib.request.urlretrieve(source, pdf_path)
    else:
        pdf_path = Path(source)

    doc = fitz.open(pdf_path)
    image_paths = []
    try:
        max_pages = min(doc.page_count, 2)
        for page_index in range(max_pages):
            page = doc.load_page(page_index)
            pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
            image_path = output_dir / f"page-{page_index + 1}.png"
            pix.save(image_path)
            image_paths.append(str(image_path))
    finally:
        doc.close()

    print(json.dumps({"image_paths": image_paths}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
