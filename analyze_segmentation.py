"""
analyze_segmentation.py - Step 11.9: Inspect SegFormer's actual label
configuration, analyze pixel-level segmentation predictions on processed
construction photos, and save a CSV report into a separate outputs/ folder.

Reuses MODEL_NAME, PROCESSED_DIR from segformer_test.py and logits_to_mask,
SEGMENTED_DIR from segment_image.py. Does not modify original photos,
data/construction_tasks.csv, or models/delay_predictor.pkl.
"""

import csv
import os
import numpy as np
import torch
from PIL import Image, UnidentifiedImageError
from transformers import (
    SegformerForSemanticSegmentation,
    SegformerImageProcessor,
)

from config import BASE_DIR
from segformer_test import MODEL_NAME, PROCESSED_DIR, SUPPORTED_EXTENSIONS
from segment_image import SEGMENTED_DIR, logits_to_mask

REPORTS_DIR = os.path.join(BASE_DIR, "outputs")
REPORT_CSV_PATH = os.path.join(REPORTS_DIR, "segmentation_report.csv")

# Keywords to check whether SegFormer's actual label config includes construction-relevant terms
CONSTRUCTION_KEYWORDS = (
    "building",
    "wall",
    "bridge",
    "road",
    "sidewalk",
    "path",
    "earth",
    "ground",
    "dirt",
    "sand",
    "rock",
    "concrete",
    "steel",
    "rebar",
    "excavat",
    "crane",
    "truck",
    "car",
    "van",
    "vehicle",
    "equipment",
    "sky",
    "tree",
)


def inspect_saved_masks() -> list[str]:
    """Check what saved segmentation masks currently exist in data/images/segmented/."""
    if not os.path.isdir(SEGMENTED_DIR):
        return []
    return sorted(
        f for f in os.listdir(SEGMENTED_DIR)
        if os.path.isfile(os.path.join(SEGMENTED_DIR, f)) and f.lower().endswith(".png")
    )


def check_relevant_model_labels(id2label: dict[int, str]) -> dict[str, list[tuple[int, str]]]:
    """Search the model's real id2label dictionary for construction-related keywords."""
    matches: dict[str, list[tuple[int, str]]] = {}
    for kw in CONSTRUCTION_KEYWORDS:
        found = [
            (int(cid), str(name))
            for cid, name in sorted(id2label.items())
            if kw in str(name).lower()
        ]
        matches[kw] = found
    return matches


def build_report_rows(
    image_filename: str,
    class_mask: np.ndarray,
    id2label: dict[int, str],
) -> list[dict]:
    """Calculate pixel count and percentage for every predicted class in class_mask."""
    total_pixels = int(class_mask.size)
    unique_ids, counts = np.unique(class_mask, return_counts=True)
    pairs = sorted(
        zip(unique_ids.tolist(), counts.tolist()),
        key=lambda item: item[1],
        reverse=True,
    )

    rows: list[dict] = []
    for class_id, pixel_count in pairs:
        label_name = str(id2label.get(class_id, f"class_{class_id}"))
        pct = round((pixel_count / total_pixels) * 100, 2)
        rows.append(
            {
                "image_filename": image_filename,
                "predicted_class_id": class_id,
                "predicted_class_name": label_name,
                "pixel_count": pixel_count,
                "percentage_of_image_pixels": pct,
            }
        )
    return rows


def save_report_csv(rows: list[dict], output_path: str) -> None:
    """Save segmentation analysis rows to a separate CSV file."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    fieldnames = [
        "image_filename",
        "predicted_class_id",
        "predicted_class_name",
        "pixel_count",
        "percentage_of_image_pixels",
    ]
    with open(output_path, mode="w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    print("=" * 65)
    print("   AI Bridge X – Segmentation Results Analysis (Step 11.9)")
    print("=" * 65)

    # 1. Inspect saved segmentation masks folder
    saved_masks = inspect_saved_masks()
    print(f"Segmented Masks Folder : {SEGMENTED_DIR}")
    if saved_masks:
        print(f"Saved Mask Files ({len(saved_masks)})  : {saved_masks}")
    else:
        print("Saved Mask Files (0)   : None yet (run 'python segment_image.py' to save mask PNGs).")

    # 2. Find processed images to analyze
    if not os.path.isdir(PROCESSED_DIR):
        print(f"\nProcessed folder not found: {PROCESSED_DIR}")
        print("Run 'python prepare_images.py' first.")
        return

    image_files = sorted(
        os.path.join(PROCESSED_DIR, f)
        for f in os.listdir(PROCESSED_DIR)
        if os.path.isfile(os.path.join(PROCESSED_DIR, f))
        and f.lower().endswith(SUPPORTED_EXTENSIONS)
    )
    if not image_files:
        print(f"\nNo processed images found in {PROCESSED_DIR}.")
        return

    # 3. Load SegFormer model & inspect its actual label configuration
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\nLoading pretrained SegFormer ({MODEL_NAME}) on {device}...")
    try:
        processor = SegformerImageProcessor.from_pretrained(MODEL_NAME)
        model = SegformerForSemanticSegmentation.from_pretrained(MODEL_NAME)
        model.to(device)
        model.eval()
    except (OSError, RuntimeError) as err:
        print(f"\nModel Load Error: {err}")
        return

    id2label = {int(k): str(v) for k, v in model.config.id2label.items()}
    print(f"Total Model Labels     : {len(id2label)}")

    print("\nChecking Which Construction-Related Keywords Exist in Model Labels:")
    print("-" * 65)
    keyword_matches = check_relevant_model_labels(id2label)
    for kw, found in keyword_matches.items():
        if found:
            summary = ", ".join(f"{cid}:{name}" for cid, name in found)
            print(f"  '{kw:<10s}' -> PRESENT : {summary}")
        else:
            print(f"  '{kw:<10s}' -> NOT in model labels")

    # 4. Run inference and compute pixel percentages for each processed image
    all_rows: list[dict] = []
    for img_path in image_files:
        filename = os.path.basename(img_path)
        try:
            with Image.open(img_path) as f:
                image = f.convert("RGB")
        except (UnidentifiedImageError, OSError) as err:
            print(f"\nSkipping unreadable image '{filename}': {err}")
            continue

        width, height = image.size
        inputs = processor(images=image, return_tensors="pt")
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = model(**inputs)

        seg_mask = logits_to_mask(outputs.logits, target_height=height, target_width=width)
        rows = build_report_rows(filename, seg_mask, id2label)
        all_rows.extend(rows)

        print("\n" + "-" * 65)
        print(f"Segmentation Analysis: {filename} ({width}x{height} = {seg_mask.size:,} px)")
        print("-" * 65)
        print(f"  {'ID':<5} {'Class Name':<24} {'Pixels':>12} {'Share (%)':>10}")
        print("  " + "-" * 55)
        for row in rows:
            print(
                f"  {row['predicted_class_id']:<5} "
                f"{row['predicted_class_name']:<24} "
                f"{row['pixel_count']:>12,} "
                f"{row['percentage_of_image_pixels']:>9.2f}%"
            )

    if not all_rows:
        print("\nNo valid images analyzed; report not written.")
        return

    # 5. Save CSV report into separate outputs/ folder
    save_report_csv(all_rows, REPORT_CSV_PATH)
    print("\n" + "=" * 65)
    print(f"Saved CSV report to: {REPORT_CSV_PATH}")
    print(f"Total report rows  : {len(all_rows)}")
    print("Original images, construction_tasks.csv, and delay_predictor.pkl untouched.")
    print("=" * 65)


if __name__ == "__main__":
    main()
