import cv2
import numpy as np


def remove_text(image_path: str, text_regions: list[dict]) -> np.ndarray:
    image = cv2.imread(image_path)

    if image is None:
        raise ValueError(f"Could not read image: {image_path}")

    mask = np.zeros(image.shape[:2], dtype=np.uint8)

    for region in text_regions:
        x1, y1, x2, y2 = map(int, region["bbox"])

        # Expand the region slightly to cover text edges.
        padding = 3
        x1 = max(0, x1 - padding)
        y1 = max(0, y1 - padding)
        x2 = min(image.shape[1], x2 + padding)
        y2 = min(image.shape[0], y2 + padding)

        cv2.rectangle(mask, (x1, y1), (x2, y2), 255, -1)

    return cv2.inpaint(image, mask, 5, cv2.INPAINT_TELEA)