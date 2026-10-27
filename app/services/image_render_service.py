from PIL import Image, ImageDraw, ImageFont, features
import cv2
import numpy as np

# libraqm enables correct Devanagari shaping (ligatures, right-to-left).
# When it is not installed we fall back to the basic layout engine, which
# renders individual Unicode code points without complex shaping. Devanagari
# output will still be legible for most common text even without raqm.
_HAS_RAQM = features.check_feature("raqm")
_LAYOUT_ENGINE = ImageFont.Layout.RAQM if _HAS_RAQM else ImageFont.Layout.BASIC


def extract_text_color(
    image_bgr: np.ndarray,
    bbox: list[int] | tuple[int, int, int, int],
) -> tuple[int, int, int]:
    """Detect dominant text color inside the bounding box using Otsu thresholding.
    
    Returns:
        RGB color tuple: (r, g, b)
    """
    if image_bgr is None or image_bgr.size == 0:
        return (0, 0, 0)

    x1, y1, x2, y2 = map(int, bbox)
    img_h, img_w = image_bgr.shape[:2]

    # Clamp bbox within image dimensions
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(img_w, x2), min(img_h, y2)

    if x2 <= x1 or y2 <= y1:
        return (0, 0, 0)

    crop = image_bgr[y1:y2, x1:x2]
    if crop.shape[0] < 3 or crop.shape[1] < 3:
        return (0, 0, 0)

    try:
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Border pixels are predominantly background
        border = np.concatenate([
            thresh[0, :], thresh[-1, :], thresh[:, 0], thresh[:, -1]
        ])
        bg_val = 255 if np.mean(border) > 127 else 0

        # Background color estimate
        bg_mask = (thresh == bg_val)
        bg_color_bgr = (
            np.median(crop[bg_mask], axis=0)
            if np.any(bg_mask)
            else np.array([255, 255, 255])
        )
        bg_luminance = (
            0.2126 * bg_color_bgr[2]
            + 0.7152 * bg_color_bgr[1]
            + 0.0722 * bg_color_bgr[0]
        )

        # Text stroke pixels
        text_mask = (thresh != bg_val)

        # Safeguard: if text mask is too sparse, return high-contrast color
        if np.sum(text_mask) < 3:
            return (0, 0, 0) if bg_luminance >= 128 else (255, 255, 255)

        text_pixels = crop[text_mask]
        median_bgr = np.median(text_pixels, axis=0).astype(int)
        text_color_rgb = (int(median_bgr[2]), int(median_bgr[1]), int(median_bgr[0]))
        text_luminance = (
            0.2126 * text_color_rgb[0]
            + 0.7152 * text_color_rgb[1]
            + 0.0722 * text_color_rgb[2]
        )

        # Contrast safeguard: ensure text is readable against background
        contrast_diff = abs(text_luminance - bg_luminance)
        if contrast_diff < 30:
            # Low contrast fallback
            return (0, 0, 0) if bg_luminance >= 128 else (255, 255, 255)

        return text_color_rgb
    except Exception:
        return (0, 0, 0)


def render_localized_image(
    cleaned_image: np.ndarray,
    localized_regions: list[dict],
    font_path: str,
    output_path: str,
    original_image: np.ndarray | None = None,
) -> str:
    """Render localized text onto cleaned image, preserving original text colors."""
    # OpenCV uses BGR; Pillow uses RGB.
    image = Image.fromarray(cleaned_image[:, :, ::-1])
    draw = ImageDraw.Draw(image)

    for region in localized_regions:
        x1, y1, x2, y2 = map(int, region["bbox"])
        text = region["localized_text"]

        # Use explicitly provided color or detect from original image
        text_color = region.get("color")
        if text_color is None and original_image is not None:
            text_color = extract_text_color(original_image, region["bbox"])
        if text_color is None:
            text_color = (0, 0, 0)

        box_width = max(1, x2 - x1)
        box_height = max(1, y2 - y1)

        font_size = max(10, box_height)
        font = ImageFont.truetype(font_path, font_size, layout_engine=_LAYOUT_ENGINE)

        # Reduce font size until the text fits inside the bounding box.
        while font_size > 8:
            bounds = draw.textbbox((0, 0), text, font=font)
            text_width = bounds[2] - bounds[0]
            text_height = bounds[3] - bounds[1]

            if text_width <= box_width and text_height <= box_height:
                break

            font_size -= 1
            font = ImageFont.truetype(
                font_path, font_size, layout_engine=_LAYOUT_ENGINE
            )

        draw.text((x1, y1), text, font=font, fill=text_color)

    image.save(output_path)
    return output_path
