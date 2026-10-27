from pathlib import Path
import os

from dotenv import load_dotenv

# Project root directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from the project root
load_dotenv(BASE_DIR / ".env")

# Groq API configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# NLLB translation model
TRANSLATION_MODEL_NAME = "facebook/nllb-200-distilled-600M"
SOURCE_LANGUAGE_CODE = "eng_Latn"

# Supported target languages
LANGUAGE_CONFIG = {
    "Hindi": {
        "lang_code": "hin_Deva",
        "locale": "hi-IN",
    },
    "Marathi": {
        "lang_code": "mar_Deva",
        "locale": "mr-IN",
    },
}

# Per-language localization guidance injected into the agent prompt.
# Each entry documents script, formality conventions, key pitfalls,
# and locale-specific rules that improve output quality.
LANGUAGE_GUIDANCE = {
    "Hindi": """
Script: Devanagari (हिन्दी). Use Unicode Devanagari; never romanize.

Formality and honorifics:
- Use "आप" (aap) for polite/formal address; "तुम" only for casual tone.
- Use "आप" in professional, UI, and product contexts by default.
- Use gendered verb and adjective agreement correctly (e.g., "वह गया" vs "वह गई").

Sentence structure:
- Hindi is SOV (Subject–Object–Verb). Restructure translations that follow
  English SVO order if it sounds unnatural.
- Use postpositions (के लिए, में, पर) not prepositions.

Common localization pitfalls to avoid:
- Do not translate "please" as "कृपया" in every context — in casual UI copy,
  "ज़रूर" or implied politeness through verb form is more natural.
- Do not use "नहीं" and "मत" interchangeably: "नहीं" negates facts; "मत" negates commands.
- Do not calque English idioms literally. "Keep in mind" → "ध्यान में रखें", not "दिमाग में रखो".
- Product names, brand names, URLs, and placeholders must not be translated OR
  transliterated. Keep them exactly as they appear in the source. This includes
  trademarked names such as: App Store, Play Store, Google, Apple, Microsoft,
  YouTube, WhatsApp, and any CamelCase product identifiers.
- Numbers: use standard Arabic numerals (1, 2, 3) not Devanagari numerals unless
  the source explicitly uses the regional script.

Punctuation:
- Use the Devanagari danda (।) as the sentence-ending full stop.
- Use standard commas and question marks (? not ।).

Register:
- Formal/professional: use "प्रारंभ करें" not "शुरू करो".
- Casual: contractions and colloquial verb forms are acceptable.
""",

    "Marathi": """
Script: Devanagari (मराठी). Use Unicode Devanagari; never romanize.

Formality and honorifics:
- Use "तुम्ही" for polite/formal address; "तू" only for intimate/casual.
- Marathi has a distinct honorific plural: prefer "तुम्ही करा" over "तू कर" in UI.

Sentence structure:
- Marathi is SOV. Restructure if English SVO order produces unnatural phrasing.
- Postpositions: "साठी", "मध्ये", "वर" etc.

Vocabulary distinctions vs Hindi:
- Marathi has many words that look similar to Hindi but differ in meaning or usage.
  Use Marathi-specific vocabulary, not Hindi vocabulary written in Devanagari.
  Examples: "आणि" (and) not "और"; "नाही" (no/not) not "नहीं"; "काय" (what) not "क्या".
- "Please" → "कृपया" is shared, but prefer "please" expressed via verb politeness.

Common localization pitfalls to avoid:
- Do not substitute Hindi words for Marathi equivalents — they are different languages.
- Do not use "मत" for negating commands — Marathi uses "नको" or "करू नका".
- Product names, brand names, URLs, and placeholders must not be translated OR
  transliterated into Devanagari. Keep them exactly as they appear in the source.
  This includes trademarked names such as: App Store, Play Store, Google, Apple,
  Microsoft, YouTube, WhatsApp, and any CamelCase product identifiers.
- Numbers: use standard Arabic numerals by default.

Punctuation:
- Use the Devanagari danda (।) as the sentence-ending full stop.
- Standard commas and question marks.

Register:
- Formal/professional: "सुरू करा" not "सुरू कर".
- Casual: shorter verb forms and contractions are acceptable.
""",
}

# Localization defaults
DEFAULT_TONE = "friendly and professional"
MAX_INPUT_LENGTH = 10000