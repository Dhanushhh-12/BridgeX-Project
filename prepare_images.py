"""
prepare_images.py - Step 11.6: Prepare construction site images for SegFormer.
Opens photos from bridgeX/data/images/ (without modifying originals), converts
them to RGB, resizes them while preserving aspect ratio, saves clean copies
into data/images/processed/, and verifies every saved file opens properly.
"""

import os
from PIL import Image, ImageOps, UnidentifiedImageError

from config import DATA_DIR

IMAGES_BASE_DIR = os.path.join(DATA_DIR, "images")
PROCESSED_DIR = os.path.join(IMAGES_BASE_DIR, "processed")

# Source folders to inspect (explicitly excludes 'processed' so we never re-process outputs)
SOURCE_FOLDERS = [
    os.path.join(IMAGES_BASE_DIR, "test"),
    os.path.join(IMAGES_BASE_DIR, "raw"),
    os.path.join(IMAGES_BASE_DIR, "train"),
    os.path.join(IMAGES_BASE_DIR, "validation"),
]

SUPPORTED_EXTENSIONS = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
MAX_DIMENSION = 1024  # Max width or height (px) while preserving aspect ratio


def collect_source_images() -> list[str]:
    """Find all supported image files inside the source folders."""
    image_paths: list[str] = []
    seen = set()

    for folder in SOURCE_FOLDERS:
        if not os.path.isdir(folder):
            continue
        for entry in sorted(os.listdir(folder)):
            full_path = os.path.join(folder, entry)
            if (
                os.path.isfile(full_path)
                and entry.lower().endswith(SUPPORTED_EXTENSIONS)
                and full_path not in seen
            ):
                image_paths.append(full_path)
                seen.add(full_path)

    return image_paths


def prepare_single_image(src_path: str, output_dir: str, max_size: int = MAX_DIMENSION) -> str | None:
    """
    Open an image, fix EXIF orientation, convert to RGB, resize with aspect ratio
    preserved, save into output_dir, and verify the saved copy opens cleanly.
    """
    filename = os.path.basename(src_path)
    stem, ext = os.path.splitext(filename)
    out_ext = ".png" if ext.lower() == ".png" else ".jpg"
    out_path = os.path.join(output_dir, f"{stem}_prepared{out_ext}")

    print("-" * 65)
    print(f"Original : {filename}")
    print(f"Source   : {src_path}")

    try:
        with Image.open(src_path) as raw_img:
            # Respect camera rotation metadata before reading size
            img = ImageOps.exif_transpose(raw_img)
            orig_w, orig_h = img.size
            orig_mode = img.mode
            orig_format = raw_img.format

            print(f"  Original Info  : format={orig_format}, size={orig_w}x{orig_h}, mode={orig_mode}")

            # Convert RGBA / grayscale / palette images cleanly to 3-channel RGB
            if img.mode != "RGB":
                img = img.convert("RGB")
                print(f"  Converted Mode : {orig_mode} -> RGB")

            # Resize in-place while preserving exact aspect ratio (never stretches)
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            new_w, new_h = img.size

            if out_ext == ".png":
                img.save(out_path, format="PNG")
            else:
                img.save(out_path, format="JPEG", quality=95)

            print(f"  Resized Info   : {new_w}x{new_h} (aspect ratio preserved)")
            print(f"  Saved Copy To  : {out_path}")

    except (UnidentifiedImageError, OSError) as err:
        print(f"  ERROR: Could not process '{filename}' ({err})")
        return None

    # Verify the processed copy can be opened cleanly with Pillow
    try:
        with Image.open(out_path) as check_img:
            check_img.verify()
        with Image.open(out_path) as verified_img:
            v_w, v_h = verified_img.size
            print(f"  Verified Copy  : OK (format={verified_img.format}, size={v_w}x{v_h}, mode={verified_img.mode})")
    except (UnidentifiedImageError, OSError) as err:
        print(f"  Verification ERROR for '{out_path}': {err}")
        return None

    return out_path


def main() -> None:
    print("=" * 65)
    print("   AI Bridge X – Preparing Images for SegFormer (Step 11.6)")
    print("=" * 65)
    print(f"Source Base Folder : {IMAGES_BASE_DIR}")
    print(f"Processed Output   : {PROCESSED_DIR}")
    print(f"Target Max Size    : {MAX_DIMENSION} px (aspect ratio preserved)")

    source_images = collect_source_images()
    if not source_images:
        print("\nNo source images found in data/images/test, raw, train, or validation.")
        print("Place 1 or more construction photos (.jpg or .png) into:")
        print(f"  {os.path.join(IMAGES_BASE_DIR, 'test')}")
        print("and run 'python prepare_images.py' again.")
        return

    os.makedirs(PROCESSED_DIR, exist_ok=True)
    print(f"Found {len(source_images)} source image(s).")

    saved_files: list[str] = []
    for src in source_images:
        result = prepare_single_image(src, PROCESSED_DIR, max_size=MAX_DIMENSION)
        if result is not None:
            saved_files.append(result)

    print("-" * 65)
    print(f"Done! {len(saved_files)} of {len(source_images)} image(s) prepared and verified.")
    print("Original photos were NOT modified or overwritten.")
    print("=" * 65)


if __name__ == "__main__":
    main()
