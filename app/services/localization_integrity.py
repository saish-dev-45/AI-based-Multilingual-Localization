"""Deterministic protection and validation for localization syntax."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
import re


# URLs and markup are matched before placeholders so braces or percent signs in
# their contents are not mistaken for formatting syntax.
_PROTECTED_RE = re.compile(
    r"ZXQLOCK\d+QXZ"
    r"|https?://[^\s<>\"']+"
    r"|(?:</?[A-Za-z][^<>]*?>)"
    r"|%(?:\d+\$)?[-+#0 ]*(?:\d+|\*)?(?:\.(?:\d+|\*))?[diouxXeEfFgGcsaApn%]"
    r"|\$\{[A-Za-z_][\w.-]*\}"
    r"|\{\{\s*[A-Za-z_][\w.-]*\s*\}\}"
    r"|\{[A-Za-z_][\w.-]*\}"
)
_SENTINEL_RE = re.compile(r"ZXQLOCK(\d+)QXZ")
_ICU_NAME_RE = re.compile(r"^[\w.-]+$")
_SELECTOR_RE = re.compile(r"^(?:[\w-]+|=-?\d+(?:\.\d+)?)$")


@dataclass(frozen=True)
class ProtectedText:
    text: str
    tokens: tuple[str, ...]

    def restore(self, generated: str, *, strict: bool = True) -> str:
        found = Counter(_SENTINEL_RE.findall(generated))
        expected = Counter(str(i) for i in range(len(self.tokens)))
        if strict and found != expected:
            raise ValueError(
                "Generated text changed or omitted protected placeholders, "
                "markup, or URLs."
            )
        return _SENTINEL_RE.sub(
            lambda match: (
                self.tokens[int(match.group(1))]
                if int(match.group(1)) < len(self.tokens)
                else match.group(0)
            ), generated
        )


def protect_formatting(text: str) -> ProtectedText:
    """Replace non-translatable formatting tokens with stable sentinels."""
    tokens: list[str] = []

    def replace(match: re.Match[str]) -> str:
        index = len(tokens)
        tokens.append(match.group(0))
        return f"ZXQLOCK{index}QXZ"

    return ProtectedText(_PROTECTED_RE.sub(replace, text), tuple(tokens))


def protected_tokens(text: str) -> Counter[str]:
    return Counter(match.group(0) for match in _PROTECTED_RE.finditer(text))


class _ICUParser:
    """Small structural parser for ICU arguments used in localized messages."""

    def __init__(self, text: str):
        self.text = text
        self.signatures: list[tuple[str, str, tuple[str, ...]]] = []
        self.errors: list[str] = []

    def parse(self) -> tuple[list[tuple[str, str, tuple[str, ...]]], list[str]]:
        self._parse_range(0, len(self.text))
        return self.signatures, self.errors

    def _parse_range(self, start: int, end: int) -> None:
        i = start
        while i < end:
            if self.text.startswith("{{", i):
                double_brace = re.match(r"\{\{\s*[A-Za-z_][\w.-]*\s*\}\}", self.text[i:end])
                if double_brace:
                    i += len(double_brace.group(0))
                    continue
            if self.text.startswith("${", i):
                dollar_placeholder = re.match(r"\$\{[A-Za-z_][\w.-]*\}", self.text[i:end])
                if dollar_placeholder:
                    i += len(dollar_placeholder.group(0))
                    continue
            if self.text[i] == "}":
                self.errors.append("Unmatched closing brace in ICU message.")
                i += 1
                continue
            if self.text[i] != "{":
                i += 1
                continue
            parsed_end = self._parse_argument(i, end)
            if parsed_end is None:
                # Literal braces are allowed when they do not look like an ICU
                # argument. A brace followed by a plausible name is malformed.
                if re.match(r"\{\s*[\w.-]+\s*,", self.text[i:end]):
                    self.errors.append("Malformed ICU argument.")
                i += 1
            else:
                i = parsed_end

    def _parse_argument(self, start: int, limit: int) -> int | None:
        close = self.text.find("}", start + 1, limit)
        comma = self.text.find(",", start + 1, limit)
        if comma < 0 or (close >= 0 and close < comma):
            if close < 0:
                return None
            name = self.text[start + 1:close].strip()
            if not _ICU_NAME_RE.fullmatch(name):
                return None
            self.signatures.append((name, "argument", ()))
            return close + 1

        name = self.text[start + 1:comma].strip()
        if not _ICU_NAME_RE.fullmatch(name):
            return None
        type_end = self.text.find(",", comma + 1, limit)
        if type_end < 0:
            if close >= 0:
                self.errors.append(f"ICU argument '{name}' is missing its type/options.")
                return close + 1
            return None
        kind = self.text[comma + 1:type_end].strip()
        if kind not in {"plural", "selectordinal", "select"}:
            # number/date/time and custom simple formats are atomic arguments.
            atomic_close = self.text.find("}", type_end + 1, limit)
            if atomic_close < 0:
                return None
            self.signatures.append((name, kind, ()))
            return atomic_close + 1

        selectors: list[str] = []
        cursor = type_end + 1
        while cursor < limit:
            while cursor < limit and self.text[cursor].isspace():
                cursor += 1
            offset = re.match(r"offset\s*:\s*\d+", self.text[cursor:limit])
            if offset:
                cursor += len(offset.group(0))
                continue
            if cursor < limit and self.text[cursor] == "}":
                self.signatures.append((name, kind, tuple(sorted(selectors))))
                return cursor + 1
            match = re.match(r"(?:[\w-]+|=-?\d+(?:\.\d+)?)", self.text[cursor:limit])
            if not match:
                self.errors.append(f"Malformed selector in ICU {kind} '{name}'.")
                return None
            selector = match.group(0)
            cursor += len(selector)
            while cursor < limit and self.text[cursor].isspace():
                cursor += 1
            if cursor >= limit or self.text[cursor] != "{":
                self.errors.append(f"Selector '{selector}' in '{name}' has no body.")
                return None
            body_start = cursor + 1
            depth = 1
            cursor += 1
            while cursor < limit and depth:
                if self.text[cursor] == "{":
                    depth += 1
                elif self.text[cursor] == "}":
                    depth -= 1
                cursor += 1
            if depth:
                self.errors.append(f"Unclosed selector body '{selector}' in '{name}'.")
                return None
            body_end = cursor - 1
            selectors.append(selector)
            self._parse_range(body_start, body_end)
        self.errors.append(f"Unclosed ICU {kind} argument '{name}'.")
        return None


def _plural_categories(locale: str) -> set[str]:
    """Return CLDR plural categories, using Babel's CLDR data when installed."""
    try:
        from babel.core import Locale

        parsed = Locale.parse(locale, sep="-")
        return set(parsed.plural_form.tags) | {"other"}
    except ImportError:
        # The app currently supports these two locales. Babel is also declared
        # as a dependency so all other locales use the complete CLDR data.
        language = locale.split("-", 1)[0].lower()
        if language in {"hi", "mr"}:
            return {"one", "other"}
        if language == "en":
            return {"one", "other"}
        return {"other"}
    except Exception:
        return {"other"}


