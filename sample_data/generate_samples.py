import os
import shutil
import json
import math
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter

SAMPLE_DATA_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = SAMPLE_DATA_DIR / "samples"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Try loading Windows system fonts for Devanagari and English
FONT_DEV = "C:/Windows/Fonts/Nirmala.ttc"
FONT_ENG = "C:/Windows/Fonts/arial.ttf"

def get_font(size: int, is_bold: bool = False, is_dev: bool = True):
    try:
        font_path = FONT_DEV if is_dev else FONT_ENG
        if not os.path.exists(font_path):
            font_path = FONT_ENG if os.path.exists(FONT_ENG) else None
        if font_path:
            return ImageFont.truetype(font_path, size)
    except Exception:
        pass
    return ImageFont.load_default()

def draw_watermark(draw: ImageDraw.ImageDraw, width: int, height: int, text: str = "SYNTHETIC DEMO RECORD"):
    """Draw prominent diagonal and header watermarks marking document as synthetic."""
    watermark_font = get_font(52, is_bold=True, is_dev=False)
    # Draw top banner in solid red/crimson
    draw.rectangle([(0, 0), (width, 42)], fill=(185, 28, 28))
    banner_text = f"*** {text} - केवल परीक्षण और अनुसंधान हेतु (FOR DEMO / TEST PURPOSES ONLY) ***"
    banner_font = get_font(18, is_bold=True, is_dev=True)
    draw.text((width // 2, 21), banner_text, fill=(255, 255, 255), font=banner_font, anchor="mm")

    # Draw bottom disclaimer bar
    draw.rectangle([(0, height - 36), (width, height)], fill=(30, 41, 59))
    footer_text = "DEMO REGISTRY MATCH - NOT AN OFFICIAL GOVERNMENT VERIFICATION"
    footer_font = get_font(16, is_bold=True, is_dev=False)
    draw.text((width // 2, height - 18), footer_text, fill=(241, 245, 249), font=footer_font, anchor="mm")

def draw_khatauni_base(data: dict) -> Image.Image:
    """Generate a high-fidelity synthetic UP Khatauni document image."""
    W, H = 1400, 1900
    img = Image.new("RGB", (W, H), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    # 1. Outer Border & Watermarks
    draw_watermark(draw, W, H, text="SYNTHETIC DEMO RECORD")
    draw.rectangle([(30, 55), (W - 30, H - 50)], outline=(30, 41, 59), width=3)
    draw.rectangle([(36, 61), (W - 36, H - 56)], outline=(71, 85, 105), width=1)

    # Diagonal faint watermark text across center
    watermark_layer = Image.new("RGBA", (W, H), (255, 255, 255, 0))
    w_draw = ImageDraw.Draw(watermark_layer)
    wm_font = get_font(72, is_bold=True, is_dev=False)
    w_draw.text((W // 2 - 420, H // 2 - 120), "SYNTHETIC DEMO RECORD", fill=(220, 38, 38, 32), font=wm_font)
    w_draw.text((W // 2 - 380, H // 2 - 40), "NOT OFFICIAL GOVERNMENT RECORD", fill=(220, 38, 38, 26), font=get_font(42, is_bold=True))
    img.paste(watermark_layer, (0, 0), watermark_layer)
    draw = ImageDraw.Draw(img)

    # 2. Document Title Header
    header_y = 75
    f_title = get_font(30, is_bold=True, is_dev=True)
    draw.text((W // 2, header_y), "उत्तर प्रदेश राजस्व परिषद (Board of Revenue, Uttar Pradesh)", fill=(15, 23, 42), font=f_title, anchor="mm")
    
    header_y += 38
    f_sub = get_font(24, is_bold=True, is_dev=True)
    draw.text((W // 2, header_y), "उद्धरण खतौनी (अधिकार अभिलेख) / RECORD OF RIGHTS (ROR)", fill=(30, 41, 59), font=f_sub, anchor="mm")

    header_y += 32
    f_form = get_font(18, is_dev=True)
    draw.text((W // 2, header_y), "प्रपत्र खतौनी - राजस्व संहिता 2006 (Form ROR - UP Revenue Code 2006)", fill=(71, 85, 105), font=f_form, anchor="mm")

    draw.line([(50, header_y + 22), (W - 50, header_y + 22)], fill=(100, 116, 139), width=2)

    # 3. Administrative Territory Metadata Box
    meta_y = header_y + 35
    f_meta_lbl = get_font(19, is_bold=True, is_dev=True)
    f_meta_val = get_font(19, is_dev=True)

    # Column 1
    draw.text((60, meta_y), "जि़ला (District):", fill=(51, 65, 85), font=f_meta_lbl)
    draw.text((220, meta_y), str(data.get("district", "-")), fill=(15, 23, 42), font=f_meta_val)

    draw.text((60, meta_y + 34), "तहसील (Tehsil):", fill=(51, 65, 85), font=f_meta_lbl)
    draw.text((220, meta_y + 34), str(data.get("tehsil", "-")), fill=(15, 23, 42), font=f_meta_val)

    # Column 2
    draw.text((500, meta_y), "परगना (Pargana):", fill=(51, 65, 85), font=f_meta_lbl)
    draw.text((680, meta_y), str(data.get("pargana", "-")), fill=(15, 23, 42), font=f_meta_val)

    draw.text((500, meta_y + 34), "ग्राम / गाँव (Village):", fill=(51, 65, 85), font=f_meta_lbl)
    draw.text((680, meta_y + 34), str(data.get("village", "-")), fill=(15, 23, 42), font=f_meta_val)

    # Column 3
    draw.text((950, meta_y), "फसली वर्ष (Fasli Year):", fill=(51, 65, 85), font=f_meta_lbl)
    draw.text((1180, meta_y), str(data.get("fasli_year", "1430-1435")), fill=(15, 23, 42), font=f_meta_val)

    draw.text((950, meta_y + 34), "खाता संख्या (Khata No):", fill=(51, 65, 85), font=f_meta_lbl)
    draw.text((1180, meta_y + 34), str(data.get("khata_number", "-")), fill=(2, 132, 199), font=f_meta_val)

    draw.line([(50, meta_y + 75), (W - 50, meta_y + 75)], fill=(148, 163, 184), width=1)

    # 4. Standard 6-Column Khatauni Table
    tbl_y = meta_y + 90
    tbl_h = 750
    tbl_x1, tbl_x2 = 50, W - 50

    # Column Boundaries
    cols = [
        tbl_x1,        # Start: 50
        tbl_x1 + 130,  # Col 1: Khata No (50 to 180)
        tbl_x1 + 600,  # Col 2: Landholders (180 to 650)
        tbl_x1 + 830,  # Col 3: Khasra No (650 to 880)
        tbl_x1 + 1010, # Col 4: Area in Ha (880 to 1060)
        tbl_x1 + 1150, # Col 5: Revenue INR (1060 to 1200)
        tbl_x2         # Col 6: Remarks (1200 to 1350)
    ]

    # Draw table bounding box & header background
    draw.rectangle([(tbl_x1, tbl_y), (tbl_x2, tbl_y + tbl_h)], outline=(30, 41, 59), width=2)
    draw.rectangle([(tbl_x1, tbl_y), (tbl_x2, tbl_y + 70)], fill=(241, 245, 249), outline=(30, 41, 59), width=2)

    # Vertical column lines
    for cx in cols[1:-1]:
        draw.line([(cx, tbl_y), (cx, tbl_y + tbl_h)], fill=(71, 85, 105), width=2)

    # Header Titles (Devanagari + English)
    f_th = get_font(16, is_bold=True, is_dev=True)
    f_th_en = get_font(13, is_dev=False)

    col_headers = [
        ("खाता सं०", "(1) Khata No."),
        ("खातेदार का नाम / पिता/पति का नाम / निवास", "(2) Landholder & Parent/Spouse"),
        ("खसरा सं० (गाटा)", "(3) Khasra No."),
        ("क्षेत्रफल (हे०)", "(4) Area (Ha)"),
        ("मालगुजारी / लगान", "(5) Rev (₹)"),
        ("अभियुक्ति / आदेश", "(6) Remarks / Orders")
    ]

    for i in range(len(col_headers)):
        c_left, c_right = cols[i], cols[i + 1]
        mid_x = (c_left + c_right) // 2
        hi_txt, en_txt = col_headers[i]
        draw.text((mid_x, tbl_y + 22), hi_txt, fill=(15, 23, 42), font=f_th, anchor="mm")
        draw.text((mid_x, tbl_y + 48), en_txt, fill=(71, 85, 105), font=f_th_en, anchor="mm")

    # Content Row inside table
    row_y = tbl_y + 90
    f_cell = get_font(19, is_dev=True)
    f_cell_bold = get_font(20, is_bold=True, is_dev=True)

    # Col 1: Khata No
    draw.text((cols[0] + 20, row_y), str(data.get("khata_number", "-")), fill=(15, 23, 42), font=f_cell_bold)

    # Col 2: Landholders
    landholders = data.get("landholders", [])
    lh_y = row_y
    for lh in landholders:
        name = lh.get("name", "")
        parent = lh.get("parent_name", "")
        share = lh.get("share_fraction", "")
        
        if name is None:
            name_display = "[अनुपलब्ध / OMITTED MISSING FIELD]"
            draw.text((cols[1] + 15, lh_y), name_display, fill=(220, 38, 38), font=f_cell)
        else:
            line1 = f"{name} {f'भाग {share}' if share else ''}".strip()
            draw.text((cols[1] + 15, lh_y), line1, fill=(15, 23, 42), font=f_cell_bold)

        lh_y += 28
        if parent is None:
            parent_display = "पिता / पति: [रिक्त / OMITTED]"
            draw.text((cols[1] + 25, lh_y), parent_display, fill=(220, 38, 38), font=f_cell)
        elif parent:
            line2 = f"पिता/पति: {parent}"
            draw.text((cols[1] + 25, lh_y), line2, fill=(51, 65, 85), font=f_cell)
        
        lh_y += 26
        residence = lh.get("residence", "नि० ग्राम (Resident of village)")
        draw.text((cols[1] + 25, lh_y), residence, fill=(100, 116, 139), font=get_font(16, is_dev=True))
        lh_y += 36

    # Col 3: Khasra Numbers
    khasras = data.get("khasra_numbers", [])
    khasra_str = ", ".join(khasras) if isinstance(khasras, list) else str(khasras)
    draw.text((cols[2] + 20, row_y), khasra_str, fill=(15, 23, 42), font=f_cell_bold)

    # Col 4: Area in Hectares
    area = data.get("land_area_hectares")
    area_str = f"{area:.4f}" if area is not None else "[OMITTED / रिक्त]"
    area_color = (15, 23, 42) if area is not None else (220, 38, 38)
    draw.text((cols[3] + 20, row_y), area_str, fill=area_color, font=f_cell)

    # Col 5: Revenue INR
    revenue = data.get("revenue_inr")
    rev_str = f"₹{revenue:.2f}" if revenue is not None else "[रिक्त / BLANK]"
    rev_color = (15, 23, 42) if revenue is not None else (220, 38, 38)
    draw.text((cols[4] + 15, row_y), rev_str, fill=rev_color, font=f_cell)

    # Col 6: Remarks
    remarks = data.get("remarks", "आदेश दर्ज: निर्विवाद नामांतरण स्वीकृत।")
    draw.text((cols[5] + 12, row_y), remarks, fill=(51, 65, 85), font=get_font(15, is_dev=True))

    # 5. Certification Stamp and Signatures Section
    footer_y = tbl_y + tbl_h + 35
    draw.line([(50, footer_y), (W - 50, footer_y)], fill=(148, 163, 184), width=1)

    # Synthetic Stamp
    stamp_x, stamp_y = 120, footer_y + 30
    draw.ellipse([(stamp_x, stamp_y), (stamp_x + 160, stamp_y + 160)], outline=(37, 99, 235), width=3)
    draw.ellipse([(stamp_x + 8, stamp_y + 8), (stamp_x + 152, stamp_y + 152)], outline=(37, 99, 235), width=1)
    f_stamp = get_font(15, is_bold=True, is_dev=True)
    draw.text((stamp_x + 80, stamp_y + 45), "राजस्व परिषद", fill=(37, 99, 235), font=f_stamp, anchor="mm")
    draw.text((stamp_x + 80, stamp_y + 75), "UP CADASTRE", fill=(37, 99, 235), font=get_font(14, is_bold=True), anchor="mm")
    draw.text((stamp_x + 80, stamp_y + 105), "प्रमाणित प्रतिलिपि", fill=(37, 99, 235), font=f_stamp, anchor="mm")

    # Digital verification and synthetic notice text
    draw.text((320, footer_y + 45), "कंप्यूटरीकृत प्रतिलिपि - भू-अभिलेख पोर्टल (Digitised Copy - Land Records Prototype)", fill=(30, 41, 59), font=get_font(18, is_bold=True, is_dev=True))
    draw.text((320, footer_y + 75), f"दस्तावेज़ संख्या (Document ID): {data.get('record_id', 'SYNTH-DOC-000')}", fill=(71, 85, 105), font=get_font(16, is_dev=False))
    draw.text((320, footer_y + 105), "जारीकर्ता: राजस्व निरीक्षक / लेखपाल (Revenue Inspector / Lekhpal - Synthetic Signature)", fill=(100, 116, 139), font=get_font(15, is_dev=True))
    draw.text((320, footer_y + 135), "सुरक्षा चेतावनी: केवल अनुसंधान एवं परीक्षण हेतु। वैधानिक प्रमाणिकता हेतु जनसेवा केंद्र से संपर्क करें।", fill=(220, 38, 38), font=get_font(14, is_bold=True, is_dev=True))

    return img

def apply_skew_rotation(image: Image.Image, angle: float) -> Image.Image:
    """Simulate tilted scanner feed by rotating and filling borders with off-white."""
    return image.rotate(angle, resample=Image.BICUBIC, expand=False, fillcolor=(250, 250, 250))

def apply_low_contrast(image: Image.Image) -> Image.Image:
    """Simulate low contrast, faint thermal/carbon scan."""
    # Desaturate slightly, reduce contrast, increase brightness
    enhancer_con = ImageEnhance.Contrast(image)
    img_low = enhancer_con.enhance(0.42)
    enhancer_bri = ImageEnhance.Brightness(img_low)
    img_faint = enhancer_bri.enhance(1.28)
    return img_faint

def apply_noisy_fax(image: Image.Image) -> Image.Image:
    """Simulate gritty photocopier texture with low contrast and slight blur."""
    faint = apply_low_contrast(image)
    blurred = faint.filter(ImageFilter.GaussianBlur(radius=0.7))
    return blurred

# Define the 12 Test Specimen Configurations
SAMPLE_CONFIGS = [
    {
        "id": "SYNTH-UP-2026-001",
        "filename": "sample_01_clean.pdf",
        "format": "PDF",
        "variant": "clean_print",
        "description": "Clean, high-contrast digital print of UP Khatauni record",
        "district": "Lucknow (Synthetic)",
        "tehsil": "Bakshi Ka Talab (Synthetic)",
        "pargana": "Mahona (Synthetic)",
        "village": "Syntheticpur",
        "fasli_year": "1430-1435",
        "khata_number": "00124",
        "khasra_numbers": ["45/1", "45/2", "46"],
        "land_area_hectares": 0.4050,
        "revenue_inr": 18.50,
        "landholders": [
            {
                "name": "रमेश कुमार (Ramesh Kumar)",
                "parent_name": "सुरेश कुमार (Suresh Kumar)",
                "share_fraction": "1/2",
                "residence": "नि० ग्राम Syntheticpur"
            },
            {
                "name": "दिनेश कुमार (Dinesh Kumar)",
                "parent_name": "सुरेश कुमार (Suresh Kumar)",
                "share_fraction": "1/2",
                "residence": "नि० ग्राम Syntheticpur"
            }
        ],
        "remarks": "आदेश: निर्विवाद नामांतरण पत्रावली सं० 42/2024 आदेशानुसार दर्ज।"
    },
    {
        "id": "SYNTH-UP-2026-002",
        "filename": "sample_02_clean.png",
        "format": "PNG",
        "variant": "clean_print",
        "description": "Crisp single-owner Khatauni image specimen in PNG format",
        "district": "Varanasi (Synthetic)",
        "tehsil": "Sadar (Synthetic)",
        "pargana": "Dehat (Synthetic)",
        "village": "Mohanpur",
        "fasli_year": "1430-1435",
        "khata_number": "00088",
        "khasra_numbers": ["112/3"],
        "land_area_hectares": 0.8210,
        "revenue_inr": 34.00,
        "landholders": [
            {
                "name": "दिनेश यादव (Dinesh Yadav)",
                "parent_name": "रामेश्वर यादव (Rameshwar Yadav)",
                "share_fraction": "1/1",
                "residence": "नि० ग्राम Mohanpur"
            }
        ],
        "remarks": "कृषि भूमि - श्रेणी 1-क (भूमिधर अधिकार वाली भूमि)"
    },
    {
        "id": "SYNTH-UP-2026-003",
        "filename": "sample_03_rotated_cw.pdf",
        "format": "PDF",
        "variant": "rotated",
        "rotation_angle": 4.5,
        "description": "Clockwise skewed document (+4.5 deg) simulating misaligned scanner tray",
        "district": "Ayodhya (Synthetic)",
        "tehsil": "Sohawal (Synthetic)",
        "pargana": "Haveli (Synthetic)",
        "village": "Rampur Kalan",
        "fasli_year": "1430-1435",
        "khata_number": "00315",
        "khasra_numbers": ["78/2", "79"],
        "land_area_hectares": 0.2500,
        "revenue_inr": 12.00,
        "landholders": [
            {
                "name": "अनीता देवी (Anita Devi)",
                "parent_name": "विजय प्रताप (Vijay Pratap)",
                "share_fraction": "1/1",
                "residence": "नि० ग्राम Rampur Kalan"
            }
        ],
        "remarks": "वार्षिक लगान जमा खाता अद्यतन।"
    },
    {
        "id": "SYNTH-UP-2026-004",
        "filename": "sample_04_rotated_ccw.jpg",
        "format": "JPEG",
        "variant": "rotated",
        "rotation_angle": -6.0,
        "description": "Counter-clockwise skewed image (-6.0 deg) testing OCR de-skewing",
        "district": "Barabanki (Synthetic)",
        "tehsil": "Fatehpur (Synthetic)",
        "pargana": "Kursi (Synthetic)",
        "village": "Baragaon",
        "fasli_year": "1430-1435",
        "khata_number": "00142",
        "khasra_numbers": ["54/1", "54/2"],
        "land_area_hectares": 0.6120,
        "revenue_inr": 26.50,
        "landholders": [
            {
                "name": "मोहम्मद आरिफ़ (Mohammad Arif)",
                "parent_name": "इब्राहिम खान (Ibrahim Khan)",
                "share_fraction": "1/1",
                "residence": "नि० ग्राम Baragaon"
            }
        ],
        "remarks": "बंधक रहित भूमि (Unencumbered Agricultural Holding)"
    },
    {
        "id": "SYNTH-UP-2026-005",
        "filename": "sample_05_low_contrast.pdf",
        "format": "PDF",
        "variant": "low_contrast",
        "description": "Faded thermal printout with washed out grey levels and low contrast",
        "district": "Kanpur Nagar (Synthetic)",
        "tehsil": "Ghatampur (Synthetic)",
        "pargana": "Akbarpur (Synthetic)",
        "village": "Govindpur",
        "fasli_year": "1430-1435",
        "khata_number": "00204",
        "khasra_numbers": ["99/1"],
        "land_area_hectares": 1.1500,
        "revenue_inr": 45.00,
        "landholders": [
            {
                "name": "हरिशंकर वर्मा (Harishankar Verma)",
                "parent_name": "बालमुकुंद वर्मा (Balmukund Verma)",
                "share_fraction": "1/1",
                "residence": "नि० ग्राम Govindpur"
            }
        ],
        "remarks": "बैंक शाखा से केसीसी ऋण आबद्ध (KCC Loan Notation)"
    },
    {
        "id": "SYNTH-UP-2026-006",
        "filename": "sample_06_low_contrast.png",
        "format": "PNG",
        "variant": "low_contrast",
        "description": "Grainy low-contrast scanner photocopy image",
        "district": "Prayagraj (Synthetic)",
        "tehsil": "Phulpur (Synthetic)",
        "pargana": "Jhusi (Synthetic)",
        "village": "Kalyanpur",
        "fasli_year": "1430-1435",
        "khata_number": "00073",
        "khasra_numbers": ["16/4"],
        "land_area_hectares": 0.3340,
        "revenue_inr": 15.20,
        "landholders": [
            {
                "name": "सुनीता सिंह (Sunita Singh)",
                "parent_name": "राजेंद्र सिंह (Rajendra Singh)",
                "share_fraction": "1/1",
                "residence": "नि० ग्राम Kalyanpur"
            }
        ],
        "remarks": "धारा 143 अकृषिक प्रयोजन दर्ज नहीं।"
    },
    {
        "id": "SYNTH-UP-2026-007",
        "filename": "sample_07_missing_field.pdf",
        "format": "PDF",
        "variant": "missing_field",
        "description": "Omission anomaly: Parent/Husband name is missing/blank in scan",
        "district": "Lucknow (Synthetic)",
        "tehsil": "Mohanlalganj (Synthetic)",
        "pargana": "Nigohan (Synthetic)",
        "village": "Mohanlalganj",
        "fasli_year": "1430-1435",
        "khata_number": "00412",
        "khasra_numbers": ["210/2"],
        "land_area_hectares": 0.5400,
        "revenue_inr": 22.00,
        "landholders": [
            {
                "name": "रामपाल मौर्य (Rampal Maurya)",
                "parent_name": None,  # Deliberately missing field
                "share_fraction": "1/1",
                "residence": "नि० ग्राम Mohanlalganj"
            }
        ],
        "remarks": "सह-खातेदार विवरण अपूर्ण (Missing lineage entry)"
    },
    {
        "id": "SYNTH-UP-2026-008",
        "filename": "sample_08_missing_field.jpg",
        "format": "JPEG",
        "variant": "missing_field",
        "description": "Omission anomaly: Lagan (Revenue INR) field omitted/blank",
        "district": "Prayagraj (Synthetic)",
        "tehsil": "Soraon (Synthetic)",
        "pargana": "Mau (Synthetic)",
        "village": "Sarai Inayat",
        "fasli_year": "1430-1435",
        "khata_number": "00095",
        "khasra_numbers": ["33/1"],
        "land_area_hectares": 0.2890,
        "revenue_inr": None,  # Deliberately missing field
        "landholders": [
            {
                "name": "गीता देवी (Geeta Devi)",
                "parent_name": "चंद्रभान (Chandrabhan)",
                "share_fraction": "1/1",
                "residence": "नि० ग्राम Sarai Inayat"
            }
        ],
        "remarks": "मालगुजारी छूट अंतर्गत (Revenue exemption noted)"
    },
    {
        "id": "SYNTH-UP-2026-009",
        "filename": "sample_09_duplicate_original.pdf",
        "format": "PDF",
        "variant": "duplicate_original",
        "description": "Original baseline record for SHA-256 duplicate collision verification",
        "district": "Sitapur (Synthetic)",
        "tehsil": "Sidhauli (Synthetic)",
        "pargana": "Bari (Synthetic)",
        "village": "Belha",
        "fasli_year": "1430-1435",
        "khata_number": "00550",
        "khasra_numbers": ["188/5"],
        "land_area_hectares": 0.7200,
        "revenue_inr": 31.00,
        "landholders": [
            {
                "name": "सतीश चंद्र (Satish Chandra)",
                "parent_name": "उमाकांत (Umakant)",
                "share_fraction": "1/1",
                "residence": "नि० ग्राम Belha"
            }
        ],
        "remarks": "मूल दस्तावेज़ - डिजिटल प्रतिलिपि प्रमाणित।"
    },
    {
        "id": "SYNTH-UP-2026-010",
        "filename": "sample_10_duplicate_copy.pdf",
        "format": "PDF",
        "variant": "duplicate_file",
        "description": "Exact byte-for-byte clone of sample_09 for duplicate detection check",
        "source_duplicate_file": "sample_09_duplicate_original.pdf",
        "district": "Sitapur (Synthetic)",
        "tehsil": "Sidhauli (Synthetic)",
        "pargana": "Bari (Synthetic)",
        "village": "Belha",
        "fasli_year": "1430-1435",
        "khata_number": "00550",
        "khasra_numbers": ["188/5"],
        "land_area_hectares": 0.7200,
        "revenue_inr": 31.00,
        "landholders": [
            {
                "name": "सतीश चंद्र (Satish Chandra)",
                "parent_name": "उमाकांत (Umakant)",
                "share_fraction": "1/1",
                "residence": "नि० ग्राम Belha"
            }
        ],
        "remarks": "मूल दस्तावेज़ - डिजिटल प्रतिलिपि प्रमाणित।"
    },
    {
        "id": "SYNTH-UP-2026-011",
        "filename": "sample_11_wrong_khasra.pdf",
        "format": "PDF",
        "variant": "wrong_khasra_number",
        "description": "Document scan contains erroneous Khasra (999/INVALID) differing from Registry (88/9)",
        "district": "Varanasi (Synthetic)",
        "tehsil": "Pindra (Synthetic)",
        "pargana": "Kolaslah (Synthetic)",
        "village": "Shivpur",
        "fasli_year": "1430-1435",
        "khata_number": "00619",
        "khasra_numbers": ["999/INVALID"],  # Deliberate error on document
        "land_area_hectares": 0.4500,
        "revenue_inr": 19.50,
        "landholders": [
            {
                "name": "ब्रजेश कुमार त्रिपाठी (Brajesh Kumar Tripathi)",
                "parent_name": "कमलापति त्रिपाठी (Kamlapati Tripathi)",
                "share_fraction": "1/1",
                "residence": "नि० ग्राम Shivpur"
            }
        ],
        "remarks": "संशोधन प्रार्थना पत्र लंबित (Disputed survey notation)"
    },
    {
        "id": "SYNTH-UP-2026-012",
        "filename": "sample_12_co_tenants_clean.jpg",
        "format": "JPEG",
        "variant": "clean_print",
        "description": "Clean multi-owner co-tenancy with fractional shares",
        "district": "Gorakhpur (Synthetic)",
        "tehsil": "Sahjanwa (Synthetic)",
        "pargana": "Hasanpur (Synthetic)",
        "village": "Alinagar",
        "fasli_year": "1430-1435",
        "khata_number": "00334",
        "khasra_numbers": ["104/1", "104/2"],
        "land_area_hectares": 0.9800,
        "revenue_inr": 40.00,
        "landholders": [
            {
                "name": "मनोज कुमार (Manoj Kumar)",
                "parent_name": "बाबूलाल (Babulal)",
                "share_fraction": "1/2",
                "residence": "नि० ग्राम Alinagar"
            },
            {
                "name": "विनोद कुमार (Vinod Kumar)",
                "parent_name": "बाबूलाल (Babulal)",
                "share_fraction": "1/2",
                "residence": "नि० ग्राम Alinagar"
            }
        ],
        "remarks": "पैतृक उत्तराधिकार (Ancestral Inheritance) दर्ज।"
    }
]

def generate_all_samples():
    print(f"Generating 12 synthetic test documents in {OUTPUT_DIR}...")
    ground_truth = []
    demo_registry = []

    for item in SAMPLE_CONFIGS:
        filename = item["filename"]
        out_path = OUTPUT_DIR / filename
        fmt = item["format"]
        variant = item["variant"]

        # If it's the duplicate copy, clone the original byte-for-byte!
        if variant == "duplicate_file":
            src_file = OUTPUT_DIR / item["source_duplicate_file"]
            shutil.copyfile(src_file, out_path)
            print(f"  [10/12] Cloned duplicate file: {filename} from {item['source_duplicate_file']}")
        else:
            # Render base image
            base_img = draw_khatauni_base(item)

            # Apply variant transformations
            if variant == "rotated":
                angle = item.get("rotation_angle", 5.0)
                base_img = apply_skew_rotation(base_img, angle)
            elif variant == "low_contrast":
                if fmt == "PNG":
                    base_img = apply_noisy_fax(base_img)
                else:
                    base_img = apply_low_contrast(base_img)

            # Save in requested format
            if fmt == "PDF":
                base_img.save(str(out_path), "PDF", resolution=150.0)
            elif fmt == "PNG":
                base_img.save(str(out_path), "PNG", optimize=True)
            elif fmt in ("JPEG", "JPG"):
                base_img.convert("RGB").save(str(out_path), "JPEG", quality=88)

            print(f"  Generated {filename} ({variant}, {fmt}) -> {out_path.stat().st_size // 1024} KB")

        # Record Ground Truth (actual printed content on the document scan)
        gt_entry = {
            "document_id": item["id"],
            "filename": filename,
            "format": fmt,
            "variant_type": variant,
            "description": item["description"],
            "state": "Uttar Pradesh",
            "district": item["district"],
            "tehsil": item["tehsil"],
            "pargana": item["pargana"],
            "village": item["village"],
            "fasli_year": item["fasli_year"],
            "khata_number": item["khata_number"],
            "khasra_numbers": item["khasra_numbers"],
            "land_area_hectares": item["land_area_hectares"],
            "revenue_inr": item["revenue_inr"],
            "landholders": item["landholders"],
            "remarks": item["remarks"],
            "synthetic_watermark_present": True
        }
        ground_truth.append(gt_entry)

        # Build Demo Registry Entry (fictional government database records)
        # Note deliberate mismatches:
        # 1. For sample_11: Registry contains legitimate Khasra "88/9", while document printed "999/INVALID"
        # 2. For sample_07: Registry contains true father's name "स्व० राम भरोसे (Late Ram Bharose)", while document omitted it
        # 3. For sample_08: Registry contains revenue ₹14.50, while document omitted it
        reg_khasra = ["88/9"] if item["id"] == "SYNTH-UP-2026-011" else item["khasra_numbers"]
        
        reg_landholders = []
        for lh in item["landholders"]:
            lh_copy = dict(lh)
            if item["id"] == "SYNTH-UP-2026-007" and lh_copy["parent_name"] is None:
                lh_copy["parent_name"] = "स्व० राम भरोसे (Late Ram Bharose)"
                lh_copy["discrepancy_note"] = "Father name present in registry ledger but missing on physical scan"
            reg_landholders.append(lh_copy)

        reg_revenue = 14.50 if item["id"] == "SYNTH-UP-2026-008" else item["revenue_inr"]

        has_mismatch = (item["id"] in ["SYNTH-UP-2026-007", "SYNTH-UP-2026-008", "SYNTH-UP-2026-011"])
        mismatch_reason = None
        if item["id"] == "SYNTH-UP-2026-011":
            mismatch_reason = "CRITICAL_MISMATCH: Document scan shows Khasra 999/INVALID whereas Official Registry records Khasra 88/9"
        elif item["id"] == "SYNTH-UP-2026-007":
            mismatch_reason = "METADATA_OMISSION: Document scan omitted parent lineage recorded in Registry"
        elif item["id"] == "SYNTH-UP-2026-008":
            mismatch_reason = "METADATA_OMISSION: Document scan omitted revenue field (Registry has ₹14.50)"

        registry_entry = {
            "registry_record_id": f"REG-UP-REF-{item['id'][-3:]}",
            "document_reference": filename,
            "document_id": item["id"],
            "notice": "Demo registry match - not an official government verification",
            "state": "Uttar Pradesh",
            "district": item["district"],
            "tehsil": item["tehsil"],
            "pargana": item["pargana"],
            "village": item["village"],
            "fasli_year": item["fasli_year"],
            "khata_number": item["khata_number"],
            "khasra_numbers": reg_khasra,
            "land_area_hectares": item["land_area_hectares"],
            "revenue_inr": reg_revenue,
            "landholders": reg_landholders,
            "verified_in_registry": True,
            "has_deliberate_mismatch": has_mismatch,
            "mismatch_reason": mismatch_reason
        }
        demo_registry.append(registry_entry)

    # Write sample_data/ground_truth.json
    gt_path = SAMPLE_DATA_DIR / "ground_truth.json"
    with open(gt_path, "w", encoding="utf-8") as f:
        json.dump({
            "disclaimer": "SYNTHETIC DEMO GROUND TRUTH - FOR OCR & VERIFICATION BENCHMARKING ONLY",
            "total_samples": len(ground_truth),
            "samples": ground_truth
        }, f, indent=2, ensure_ascii=False)
    print(f"Written Ground Truth to {gt_path}")

    # Write sample_data/demo_registry.json
    reg_path = SAMPLE_DATA_DIR / "demo_registry.json"
    with open(reg_path, "w", encoding="utf-8") as f:
        json.dump({
            "disclaimer": "Demo registry match - not an official government verification",
            "total_records": len(demo_registry),
            "registry_records": demo_registry
        }, f, indent=2, ensure_ascii=False)
    print(f"Written Demo Registry to {reg_path}")

if __name__ == "__main__":
    generate_all_samples()
