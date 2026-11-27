"""
segment_image.py - Step 11.8: Generate, display side-by-side, and save a colored
SegFormer segmentation mask for a processed construction photograph.

Reuses MODEL_NAME, PROCESSED_DIR, and find_prepared_image from segformer_test.py.
Saves outputs into data/images/segmented/ without touching originals, CSV data,
or the XGBoost model.
"""

import os
import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image, UnidentifiedImageError
from transformers import (
    SegformerForSemanticSegmentation,
    SegformerImageProcessor,
)

from config import DATA_DIR
from segformer_test import MODEL_NAME, PROCESSED_DIR, find_prepared_image

SEGMENTED_DIR = os.path.join(DATA_DIR, "images", "segmented")


def build_color_palette(num_classes: int, seed: int = 42) -> np.ndarray:
    """Create a repeatable RGB color table (num_classes, 3) for class IDs."""
    rng = np.random.default_rng(seed)
    palette = rng.integers(40, 245, size=(num_classes, 3), dtype=np.uint8)
    return palette


def logits_to_mask(logits: torch.Tensor, target_height: int, target_width: int) -> np.ndarray:
    """
    Resize SegFormer logits to (target_height, target_width) with bilinear
    interpolation and pick the highest-scoring class ID per pixel using argmax.
    """
    upsampled_logits = F.interpolate(
        logits,
        size=(target_height, target_width),
        mode="bilinear",
        align_corners=False,
    )
    class_mask = upsampled_logits.argmax(dim=1)[0].cpu().numpy()
    return class_mask


def mask_to_color_image(class_mask: np.ndarray, palette: np.ndarray) -> Image.Image:
    """Convert a 2D class-ID mask (H, W) into a colored RGB Pillow Image."""
    color_array = palette[class_mask]
    return Image.fromarray(color_array, mode="RGB")


def main() -> None:
    print("=" * 65)
    print("   AI Bridge X – Segmentation Mask Generator (Step 11.8)")
    print("=" * 65)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device      : {device}")
    print(f"Checkpoint  : {MODEL_NAME}")

    # 1. Load one actual processed construction photograph
    image_path = find_prepared_image()
    if image_path is None:
        print(f"\nNo processed image found in: {PROCESSED_DIR}")
        print("Please run 'python prepare_images.py' (Step 11.6) first.")
        return

    filename = os.path.basename(image_path)
    stem = os.path.splitext(filename)[0]
    print(f"Input Image : {image_path}")

    try:
        with Image.open(image_path) as img_file:
            original_image = img_file.convert("RGB")
    except (UnidentifiedImageError, OSError) as err:
        print(f"\nImage Load Error: {err}")
        return

    width, height = original_image.size
    print(f"Image Size  : {width} x {height} (width x height)")

    # 2. Load the pretrained SegFormer processor & model (reused from Step 11.7)
    print("\nLoading pretrained SegFormer model...")
    try:
        processor = SegformerImageProcessor.from_pretrained(MODEL_NAME)
        model = SegformerForSemanticSegmentation.from_pretrained(MODEL_NAME)
        model.to(device)
        model.eval()
    except (OSError, RuntimeError) as err:
        print(f"\nModel Load Error: {err}")
        return

    # 3. Preprocess and run inference without gradient tracking
    inputs = processor(images=original_image, return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}

    print("Running SegFormer inference...")
    with torch.no_grad():
        outputs = model(**inputs)

    print(f"Raw Logits Shape        : {tuple(outputs.logits.shape)}")

    # 4. Resize logits to (height, width) and convert to pixel class IDs via argmax
    seg_mask = logits_to_mask(outputs.logits, target_height=height, target_width=width)
    print(f"Segmentation Mask Shape : {seg_mask.shape} (height x width)")

    # 5. Build colored mask from model's actual class labels
    id2label = model.config.id2label
    num_classes = len(id2label)
    palette = build_color_palette(num_classes)
    mask_image = mask_to_color_image(seg_mask, palette)

    # 6. Compute and print detected class IDs and names (largest areas first)
    unique_ids, counts = np.unique(seg_mask, return_counts=True)
    total_pixels = seg_mask.size
    detected = sorted(
        zip(unique_ids.tolist(), counts.tolist()),
        key=lambda item: item[1],
        reverse=True,
    )

    print(f"\nDetected ADE20K Classes ({len(detected)} unique labels):")
    print("-" * 55)
    for class_id, pixel_count in detected:
        label_name = id2label.get(class_id, f"class_{class_id}")
        pct = (pixel_count / total_pixels) * 100
        print(f"  ID {class_id:>3d} | {label_name:<22s} | {pct:6.2f}% ({pixel_count:,} px)")
    print("-" * 55)

    # 7. Save colored segmentation mask & side-by-side comparison in data/images/segmented/
    os.makedirs(SEGMENTED_DIR, exist_ok=True)
    mask_out_path = os.path.join(SEGMENTED_DIR, f"{stem}_mask.png")
    comparison_out_path = os.path.join(SEGMENTED_DIR, f"{stem}_comparison.png")

    mask_image.save(mask_out_path, format="PNG")

    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    axes[0].imshow(original_image)
    axes[0].set_title(f"Original Prepared Photo\n({filename})")
    axes[0].axis("off")

    axes[1].imshow(mask_image)
    axes[1].set_title("SegFormer Colored Segmentation Mask\n(General ADE20K Labels)")
    axes[1].axis("off")

    # Add a compact legend for the top 8 detected classes
    legend_handles = []
    for class_id, pixel_count in detected[:8]:
        label_name = id2label.get(class_id, f"class_{class_id}")
        pct = (pixel_count / total_pixels) * 100
        rgb_norm = palette[class_id] / 255.0
        legend_handles.append(
            mpatches.Patch(color=rgb_norm, label=f"{label_name} ({pct:.1f}%)")
        )

    fig.legend(
        handles=legend_handles,
        loc="lower center",
        ncol=4,
        frameon=True,
        fontsize=9,
    )
    plt.tight_layout(rect=[0, 0.10, 1, 1])
    plt.savefig(comparison_out_path, dpi=150, bbox_inches="tight")

    # Verify saved PNGs open cleanly
    with Image.open(mask_out_path) as check_mask:
        print(f"\nSaved Mask Image       : {mask_out_path} ({check_mask.size[0]}x{check_mask.size[1]}, {check_mask.mode})")
    with Image.open(comparison_out_path) as check_comp:
        print(f"Saved Side-by-Side Img : {comparison_out_path} ({check_comp.size[0]}x{check_comp.size[1]}, {check_comp.mode})")

    print("\nOpening side-by-side window (close the window to finish)...")
    plt.show()
    plt.close(fig)

    print("=" * 65)
    print("   Step 11.8 segmentation mask generation complete!")
    print("=" * 65)


if __name__ == "__main__":
    main()