def validate_localization(source: str, localized: str, locale: str) -> dict:
    """Check formatting token identity and ICU message compatibility."""
    issues: list[str] = []
    source_tokens = protected_tokens(source)
    localized_tokens = protected_tokens(localized)
    if "ZXQLOCK" in localized or "QXZ" in localized:
        issues.append("Internal placeholder markers were not restored.")
    if source_tokens != localized_tokens:
        missing = list((source_tokens - localized_tokens).elements())
        added = list((localized_tokens - source_tokens).elements())
        if missing:
            issues.append(f"Protected tokens were changed or removed: {missing}")
        if added:
            issues.append(f"Unexpected protected tokens were added: {added}")

    source_sigs, source_errors = _ICUParser(source).parse()
    output_sigs, output_errors = _ICUParser(localized).parse()
    if source_errors:
        issues.extend(f"Source ICU syntax: {item}" for item in source_errors)
    if output_errors:
        issues.extend(f"Localized ICU syntax: {item}" for item in output_errors)
    def normalized_signature(signature: tuple[str, str, tuple[str, ...]]) -> tuple:
        name, kind, selectors = signature
        # Plural category keys are locale dependent. Exact-number selectors
        # remain part of the source contract; select keys must remain exact.
        kept = (
            tuple(item for item in selectors if item.startswith("="))
            if kind in {"plural", "selectordinal"}
            else selectors
        )
        return name, kind, kept

    if set(map(normalized_signature, source_sigs)) != set(
        map(normalized_signature, output_sigs)
    ):
        issues.append(
            "ICU argument names, types, selector keys, or nested message structure changed."
        )

    for name, kind, selectors in output_sigs:
        if kind == "select" and "other" not in set(selectors):
            issues.append(f"ICU select '{name}' must include an 'other' branch.")
        if kind in {"plural", "selectordinal"}:
            selector_set = set(selectors)
            if "other" not in selector_set:
                issues.append(f"ICU {kind} '{name}' must include an 'other' branch.")
            required = _plural_categories(locale)
            missing_categories = required - selector_set
            if missing_categories:
                issues.append(
                    f"ICU {kind} '{name}' is missing CLDR plural categories "
                    f"for {locale}: {sorted(missing_categories)}."
                )
    return {
        "formatting_preserved": source_tokens == localized_tokens,
        "icu_valid": not (source_errors or output_errors)
        and set(map(normalized_signature, source_sigs))
        == set(map(normalized_signature, output_sigs))
        and all(
            kind not in {"plural", "selectordinal"}
            or ("other" in selectors and _plural_categories(locale).issubset(set(selectors)))
            if kind in {"plural", "selectordinal"}
            else (kind != "select" or "other" in selectors)
            for _, kind, selectors in output_sigs
        ),
        "issues": issues,
    }
