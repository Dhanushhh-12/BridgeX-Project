"""
compare_images.py - Step 11.11: Compare two construction site photographs
taken at different times, compute a pixel-level difference image and simple
image difference score using Pillow + NumPy, and save a 3-panel visual
comparison into data/images/comparisons/.

Note: Image difference scores reflect ALL visual changes (including lighting,
shadows, camera movement, and weather) and are NOT a construction completion %.
Does not modify original images, construction_tasks.csv, or delay_predictor.pkl.
"""

import os
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from config import DATA_DIR

IMAGES_BASE_DIR = os.path.join(DATA_DIR, "images")
TEST_IMAGES_DIR = os.path.join(IMAGES_BASE_DIR, "test")
RAW_IMAGES_DIR = os.path.join(IMAGES_BASE_DIR, "raw")
COMPARISONS_DIR = os.path.join(IMAGES_BASE_DIR, "comparisons")

SUPPORTED_EXTENSIONS = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
MAX_DIMENSION = 800
PIXEL_CHANGE_THRESHOLD = 25  # Ignores tiny compression/camera noise (0-255 scale)


def find_candidate_images() -> list[str]:
    """Find original candidate photos from data/images/test/ (and raw/ if needed)."""
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


def load_and_match_images(
    path1: str,
    path2: str,
    max_size: int = MAX_DIMENSION,
) -> tuple[Image.Image, Image.Image]:
    """
    Open two images, convert both to RGB, resize while preserving aspect ratio,
    and align both to identical dimensions without stretching.
    """
    with Image.open(path1) as f1:
        img1 = ImageOps.exif_transpose(f1).convert("RGB")
    with Image.open(path2) as f2:
        img2 = ImageOps.exif_transpose(f2).convert("RGB")

    # 1. Preserve each image's aspect ratio while capping max side at max_size
    img1.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    img2.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

    # 2. If the two photos have slightly different aspect ratios, center-crop
    #    both to their shared width & height so pixels line up 1-to-1
    if img1.size != img2.size:
        common_w = min(img1.size[0], img2.size[0])
        common_h = min(img1.size[1], img2.size[1])
        img1 = ImageOps.fit(img1, (common_w, common_h), method=Image.Resampling.LANCZOS)
        img2 = ImageOps.fit(img2, (common_w, common_h), method=Image.Resampling.LANCZOS)

    return img1, img2


def compute_image_difference(
    img1: Image.Image,
    img2: Image.Image,
) -> tuple[np.ndarray, float, float]:
    """
    Calculate pixel-by-pixel absolute difference and a simple difference score.

    Returns:
        (diff_rgb_array, difference_score_pct, changed_pixels_pct)
    """
    arr1 = np.asarray(img1, dtype=np.int16)
    arr2 = np.asarray(img2, dtype=np.int16)

    diff_rgb = np.abs(arr1 - arr2).astype(np.uint8)
    mean_diff = float(diff_rgb.mean())
    difference_score_pct = round((mean_diff / 255.0) * 100.0, 2)

    gray_diff = diff_rgb.mean(axis=2)
    changed_pixels_pct = round(float((gray_diff > PIXEL_CHANGE_THRESHOLD).mean() * 100.0), 2)

    return diff_rgb, difference_score_pct, changed_pixels_pct


def create_comparison_figure(
    img1: Image.Image,
    img2: Image.Image,
    diff_rgb: np.ndarray,
    name1: str,
    name2: str,
    diff_score: float,
    changed_pct: float,
    out_path: str,
    show_window: bool = True,
) -> None:
    """Plot Photo 1, Photo 2, and Difference Image side by side and save to out_path."""
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    fig, axes = plt.subplots(1, 3, figsize=(16, 5))

    axes[0].imshow(img1)
    axes[0].set_title(f"Photo 1 (Earlier)\n{name1}")
    axes[0].axis("off")

    axes[1].imshow(img2)
    axes[1].set_title(f"Photo 2 (Later)\n{name2}")
    axes[1].axis("off")

    axes[2].imshow(diff_rgb)
    axes[2].set_title(
        f"Pixel Difference Image\nDiff Score: {diff_score:.2f}% | Changed Pixels: {changed_pct:.2f}%"
    )
    axes[2].axis("off")

    fig.suptitle(
        "AI Bridge X – Construction Site Image Comparison (Visual Pixel Change Only)",
        fontsize=12,
    )
    plt.tight_layout()
    plt.savefig(out_path, dpi=150, bbox_inches="tight")

    if show_window:
        print("\nOpening 3-panel comparison window (close window to finish)...")
        plt.show()
    plt.close(fig)


def main() -> None:
    print("=" * 65)
    print("   AI Bridge X – Construction Image Comparison (Step 11.11)")
    print("=" * 65)
    print(f"Checking photos in: {TEST_IMAGES_DIR}")

    candidates = find_candidate_images()
    print(f"Found {len(candidates)} original image(s):")
    for idx, p in enumerate(candidates, start=1):
        print(f"  {idx}. {os.path.basename(p)}")

    if len(candidates) < 2:
        print("\nAt least TWO construction photos are required for comparison.")
        print("How to add your 2nd photo manually:")
        print("  1. Download a 2nd construction photo of the same site / stage (.jpg or .png).")
        print(f"  2. Copy it into: {TEST_IMAGES_DIR}")
        print("  3. Run 'python compare_images.py' again.")
        return

    path1, path2 = candidates[0], candidates[1]
    name1, name2 = os.path.basename(path1), os.path.basename(path2)

    try:
        img1, img2 = load_and_match_images(path1, path2)
    except (UnidentifiedImageError, OSError) as err:
        print(f"\nImage Load Error: {err}")
        return

    diff_rgb, diff_score, changed_pct = compute_image_difference(img1, img2)

    stem1 = os.path.splitext(name1)[0]
    stem2 = os.path.splitext(name2)[0]
    out_filename = f"compare_{stem1}_vs_{stem2}.png"
    out_path = os.path.join(COMPARISONS_DIR, out_filename)

    # Avoid overwriting an existing comparison file by adding a numeric suffix if needed
    counter = 1
    while os.path.exists(out_path):
        out_path = os.path.join(COMPARISONS_DIR, f"compare_{stem1}_vs_{stem2}_{counter}.png")
        counter += 1

    print("\n" + "-" * 65)
    print("COMPARISON RESULTS")
    print("-" * 65)
    print(f"  Photo 1           : {name1}")
    print(f"  Photo 2           : {name2}")
    print(f"  Matched Size      : {img1.size[0]} x {img1.size[1]} (RGB)")
    print(f"  Difference Score  : {diff_score:.2f}% (average pixel intensity change)")
    print(f"  Changed Pixels    : {changed_pct:.2f}% (pixels changing > {PIXEL_CHANGE_THRESHOLD}/255)")
    print("  Important Note    : Lighting, shadows, camera angle, and weather affect")
    print("                      this score. It is NOT a construction completion %.")
    print("-" * 65)

    create_comparison_figure(
        img1=img1,
        img2=img2,
        diff_rgb=diff_rgb,
        name1=name1,
        name2=name2,
        diff_score=diff_score,
        changed_pct=changed_pct,
        out_path=out_path,
        show_window=True,
    )

    with Image.open(out_path) as check_out:
        print(f"Saved comparison to: {out_path} ({check_out.size[0]}x{check_out.size[1]}, {check_out.mode})")
    print("=" * 65)


if __name__ == "__main__":
    main()
