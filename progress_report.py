"""
progress_report.py - Step 11.13: Generate a combined Construction Progress
Analysis Report (CSV + HTML with embedded visuals) using pandas, Pillow,
NumPy image comparison, and SegFormer segmentation outputs.

Reuses existing helpers without modifying original photographs, existing scripts,
data/construction_tasks.csv, or models/delay_predictor.pkl.
Saves all outputs in data/images/reports/ without overwriting existing reports.
"""

from datetime import datetime
import html
import os
import pandas as pd
import torch
from PIL import ExifTags, Image, UnidentifiedImageError
from transformers import (
    SegformerForSemanticSegmentation,
    SegformerImageProcessor,
)

from config import DATA_DIR
from compare_images import (
    RAW_IMAGES_DIR,
    TEST_IMAGES_DIR,
    compute_image_difference,
    load_and_match_images,
)
from compare_segmentation import (
    REPORTS_DIR,
    build_difference_overlay,
    compare_masks_and_stats,
    segment_pil_image,
)
from segformer_test import MODEL_NAME
from segment_image import build_color_palette, mask_to_color_image

# Include .jfif alongside standard JPEG/PNG formats
SUPPORTED_EXTENSIONS = (".jpg", ".jpeg", ".jfif", ".png", ".bmp", ".webp")

LIMITATION_NOTE = (
    "AI observation only: General ADE20K segmentation labels and pixel difference "
    "scores reflect visual changes (including lighting, angle, and weather) and "
    "are NOT verified construction completion percentages. Engineer validation "
    "against site logs and blueprints is required."
)


def find_report_images() -> list[str]:
    """Find candidate images in data/images/test/ (and raw/ if needed), including .jfif."""
    found: list[str] = []
    seen = set()
    for folder in (TEST_IMAGES_DIR, RAW_IMAGES_DIR):
        if not os.path.isdir(folder):
            continue
        for entry in sorted(os.listdir(folder)):
            full_path = os.path.join(folder, entry)
            if (
                os.path.isfile(full_path)
                and entry.lower().endswith(SUPPORTED_EXTENSIONS)
                and full_path not in seen
            ):
                found.append(full_path)
                seen.add(full_path)
    return found


def get_image_date_info(image_path: str) -> str:
    """Return EXIF capture date if recorded; otherwise report file modified time honestly."""
    try:
        with Image.open(image_path) as img:
            exif = img.getexif()
            for tag_id, value in exif.items():
                tag_name = ExifTags.TAGS.get(tag_id, "")
                if tag_name in ("DateTimeOriginal", "DateTimeDigitized", "DateTime") and value:
                    return f"{value} (EXIF)"
    except (UnidentifiedImageError, OSError):
        pass

    mtime = datetime.fromtimestamp(os.path.getmtime(image_path)).strftime("%Y-%m-%d %H:%M")
    return f"Not in EXIF (File Modified: {mtime})"


def unique_output_path(directory: str, base_name: str, extension: str) -> str:
    """Return a non-overwriting file path inside directory."""
    os.makedirs(directory, exist_ok=True)
    candidate = os.path.join(directory, f"{base_name}{extension}")
    counter = 1
    while os.path.exists(candidate):
        candidate = os.path.join(directory, f"{base_name}_{counter}{extension}")
        counter += 1
    return candidate


def build_report_dataframe(
    project_name: str,
    name1: str,
    date1: str,
    name2: str,
    date2: str,
    matched_size: tuple[int, int],
    image_diff_score: float,
    raw_changed_pct: float,
    semantic_changed_pct: float,
    stats_rows: list[dict],
) -> pd.DataFrame:
    """Organize all combined CV analysis fields into a clean pandas DataFrame."""
    visible_summary = "; ".join(
        f"{r['class_name']} ({r['pct_1']:.1f}% -> {r['pct_2']:.1f}%)"
        for r in stats_rows[:3]
    )

    records = []
    for row in stats_rows:
        records.append(
            {
                "project_name": project_name,
                "site_name": "Not specified (sample test images)",
                "photo_1_filename": name1,
                "photo_1_date": date1,
                "photo_2_filename": name2,
                "photo_2_date": date2,
                "matched_dimensions": f"{matched_size[0]}x{matched_size[1]}",
                "predicted_class_id": row["class_id"],
                "predicted_class_name": row["class_name"],
                "photo_1_pixel_count": row["pixels_1"],
                "photo_1_pixel_pct": row["pct_1"],
                "photo_2_pixel_count": row["pixels_2"],
                "photo_2_pixel_pct": row["pct_2"],
                "pixel_share_shift_pct": row["diff_pct"],
                "image_difference_score_pct": image_diff_score,
                "raw_changed_pixels_pct": raw_changed_pct,
                "semantic_region_change_pct": semantic_changed_pct,
                "visible_changes_summary": visible_summary,
                "engineer_validation_status": "Pending engineer review",
                "limitations_and_notes": LIMITATION_NOTE,
            }
        )

    return pd.DataFrame(records)


