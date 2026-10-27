import sys, os, traceback
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8")

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Set the flag BEFORE anything paddle-related loads
os.environ["FLAGS_use_mkldnn"] = "0"

from PIL import Image, ImageDraw
import tempfile

img = Image.new("RGB", (400, 120), color="white")
d = ImageDraw.Draw(img)
d.text((20, 40), "Hello World Test", fill="black")
tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
img.save(tmp.name)
tmp.close()

print("Testing OCR with oneDNN disabled...")
try:
    from app.services.ocr_services import ocr_service
    regions = ocr_service.extract_from_image(tmp.name)
    print(f"OCR result: {len(regions)} regions detected")
    for r in regions:
        print(f"  text={repr(r['text'])}  bbox={r['bbox']}")
    print("OCR: OK")
except Exception:
    traceback.print_exc()
finally:
    os.unlink(tmp.name)
