"""
compare_segmentation.py - Step 11.12: Combine SegFormer semantic segmentation
with 2-photo comparison.

Reuses existing helpers from segformer_test.py, segment_image.py, and
compare_images.py without modifying any existing scripts, dataset, or ML model.
Saves the 5-panel visual report inside data/images/reports/.
"""

import os
import matplotlib.pyplot as plt
import numpy as np
import torch
from PIL import Image, UnidentifiedImageError
from transformers import (
    SegformerForSemanticSegmentation,
    SegformerImageProcessor,
)

from config import DATA_DIR
from compare_images import TEST_IMAGES_DIR, find_candidate_images, load_and_match_images
from segformer_test import MODEL_NAME
from segment_image import build_color_palette, logits_to_mask, mask_to_color_image

REPORTS_DIR = os.path.join(DATA_DIR, "images", "reports")


def segment_pil_image(
    image: Image.Image,
    processor: SegformerImageProcessor,
    model: SegformerForSemanticSegmentation,
    device: torch.device,
) -> np.ndarray:
    """Run SegFormer inference on one RGB Pillow image and return its (H, W) class mask."""
    width, height = image.size
    inputs = processor(images=image, return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model(**inputs)

    return logits_to_mask(outputs.logits, target_height=height, target_width=width)


def compare_masks_and_stats(
    mask1: np.ndarray,
    mask2: np.ndarray,
    id2label: dict[int, str],
) -> tuple[np.ndarray, float, list[dict]]:
    """
    Compare two (H, W) class-ID masks pixel-by-pixel and compute class-wise
    pixel counts and percentage shares for both images.
    """
    changed_mask = mask1 != mask2
    changed_pct = round(float(changed_mask.mean() * 100.0), 2)

    total1 = int(mask1.size)
    total2 = int(mask2.size)

    ids1, cnts1 = np.unique(mask1, return_counts=True)
    ids2, cnts2 = np.unique(mask2, return_counts=True)
    map1 = dict(zip(ids1.tolist(), cnts1.tolist()))
    map2 = dict(zip(ids2.tolist(), cnts2.tolist()))

    all_ids = sorted(set(map1.keys()) | set(map2.keys()))
    stats_rows: list[dict] = []
    for cid in all_ids:
        px1 = map1.get(cid, 0)
        px2 = map2.get(cid, 0)
        pct1 = round((px1 / total1) * 100.0, 2)
        pct2 = round((px2 / total2) * 100.0, 2)
        diff_pct = round(pct2 - pct1, 2)
        stats_rows.append(
            {
                "class_id": cid,
                "class_name": str(id2label.get(cid, f"class_{cid}")),
                "pixels_1": px1,
                "pct_1": pct1,
                "pixels_2": px2,
                "pct_2": pct2,
                "diff_pct": diff_pct,
            }
        )

    # Sort by largest absolute percentage change (or max presence) first
    stats_rows.sort(key=lambda r: (abs(r["diff_pct"]), max(r["pct_1"], r["pct_2"])), reverse=True)
    return changed_mask, changed_pct, stats_rows


def build_difference_overlay(img2: Image.Image, changed_mask: np.ndarray) -> np.ndarray:
    """Highlight pixels where predicted SegFormer class changed in bright red over Photo 2."""
    base = np.asarray(img2, dtype=np.float32) * 0.45
    overlay = base.copy()
    overlay[changed_mask] = [235.0, 45.0, 45.0]  # Red highlight on changed semantic regions
    return np.clip(overlay, 0, 255).astype(np.uint8)


def save_combined_visual_report(
    img1: Image.Image,
    img2: Image.Image,
    mask_img1: Image.Image,
    mask_img2: Image.Image,
    diff_overlay: np.ndarray,
    name1: str,
    name2: str,
    changed_pct: float,
    stats_rows: list[dict],
    out_path: str,
    show_window: bool = True,
) -> None:
    """Create and save the 5-panel visual report plus summary panel to out_path."""
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    fig, axes = plt.subplots(2, 3, figsize=(16, 10))

    axes[0, 0].imshow(img1)
    axes[0, 0].set_title(f"1. Original Photo 1\n{name1}")
    axes[0, 0].axis("off")

    axes[0, 1].imshow(img2)
    axes[0, 1].set_title(f"2. Original Photo 2\n{name2}")
    axes[0, 1].axis("off")

    axes[0, 2].imshow(diff_overlay)
    axes[0, 2].set_title(
        f"5. Segmentation Difference Map\nRed = Region Changed ({changed_pct:.2f}% of pixels)"
    )
    axes[0, 2].axis("off")

    axes[1, 0].imshow(mask_img1)
    axes[1, 0].set_title("3. Segmentation Mask 1\n(General ADE20K Labels)")
    axes[1, 0].axis("off")

    axes[1, 1].imshow(mask_img2)
    axes[1, 1].set_title("4. Segmentation Mask 2\n(General ADE20K Labels)")
    axes[1, 1].axis("off")

    # Panel 6: Text summary of top class changes (not construction completion %)
    axes[1, 2].axis("off")
    lines = ["Top Predicted Class Shifts (ADE20K):\n"]
    for row in stats_rows[:8]:
        lines.append(
            f"{row['class_name'][:16]:<16} {row['pct_1']:5.1f}% -> {row['pct_2']:5.1f}% ({row['diff_pct']:+.1f}%)"
        )
    lines.append("\nNote: Pixel shifts are visual region")
    lines.append("changes only, NOT verified completion %.")
    axes[1, 2].text(
        0.02,
        0.95,
        "\n".join(lines),
        va="top",
        ha="left",
        fontsize=9.5,
        family="monospace",
        bbox={"boxstyle": "round,pad=0.6", "facecolor": "#f4f6f8", "edgecolor": "#cccccc"},
    )
    axes[1, 2].set_title("Class Share Summary")

    fig.suptitle(
        "AI Bridge X – SegFormer + Image Comparison Report (Step 11.12)",
        fontsize=13,
    )
    plt.tight_layout()
    plt.savefig(out_path, dpi=150, bbox_inches="tight")

    if show_window:
        print("\nOpening 5-panel visual report window (close window to finish)...")
        plt.show()
    plt.close(fig)


def main() -> None:
    print("=" * 65)
    print("   AI Bridge X – SegFormer + Image Comparison (Step 11.12)")
    print("=" * 65)

    candidates = find_candidate_images()
    print(f"Checking photos in: {TEST_IMAGES_DIR}")
    print(f"Found {len(candidates)} candidate image(s):")
    for idx, p in enumerate(candidates, start=1):
        print(f"  {idx}. {os.path.basename(p)}")

    if len(candidates) < 2:
        print("\nAt least TWO construction photos are required for combined comparison.")
        print("Add a 2nd construction photo (.jpg or .png) into:")
        print(f"  {TEST_IMAGES_DIR}")
        print("Then run 'python compare_segmentation.py' again.")
        return

    path1, path2 = candidates[0], candidates[1]
    name1, name2 = os.path.basename(path1), os.path.basename(path2)

    try:
        img1, img2 = load_and_match_images(path1, path2)
    except (UnidentifiedImageError, OSError) as err:
        print(f"\nImage Load Error: {err}")
        return

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

    print(f"Segmenting Photo 1 ({name1}, {img1.size[0]}x{img1.size[1]})...")
    mask1 = segment_pil_image(img1, processor, model, device)

    print(f"Segmenting Photo 2 ({name2}, {img2.size[0]}x{img2.size[1]})...")
    mask2 = segment_pil_image(img2, processor, model, device)

    id2label = {int(k): str(v) for k, v in model.config.id2label.items()}
    palette = build_color_palette(len(id2label))
    mask_img1 = mask_to_color_image(mask1, palette)
    mask_img2 = mask_to_color_image(mask2, palette)

    changed_mask, changed_pct, stats_rows = compare_masks_and_stats(mask1, mask2, id2label)
    diff_overlay = build_difference_overlay(img2, changed_mask)

    print("\n" + "-" * 72)
    print(f"CLASS-WISE PIXEL COMPARISON ({img1.size[0]}x{img1.size[1]} matched RGB)")
    print(f"Regions with changed predicted label: {changed_pct:.2f}% of pixels")
    print("-" * 72)
    print(f"  {'ID':<4} {'ADE20K Class':<20} {'Photo 1':>14} {'Photo 2':>14} {'Shift':>9}")
    print("  " + "-" * 65)
    for row in stats_rows:
        p1_str = f"{row['pixels_1']:,} ({row['pct_1']:.1f}%)"
        p2_str = f"{row['pixels_2']:,} ({row['pct_2']:.1f}%)"
        print(
            f"  {row['class_id']:<4} {row['class_name'][:20]:<20} "
            f"{p1_str:>14} {p2_str:>14} {row['diff_pct']:>+8.1f}%"
        )
    print("-" * 72)

    stem1 = os.path.splitext(name1)[0]
    stem2 = os.path.splitext(name2)[0]
    out_path = os.path.join(REPORTS_DIR, f"seg_report_{stem1}_vs_{stem2}.png")
    counter = 1
    while os.path.exists(out_path):
        out_path = os.path.join(REPORTS_DIR, f"seg_report_{stem1}_vs_{stem2}_{counter}.png")
        counter += 1

    save_combined_visual_report(
        img1=img1,
        img2=img2,
        mask_img1=mask_img1,
        mask_img2=mask_img2,
        diff_overlay=diff_overlay,
        name1=name1,
        name2=name2,
        changed_pct=changed_pct,
        stats_rows=stats_rows,
        out_path=out_path,
        show_window=True,
    )

    with Image.open(out_path) as check_rep:
        print(f"\nSaved visual report to: {out_path} ({check_rep.size[0]}x{check_rep.size[1]}, {check_rep.mode})")
    print("Note: Segmentation change is a visual clue only—engineers must verify actual progress.")
    print("=" * 65)


if __name__ == "__main__":
    main()