def save_html_report(
    html_path: str,
    csv_filename: str,
    df_report: pd.DataFrame,
    meta: dict,
    visual_files: dict[str, str],
) -> None:
    """Generate a clean beginner-friendly HTML report with embedded visual outputs."""
    table_cols = [
        "predicted_class_id",
        "predicted_class_name",
        "photo_1_pixel_count",
        "photo_1_pixel_pct",
        "photo_2_pixel_count",
        "photo_2_pixel_pct",
        "pixel_share_shift_pct",
    ]
    table_html = df_report[table_cols].to_html(index=False, border=0, classes="data-table")

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>AI Bridge X – Construction Progress Analysis Report</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 28px; color: #1f2937; background: #f8fafc; }}
    h1 {{ color: #0f172a; margin-bottom: 4px; }}
    .subtitle {{ color: #475569; margin-bottom: 20px; }}
    .card {{ background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 18px; }}
    .warning {{ background: #fffbeb; border: 1px solid #f59e0b; border-radius: 8px; padding: 14px; margin-bottom: 18px; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }}
    figure {{ margin: 0; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center; }}
    figure img {{ max-width: 100%; height: auto; border-radius: 4px; }}
    figcaption {{ font-size: 13px; color: #334155; margin-top: 6px; }}
    .data-table {{ width: 100%; border-collapse: collapse; font-size: 14px; }}
    .data-table th, .data-table td {{ border-bottom: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }}
    .data-table th {{ background: #f1f5f9; }}
  </style>
</head>
<body>
  <h1>AI Bridge X – Visual Progress Analysis Report</h1>
  <div class="subtitle">Generated: {html.escape(meta['generated_at'])} | CSV Report: {html.escape(csv_filename)}</div>

  <div class="warning">
    <strong>Important Validation Notice:</strong> {html.escape(LIMITATION_NOTE)}
  </div>

  <div class="card">
    <h3>1. Project &amp; Image Details</h3>
    <p><strong>Project:</strong> {html.escape(meta['project_name'])} &nbsp;|&nbsp; <strong>Site:</strong> {html.escape(meta['site_name'])}</p>
    <p><strong>Photo 1:</strong> {html.escape(meta['name1'])} — <em>Date: {html.escape(meta['date1'])}</em></p>
    <p><strong>Photo 2:</strong> {html.escape(meta['name2'])} — <em>Date: {html.escape(meta['date2'])}</em></p>
    <p><strong>Matched Dimensions:</strong> {html.escape(meta['matched_dims'])} (RGB) &nbsp;|&nbsp;
       <strong>Image Difference Score:</strong> {meta['image_diff_score']:.2f}% &nbsp;|&nbsp;
       <strong>Raw Changed Pixels (&gt;25/255):</strong> {meta['raw_changed_pct']:.2f}% &nbsp;|&nbsp;
       <strong>Semantic Region Change:</strong> {meta['semantic_changed_pct']:.2f}%</p>
    <p><strong>Top Visible Label Shifts (ADE20K):</strong> {html.escape(meta['visible_summary'])}</p>
  </div>

  <div class="card">
    <h3>2. Visual Comparison &amp; SegFormer Masks</h3>
    <div class="grid">
      <figure><img src="{html.escape(visual_files['img1'])}" alt="Photo 1"><figcaption>Photo 1: {html.escape(meta['name1'])}</figcaption></figure>
      <figure><img src="{html.escape(visual_files['img2'])}" alt="Photo 2"><figcaption>Photo 2: {html.escape(meta['name2'])}</figcaption></figure>
      <figure><img src="{html.escape(visual_files['mask1'])}" alt="Mask 1"><figcaption>SegFormer Mask 1 (ADE20K)</figcaption></figure>
      <figure><img src="{html.escape(visual_files['mask2'])}" alt="Mask 2"><figcaption>SegFormer Mask 2 (ADE20K)</figcaption></figure>
      <figure><img src="{html.escape(visual_files['diff_img'])}" alt="RGB Difference"><figcaption>Raw RGB Pixel Difference ({meta['image_diff_score']:.2f}%)</figcaption></figure>
      <figure><img src="{html.escape(visual_files['seg_diff'])}" alt="Semantic Difference"><figcaption>Semantic Label Difference ({meta['semantic_changed_pct']:.2f}%)</figcaption></figure>
    </div>
  </div>

  <div class="card">
    <h3>3. Class-Wise Pixel Breakdown (General ADE20K Labels)</h3>
    {table_html}
  </div>
</body>
</html>
"""
    with open(html_path, mode="w", encoding="utf-8") as f:
        f.write(html_content)


def main() -> None:
    print("=" * 68)
    print("   AI Bridge X – Construction Progress Analysis Report (Step 11.13)")
    print("=" * 68)

    candidates = find_report_images()
    print(f"Found {len(candidates)} image(s) in data/images/test (or raw):")
    for idx, p in enumerate(candidates, start=1):
        print(f"  {idx}. {os.path.basename(p)}")

    if len(candidates) < 2:
        print("\nAt least TWO photographs are required to build a comparison report.")
        print(f"Add 2 photos inside {TEST_IMAGES_DIR} and re-run.")
        return

    path1, path2 = candidates[0], candidates[1]
    name1, name2 = os.path.basename(path1), os.path.basename(path2)
    date1, date2 = get_image_date_info(path1), get_image_date_info(path2)

    try:
        img1, img2 = load_and_match_images(path1, path2)
    except (UnidentifiedImageError, OSError) as err:
        print(f"\nImage Load Error: {err}")
        return

    # 1. Pixel-level image comparison
    diff_rgb, image_diff_score, raw_changed_pct = compute_image_difference(img1, img2)

    # 2. SegFormer segmentation on both aligned photos
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\nLoading SegFormer ({MODEL_NAME}) on {device}...")
    try:
        processor = SegformerImageProcessor.from_pretrained(MODEL_NAME)
        model = SegformerForSemanticSegmentation.from_pretrained(MODEL_NAME)
        model.to(device)
        model.eval()
    except (OSError, RuntimeError) as err:
        print(f"\nModel Load Error: {err}")
        return

    mask1 = segment_pil_image(img1, processor, model, device)
    mask2 = segment_pil_image(img2, processor, model, device)
    id2label = {int(k): str(v) for k, v in model.config.id2label.items()}

    changed_mask, semantic_changed_pct, stats_rows = compare_masks_and_stats(mask1, mask2, id2label)

    # 3. Organize combined results in a pandas DataFrame
    project_name = "AI Bridge X"
    df_report = build_report_dataframe(
        project_name=project_name,
        name1=name1,
        date1=date1,
        name2=name2,
        date2=date2,
        matched_size=img1.size,
        image_diff_score=image_diff_score,
        raw_changed_pct=raw_changed_pct,
        semantic_changed_pct=semantic_changed_pct,
        stats_rows=stats_rows,
    )

    # 4. Save unique CSV and HTML + embedded images inside data/images/reports/
    csv_path = unique_output_path(REPORTS_DIR, "progress_analysis_report", ".csv")
    report_tag = os.path.splitext(os.path.basename(csv_path))[0]
    assets_dir = os.path.join(REPORTS_DIR, f"{report_tag}_assets")
    os.makedirs(assets_dir, exist_ok=True)

    palette = build_color_palette(len(id2label))
    mask_img1 = mask_to_color_image(mask1, palette)
    mask_img2 = mask_to_color_image(mask2, palette)
    diff_img = Image.fromarray(diff_rgb, mode="RGB")
    seg_diff_img = Image.fromarray(build_difference_overlay(img2, changed_mask), mode="RGB")

    visual_names = {
        "img1": f"{os.path.basename(assets_dir)}/photo1.png",
        "img2": f"{os.path.basename(assets_dir)}/photo2.png",
        "mask1": f"{os.path.basename(assets_dir)}/mask1.png",
        "mask2": f"{os.path.basename(assets_dir)}/mask2.png",
        "diff_img": f"{os.path.basename(assets_dir)}/pixel_diff.png",
        "seg_diff": f"{os.path.basename(assets_dir)}/semantic_diff.png",
    }
    img1.save(os.path.join(assets_dir, "photo1.png"), format="PNG")
    img2.save(os.path.join(assets_dir, "photo2.png"), format="PNG")
    mask_img1.save(os.path.join(assets_dir, "mask1.png"), format="PNG")
    mask_img2.save(os.path.join(assets_dir, "mask2.png"), format="PNG")
    diff_img.save(os.path.join(assets_dir, "pixel_diff.png"), format="PNG")
    seg_diff_img.save(os.path.join(assets_dir, "semantic_diff.png"), format="PNG")

    df_report.to_csv(csv_path, index=False, encoding="utf-8")

    html_path = unique_output_path(REPORTS_DIR, report_tag, ".html")
    meta = {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "project_name": project_name,
        "site_name": "Not specified (sample test images)",
        "name1": name1,
        "date1": date1,
        "name2": name2,
        "date2": date2,
        "matched_dims": f"{img1.size[0]}x{img1.size[1]}",
        "image_diff_score": image_diff_score,
        "raw_changed_pct": raw_changed_pct,
        "semantic_changed_pct": semantic_changed_pct,
        "visible_summary": df_report["visible_changes_summary"].iloc[0],
    }
    save_html_report(html_path, os.path.basename(csv_path), df_report, meta, visual_names)

    print("\n" + "-" * 68)
    print("REPORT SUMMARY")
    print("-" * 68)
    print(f"  Photo 1               : {name1} | {date1}")
    print(f"  Photo 2               : {name2} | {date2}")
    print(f"  Matched Size          : {img1.size[0]} x {img1.size[1]} (RGB)")
    print(f"  Image Diff Score      : {image_diff_score:.2f}%")
    print(f"  Semantic Change       : {semantic_changed_pct:.2f}% of pixels")
    print(f"  Classes Reported      : {len(df_report)} ADE20K classes")
    print(f"  Saved CSV Report      : {csv_path}")
    print(f"  Saved HTML Report     : {html_path}")
    print("  Validation Note       : AI visual report only — NOT engineer-verified completion %.")
    print("=" * 68)


if __name__ == "__main__":
    main()
