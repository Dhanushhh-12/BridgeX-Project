"""
image_test.py - Step 11.5: Load, inspect, validate, and display construction
site images inside bridgeX/data/images/ using the Pillow (PIL) library.
Does not modify construction_tasks.csv or models/delay_predictor.pkl.
"""

import os
from PIL import Image, UnidentifiedImageError

from config import DATA_DIR

# Folders inside bridgeX/data/images/ to scan for construction photos
IMAGES_BASE_DIR = os.path.join(DATA_DIR, "images")
SEARCH_FOLDERS = [
    os.path.join(IMAGES_BASE_DIR, "test"),
    os.path.join(IMAGES_BASE_DIR, "raw"),
    os.path.join(IMAGES_BASE_DIR, "train"),
    os.path.join(IMAGES_BASE_DIR, "validation"),
    IMAGES_BASE_DIR,
]
SUPPORTED_EXTENSIONS = (".jpg", ".jpeg", ".png", ".bmp", ".webp")


def find_image_files() -> list[str]:
    """Collect image file paths from bridgeX/data/images/ subfolders."""
    found_paths: list[str] = []
    seen = set()

    for folder in SEARCH_FOLDERS:
        if not os.path.isdir(folder):
            continue
        for entry in sorted(os.listdir(folder)):
            full_path = os.path.join(folder, entry)
            if (
                os.path.isfile(full_path)
                and entry.lower().endswith(SUPPORTED_EXTENSIONS)
                and full_path not in seen
            ):
                found_paths.append(full_path)
                seen.add(full_path)

    return found_paths


def inspect_and_display_images(image_paths: list[str], max_windows: int = 2) -> None:
    """Validate, inspect metadata, and display construction images with Pillow."""
    shown_count = 0
    valid_count = 0

    for idx, img_path in enumerate(image_paths, start=1):
        filename = os.path.basename(img_path)
        print("-" * 60)
        print(f"Image #{idx}: {filename}")
        print(f"Path     : {img_path}")

        # 1. Check whether the image file is corrupted or unsupported
        try:
            with Image.open(img_path) as check_img:
                check_img.verify()
        except (UnidentifiedImageError, OSError, SyntaxError) as err:
            print(f"Status   : INVALID / CORRUPTED ({err})")
            continue

        # 2. Re-open the verified image to read metadata and pixels safely
        try:
            with Image.open(img_path) as img:
                width, height = img.size
                bands = img.getbands()  # e.g. ('R', 'G', 'B') -> 3 channels

                print("Status   : Valid image loaded successfully!")
                print(f"Filename : {filename}")
                print(f"Format   : {img.format}")
                print(f"Width    : {width} px")
                print(f"Height   : {height} px")
                print(f"Dimensions: {width} x {height} ({width * height:,} total pixels)")
                print(f"Color Mode: {img.mode} ({len(bands)} channels: {bands})")

                valid_count += 1

                # 3. Display image on screen using the default OS image viewer
                if shown_count < max_windows:
                    print("Display  : Opening image preview window...")
                    img.show(title=filename)
                    shown_count += 1
                else:
                    print(f"Display  : Skipped popup (already opened {max_windows} previews).")
        except (UnidentifiedImageError, OSError) as err:
            print(f"Status   : Could not read image pixels ({err})")

    print("-" * 60)
    print(f"Summary: {valid_count} valid image(s) loaded out of {len(image_paths)} file(s).")


def main() -> None:
    print("=" * 60)
    print("   AI Bridge X – Construction Image Loader Test (Step 11.5)")
    print("=" * 60)
    print(f"Checking folder: {IMAGES_BASE_DIR}")

    if not os.path.isdir(IMAGES_BASE_DIR):
        print("\nNotice: The 'data/images/' folder does not exist yet.")
        print("Create the image folders first using:")
        print('  New-Item -ItemType Directory -Force -Path "data\\images\\raw", "data\\images\\train", "data\\images\\validation", "data\\images\\test"')
        print("\nThen place 1 to 3 construction site photos (.jpg or .png) inside:")
        print(f"  {os.path.join(IMAGES_BASE_DIR, 'test')}")
        return

    image_paths = find_image_files()
    if not image_paths:
        print("\nNo construction site images found yet inside 'data/images/'.")
        print("Please manually add 1 to 3 sample construction photos (.jpg, .jpeg, or .png) into:")
        print(f"  {os.path.join(IMAGES_BASE_DIR, 'test')}")
        print("Then run 'python image_test.py' again!")
        return

    print(f"Found {len(image_paths)} image file(s).\n")
    inspect_and_display_images(image_paths)


if __name__ == "__main__":
    main()
