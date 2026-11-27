"""
segformer_test.py - Step 11.7: Load a pretrained SegFormer model from Hugging Face,
run CPU semantic segmentation inference on a prepared construction image, and
inspect the output tensor dimensions and available class labels.

Note: Uses a general-purpose pretrained ADE20K checkpoint (not trained on
construction-specific progress datasets). Does not modify existing data or models.
"""

import os
import torch
from PIL import Image, UnidentifiedImageError
from transformers import (
    SegformerForSemanticSegmentation,
    SegformerImageProcessor,
)

from config import DATA_DIR

MODEL_NAME = "nvidia/segformer-b0-finetuned-ade-512-512"
PROCESSED_DIR = os.path.join(DATA_DIR, "images", "processed")
SUPPORTED_EXTENSIONS = (".jpg", ".jpeg", ".png", ".bmp", ".webp")


def find_prepared_image() -> str | None:
    """Return the first prepared image path inside data/images/processed/."""
    if not os.path.isdir(PROCESSED_DIR):
        return None
    for entry in sorted(os.listdir(PROCESSED_DIR)):
        full_path = os.path.join(PROCESSED_DIR, entry)
        if os.path.isfile(full_path) and entry.lower().endswith(SUPPORTED_EXTENSIONS):
            return full_path
    return None


def main() -> None:
    print("=" * 65)
    print("   AI Bridge X – Pretrained SegFormer Model Test (Step 11.7)")
    print("=" * 65)

    # 1. Select device (CPU on systems without a CUDA NVIDIA GPU)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"PyTorch Version  : {torch.__version__}")
    print(f"Execution Device : {device}")
    print(f"Checkpoint       : {MODEL_NAME}")

    # 2. Locate prepared construction photograph
    image_path = find_prepared_image()
    if image_path is None:
        print(f"\nNo prepared images found in: {PROCESSED_DIR}")
        print("Please run 'python prepare_images.py' (Step 11.6) first.")
        return

    print(f"Input Image      : {image_path}")

    try:
        with Image.open(image_path) as img_file:
            image = img_file.convert("RGB")
        print(f"Image Dimensions : {image.size[0]} x {image.size[1]} (width x height), mode={image.mode}")
    except (UnidentifiedImageError, OSError) as err:
        print(f"\nImage Load Error: Could not open '{image_path}' ({err})")
        return

    # 3. Download/load pretrained SegFormer processor & model
    print("\nLoading pretrained SegFormer processor and model...")
    print("(First run downloads ~15 MB from Hugging Face; later runs use local cache.)")
    try:
        processor = SegformerImageProcessor.from_pretrained(MODEL_NAME)
        model = SegformerForSemanticSegmentation.from_pretrained(MODEL_NAME)
        model.to(device)
        model.eval()  # Switch to evaluation/inference mode (not training)
    except OSError as err:
        print(f"\nModel Download / Cache Error: {err}")
        print("Check your internet connection for the first download and try again.")
        return
    except RuntimeError as err:
        print(f"\nModel Loading / Memory Error: {err}")
        print("Close heavy background apps to free RAM and try again.")
        return

    # 4. Preprocess image into normalized PyTorch tensors
    inputs = processor(images=image, return_tensors="pt")
    inputs = {key: val.to(device) for key, val in inputs.items()}
    print(f"Preprocessed Tensor Shape : {tuple(inputs['pixel_values'].shape)}")

    # 5. Run inference without tracking gradients (saves RAM and speeds up CPU)
    print("\nRunning semantic segmentation inference on CPU...")
    try:
        with torch.no_grad():
            outputs = model(**inputs)
    except RuntimeError as err:
        print(f"\nInference / Memory Error: {err}")
        print("Close unused apps to free memory and re-run.")
        return

    logits = outputs.logits
    print(f"Raw Logits Shape          : {tuple(logits.shape)}  (batch, num_classes, h, w)")

    # Resize logits back to original image height x width and pick top class per pixel
    seg_map = processor.post_process_semantic_segmentation(
        outputs, target_sizes=[(image.size[1], image.size[0])]
    )[0]
    print(f"Segmentation Mask Shape   : {tuple(seg_map.shape)}  (height, width)")

    # 6. Inspect available model classes and classes detected in this photo
    id2label = model.config.id2label
    print(f"Total Available Classes   : {len(id2label)} (ADE20K general scene labels)")

    sample_labels = [f"{idx}: {id2label[idx]}" for idx in sorted(id2label.keys())[:10]]
    print(f"First 10 Model Labels     : {sample_labels}")

    unique_ids = torch.unique(seg_map).tolist()
    print(f"\nClasses Predicted in This Photo ({len(unique_ids)} unique labels):")
    for class_id in unique_ids:
        label_name = id2label.get(class_id, f"class_{class_id}")
        pixel_count = int((seg_map == class_id).sum().item())
        pct = (pixel_count / seg_map.numel()) * 100
        print(f"  - ID {class_id:>3d} ({label_name:<20s}): {pct:5.2f}% of pixels")

    print("\n" + "=" * 65)
    print("   SegFormer inference test complete! (General pretrained labels only)")
    print("=" * 65)


if __name__ == "__main__":
    main()
