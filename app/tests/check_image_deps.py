import sys

# Check PaddleOCR
try:
    from paddleocr import PaddleOCR
    print("paddleocr: OK")
except Exception as e:
    print(f"paddleocr: MISSING - {e}")

# Check cv2
try:
    import cv2
    print("cv2: OK")
except Exception as e:
    print(f"cv2: MISSING - {e}")

# Check PIL raqm
try:
    from PIL import features
    raqm = features.check_feature("raqm")
    print("Pillow raqm: OK" if raqm else "Pillow raqm: MISSING - libraqm not installed")
except Exception as e:
    print(f"Pillow: ERROR - {e}")

# Check font
from pathlib import Path
font = Path("C:/Windows/Fonts/Nirmala.ttc")
print(f"Nirmala font: {'OK' if font.exists() else 'MISSING'}")

# Try importing the full image service chain
try:
    from app.services.image_localization_service import localize_image
    print("image_localization_service: OK")
except Exception as e:
    print(f"image_localization_service: ERROR - {e}")
