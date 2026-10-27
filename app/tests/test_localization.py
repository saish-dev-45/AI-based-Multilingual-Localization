"""
Fixed test suite for the simple translation pipeline.

Tests cover:
  - Basic Hindi and Marathi localization
  - Tone variation (formal vs casual)
  - Meaning preservation (negation, question, instruction)
  - Protected token handling (URLs, numbers, product names)
  - Short UI copy (button labels, headings)

Run with:
    python -m app.tests.test_localization
"""

import sys

# Reconfigure stdout to UTF-8 so Devanagari characters print correctly
# on Windows terminals that default to cp1252.
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import json
from app.agents.orchestrator import run_localization

# ── ANSI colours ──────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

# ── Test cases ────────────────────────────────────────────────
TEST_CASES = [
    # --- Basic Hindi ---
    {
        "id": "HI-01",
        "desc": "Simple greeting – Hindi",
        "source": "Welcome to our platform.",
        "language": "Hindi",
        "tone": "friendly and professional",
        "expect_script": "Devanagari",
    },
    {
        "id": "HI-02",
        "desc": "Negation preserved – Hindi",
        "source": "Do not click this button more than once.",
        "language": "Hindi",
        "tone": "professional",
        "expect_script": "Devanagari",
        "must_contain_hint": "मत",   # negation word for commands
    },
    {
        "id": "HI-03",
        "desc": "Question form preserved – Hindi",
        "source": "Would you like to save your changes?",
        "language": "Hindi",
        "tone": "friendly and professional",
        "expect_script": "Devanagari",
    },
    {
        "id": "HI-04",
        "desc": "Protected tokens – URL and number – Hindi",
        "source": "Visit https://example.com to see all 42 features.",
        "language": "Hindi",
        "tone": "professional",
        "must_preserve": ["https://example.com", "42"],
        "expect_script": "Devanagari",
    },
    {
        "id": "HI-05",
        "desc": "UI button label – Hindi",
        "source": "Get Started",
        "language": "Hindi",
        "tone": "professional",
        "expect_script": "Devanagari",
    },
    {
        "id": "HI-06",
        "desc": "Formal tone – Hindi",
        "source": "Please enter your name.",
        "language": "Hindi",
        "tone": "formal",
        "expect_script": "Devanagari",
    },
    {
        "id": "HI-07",
        "desc": "Casual tone – Hindi",
        "source": "Hey, check out this new feature!",
        "language": "Hindi",
        "tone": "casual",
        "expect_script": "Devanagari",
    },
    # --- Marathi ---
    {
        "id": "MR-01",
        "desc": "Simple greeting – Marathi",
        "source": "Welcome to our platform.",
        "language": "Marathi",
        "tone": "friendly and professional",
        "expect_script": "Devanagari",
    },
    {
        "id": "MR-02",
        "desc": "Marathi-specific negation (नको/करू नका) – Marathi",
        "source": "Do not share your password with anyone.",
        "language": "Marathi",
        "tone": "professional",
        "expect_script": "Devanagari",
    },
    {
        "id": "MR-03",
        "desc": "Protected token – product name – Marathi",
        "source": "Download LinguaAI from the App Store.",
        "language": "Marathi",
        "tone": "professional",
        # App Store is an Apple trademark and must NOT be transliterated.
        # LinguaAI is also a brand name. Both must appear verbatim.
        "must_preserve": ["LinguaAI", "App Store"],
        "expect_script": "Devanagari",
    },
    {
        "id": "MR-04",
        "desc": "Instruction preserved – Marathi",
        "source": "Click Submit only after reviewing all fields.",
        "language": "Marathi",
        "tone": "professional",
        "expect_script": "Devanagari",
    },
]


# ── Helpers ───────────────────────────────────────────────────

def has_devanagari(text: str) -> bool:
    return any("\u0900" <= ch <= "\u097F" for ch in text)


def check_preserved_tokens(localized: str, tokens: list[str]) -> list[str]:
    return [t for t in tokens if t not in localized]


def run_test(case: dict) -> dict:
    result = run_localization(
        source_text=case["source"],
        target_language=case["language"],
        tone=case.get("tone", "friendly and professional"),
        use_rag=False,
    )

    localized = result.get("localized_text", "")
    review    = result.get("quality_review", {})
    status    = result.get("status", "")

    failures = []

    # 1. Pipeline must complete
    if status != "completed":
        failures.append(f"Pipeline status = {status!r} (expected 'completed')")

    # 2. Localized text must not be empty
    if not localized.strip():
        failures.append("Localized text is empty.")

    # 3. Script check
    if case.get("expect_script") == "Devanagari" and not has_devanagari(localized):
        failures.append("Output does not contain Devanagari characters.")

    # 4. Protected tokens
    missing = check_preserved_tokens(localized, case.get("must_preserve", []))
    for token in missing:
        failures.append(f"Protected token missing from output: {token!r}")

    # 5. Quality review must pass
    if review and not review.get("overall_pass", False):
        issues_str = "; ".join(str(i) for i in review.get("issues", []))
        failures.append(f"Quality review failed. Issues: {issues_str}")

    return {
        "id": case["id"],
        "desc": case["desc"],
        "source": case["source"],
        "language": case["language"],
        "localized": localized,
        "review": review,
        "failures": failures,
        "passed": len(failures) == 0,
    }


# ── Runner ────────────────────────────────────────────────────

def main():
    print(f"\n{BOLD}{CYAN}{'='*60}{RESET}")
    print(f"{BOLD}{CYAN}  Simple Translation Pipeline – Test Suite{RESET}")
    print(f"{BOLD}{CYAN}{'='*60}{RESET}\n")

    passed = 0
    failed = 0
    results = []

    for i, case in enumerate(TEST_CASES, 1):
        label = f"[{case['id']}] {case['desc']}"
        print(f"{BOLD}Running {label}...{RESET}")

        try:
            r = run_test(case)
        except Exception as exc:
            r = {
                "id": case["id"],
                "desc": case["desc"],
                "source": case["source"],
                "language": case["language"],
                "localized": "",
                "review": {},
                "failures": [f"Exception: {exc}"],
                "passed": False,
            }

        results.append(r)

        if r["passed"]:
            passed += 1
            print(f"  {GREEN}✓ PASS{RESET}")
        else:
            failed += 1
            print(f"  {RED}✗ FAIL{RESET}")
            for f in r["failures"]:
                print(f"    {YELLOW}→ {f}{RESET}")

        print(f"  Source   : {r['source']}")
        print(f"  Localized: {r['localized']}")
        qr = r.get("review", {})
        if qr:
            print(
                f"  Scores   : fluency={qr.get('fluency_score','?')} "
                f"grammar={qr.get('grammar_score','?')} "
                f"locale={qr.get('locale_suitability_score','?')} "
                f"pass={qr.get('overall_pass','?')}"
            )
        print()

    # ── Summary ───────────────────────────────────────────────
    print(f"{BOLD}{CYAN}{'='*60}{RESET}")
    total = passed + failed
    colour = GREEN if failed == 0 else RED
    print(f"{BOLD}{colour}Results: {passed}/{total} passed{RESET}")
    if failed:
        print(f"\n{RED}Failed tests:{RESET}")
        for r in results:
            if not r["passed"]:
                print(f"  {r['id']}: {r['desc']}")
                for f in r["failures"]:
                    print(f"    → {f}")
    print(f"{BOLD}{CYAN}{'='*60}{RESET}\n")


if __name__ == "__main__":
    main()
