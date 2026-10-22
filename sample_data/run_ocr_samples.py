import os
import sys
from pathlib import Path
from tabulate import tabulate

# Force UTF-8 on Windows consoles to cleanly output Hindi / Devanagari characters
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app.services.ocr import process_document_ocr

SAMPLE_DIR = Path(__file__).resolve().parent / "samples"

def run_ocr_benchmark():
    sample_files = sorted(list(SAMPLE_DIR.glob("*.*")))
    if not sample_files:
        print(f"No sample files found in {SAMPLE_DIR}")
        return

    print("=" * 80)
    print(" BHUVERIFY - MULTI-PAGE & MULTI-FORMAT OCR EXTRACTION OVER SAMPLE DATA")
    print(f" Source Directory: {SAMPLE_DIR}")
    print(f" Total Specimen Files: {len(sample_files)}")
    print("=" * 80)

    summary_rows = []

    for idx, filepath in enumerate(sample_files, start=1):
        filename = filepath.name
        file_size_kb = filepath.stat().st_size // 1024
        print(f"\n[{idx}/{len(sample_files)}] Processing: {filename} ({file_size_kb} KB)")
        print("-" * 80)

        try:
            pages = process_document_ocr(str(filepath))
            total_words = sum(p["word_count"] for p in pages)
            avg_conf = (
                round(sum(p["avg_confidence"] for p in pages) / len(pages), 2)
                if pages
                else 0.0
            )
            engine = pages[0].get("engine", "unknown") if pages else "none"

            summary_rows.append([
                filename,
                len(pages),
                total_words,
                f"{avg_conf}%",
                engine,
                "SUCCESS"
            ])

            for p in pages:
                print(f"Page {p['page_number']}: ({p['word_count']} words, Avg Confidence: {p['avg_confidence']}%, Engine: {engine})")
                print("RAW EXTRACTED TEXT:")
                raw_snippet = p["raw_text"].strip()
                if raw_snippet:
                    print(raw_snippet)
                else:
                    print("[No text detected on this page]")
                print()

        except Exception as err:
            print(f"ERROR during OCR extraction on {filename}: {err}")
            summary_rows.append([filename, 0, 0, "0%", "none", f"FAILED: {err}"])

    print("\n" + "=" * 80)
    print(" OCR BENCHMARK EXECUTION SUMMARY")
    print("=" * 80)
    headers = ["Filename", "Pages", "Words Extracted", "Avg Conf", "Engine", "Status"]
    print(tabulate(summary_rows, headers=headers, tablefmt="grid"))

if __name__ == "__main__":
    run_ocr_benchmark()
