"""Protect recognizable source values and render them with CLDR locale data."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
import re


_NUMBER = r"[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?"
_MONTH = (
    r"January|February|March|April|May|June|July|August|September|October|November|December|"
    r"Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec"
)
_CURRENCY_SYMBOLS = {"$": "USD", "€": "EUR", "£": "GBP", "₹": "INR"}
_CURRENCY_PATTERN = re.compile(
    rf"(?<![\w.])(?:"
    rf"(?P<before>\$|€|£|₹|USD|EUR|GBP|INR)\s*(?P<before_number>{_NUMBER})"
    rf"|(?P<after_number>{_NUMBER})\s*(?P<after>USD|EUR|GBP|INR|\$|€|£|₹)"
    rf")(?![\w.])",
    re.IGNORECASE,
)
_VALUE_RE = re.compile(
    rf"(?<![\w.])"
    rf"(?P<iso_date>\d{{4}}-\d{{2}}-\d{{2}})(?![\w.])"
    rf"|(?<![\w.])(?P<month_date>(?:{_MONTH})\s+\d{{1,2}}(?:st|nd|rd|th)?[,]?\s+\d{{4}}|"
    rf"\d{{1,2}}\s+(?:{_MONTH})[,]?\s+\d{{4}})(?![\w.])"
    rf"|(?<![\w./])(?P<currency>{_CURRENCY_PATTERN.pattern[ len(r'(?<![\w.])') : ]})"
    rf"|(?<![\w./])(?P<unit>{_NUMBER}\s*(?:kilometers?|kilometres?|km|miles?|mi|meters?|metres?|m|"
    rf"centimeters?|centimetres?|cm|millimeters?|millimetres?|mm|"
    rf"kilograms?|kg|grams?|g|pounds?|lbs?|ounces?|oz|"
    rf"liters?|litres?|l|milliliters?|millilitres?|ml|"
    rf"hours?|hrs?|minutes?|mins?|seconds?|secs?|"
    rf"megabytes?|mb|gigabytes?|gb|terabytes?|tb|"
    rf"degrees?\s+(?:celsius|fahrenheit)|°[CF]))(?![\w./])"
    rf"|(?<![\w./])(?P<percent>{_NUMBER}\s*%)(?![\w./])"
    rf"|(?<![\w.])(?P<ambiguous_date>\d{{1,4}}[/-]\d{{1,2}}[/-]\d{{2,4}})(?![\w.])"
    rf"|(?<![\w./])(?P<number>{_NUMBER})(?![\w./])",
    re.IGNORECASE,
)


class LocaleFormattingDependencyError(RuntimeError):
    """Raised when Babel, required for CLDR formatting, is unavailable."""


def _babel():
    try:
        from babel.dates import format_date
        from babel.numbers import format_currency, format_decimal, format_percent
        from babel.units import format_unit
    except ImportError as exc:
        raise LocaleFormattingDependencyError(
            "Locale-aware formatting requires Babel. Install project dependencies "
            "with 'python -m pip install -r requirements.txt' and restart the backend."
        ) from exc
    return format_date, format_currency, format_decimal, format_percent, format_unit


def _parse_decimal(value: str) -> Decimal:
    return Decimal(value.replace(",", ""))


def _format_date(raw: str, locale: str, format_date) -> str:
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
        parsed = date.fromisoformat(raw)
    else:
        cleaned = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", raw, flags=re.IGNORECASE)
        cleaned = cleaned.replace(",", "")
        parsed = None
        for pattern in ("%B %d %Y", "%b %d %Y", "%d %B %Y", "%d %b %Y"):
            try:
                parsed = datetime.strptime(cleaned, pattern).date()
                break
            except ValueError:
                continue
        if parsed is None:
            raise ValueError("Unrecognized date")
    return format_date(parsed, format="medium", locale=locale.replace("-", "_"))


def _format_numeric_date(raw: str, locale: str, format_date) -> str:
    """Format numeric dates only when their year/day ordering is unambiguous."""
    parts = re.split(r"[/-]", raw)
    if len(parts[0]) == 4:
        patterns = ("%Y-%m-%d", "%Y/%m/%d")
    elif int(parts[0]) > 12:
        patterns = ("%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y")
    elif int(parts[1]) > 12:
        patterns = ("%m/%d/%Y", "%m-%d-%Y", "%m/%d/%y", "%m-%d-%y")
    else:
        # For example 04/05/2026 has more than one valid interpretation.
        return raw
    parsed = None
    for pattern in patterns:
        try:
            parsed = datetime.strptime(raw, pattern).date()
            break
        except ValueError:
            continue
    if parsed is None:
        return raw
    return format_date(parsed, format="medium", locale=locale.replace("-", "_"))


def _format_currency(raw: str, locale: str, format_currency) -> str:
    match = _CURRENCY_PATTERN.fullmatch(raw)
    if not match:
        return raw
    currency_token = match.group("before") or match.group("after")
    amount = match.group("before_number") or match.group("after_number")
    currency = _CURRENCY_SYMBOLS.get(currency_token, currency_token.upper())
    try:
        return format_currency(
            _parse_decimal(amount), currency,
            locale=locale.replace("-", "_"), decimal_quantization=False,
        )
    except (InvalidOperation, ValueError):
        return raw


_UNIT_NAMES = {
    "kilometer": "length-kilometer", "kilometers": "length-kilometer",
    "kilometre": "length-kilometer", "kilometres": "length-kilometer", "km": "length-kilometer",
    "mile": "length-mile", "miles": "length-mile", "mi": "length-mile",
    "meter": "length-meter", "meters": "length-meter", "metre": "length-meter",
    "metres": "length-meter", "m": "length-meter",
    "centimeter": "length-centimeter", "centimeters": "length-centimeter",
    "centimetre": "length-centimeter", "centimetres": "length-centimeter", "cm": "length-centimeter",
    "millimeter": "length-millimeter", "millimeters": "length-millimeter",
    "millimetre": "length-millimeter", "millimetres": "length-millimeter", "mm": "length-millimeter",
    "kilogram": "mass-kilogram", "kilograms": "mass-kilogram", "kg": "mass-kilogram",
    "gram": "mass-gram", "grams": "mass-gram", "g": "mass-gram",
    "pound": "mass-pound", "pounds": "mass-pound", "lb": "mass-pound", "lbs": "mass-pound",
    "ounce": "mass-ounce", "ounces": "mass-ounce", "oz": "mass-ounce",
    "liter": "volume-liter", "liters": "volume-liter", "litre": "volume-liter",
    "litres": "volume-liter", "l": "volume-liter",
    "milliliter": "volume-milliliter", "milliliters": "volume-milliliter",
    "millilitre": "volume-milliliter", "millilitres": "volume-milliliter", "ml": "volume-milliliter",
    "hour": "duration-hour", "hours": "duration-hour", "hr": "duration-hour", "hrs": "duration-hour",
    "minute": "duration-minute", "minutes": "duration-minute", "min": "duration-minute", "mins": "duration-minute",
    "second": "duration-second", "seconds": "duration-second", "sec": "duration-second", "secs": "duration-second",
    "megabyte": "digital-megabyte", "megabytes": "digital-megabyte", "mb": "digital-megabyte",
    "gigabyte": "digital-gigabyte", "gigabytes": "digital-gigabyte", "gb": "digital-gigabyte",
    "terabyte": "digital-terabyte", "terabytes": "digital-terabyte", "tb": "digital-terabyte",
    "degree celsius": "temperature-celsius", "degrees celsius": "temperature-celsius",
    "°c": "temperature-celsius", "degree fahrenheit": "temperature-fahrenheit",
    "degrees fahrenheit": "temperature-fahrenheit", "°f": "temperature-fahrenheit",
}


def _format_unit(raw: str, locale: str, format_unit) -> str:
    match = re.fullmatch(rf"({_NUMBER})\s*(.+)", raw, flags=re.IGNORECASE)
    if not match:
        return raw
    unit_name = _UNIT_NAMES.get(match.group(2).strip().casefold())
    if not unit_name:
        return raw
    try:
        return format_unit(
            _parse_decimal(match.group(1)), unit_name,
            length="short", locale=locale.replace("-", "_"),
        )
    except (InvalidOperation, ValueError):
        return raw


@dataclass(frozen=True)
class LocaleFormatting:
    masked_text: str
    formatted_values: tuple[str, ...]

    def restore(self, text: str) -> str:
        for index, value in enumerate(self.formatted_values):
            text = text.replace(f"{{__locale_value_{index}__}}", value)
        return text


def prepare_locale_formatting(text: str, locale: str) -> LocaleFormatting:
    """Mask date/number/currency/unit values and prepare locale-rendered replacements."""
    format_date, format_currency, format_decimal, format_percent, format_unit = _babel()
    formatted_values: list[str] = []

    def replace(match: re.Match[str]) -> str:
        raw = match.group(0)
        kind = next(
            (
                candidate for candidate in (
                    "iso_date", "month_date", "currency", "unit",
                    "percent", "ambiguous_date", "number",
                )
                if match.group(candidate) is not None
            ),
            None,
        )
        try:
            if kind == "iso_date" or kind == "month_date":
                value = _format_date(raw, locale, format_date)
            elif kind == "ambiguous_date":
                value = _format_numeric_date(raw, locale, format_date)
            elif kind == "currency":
                value = _format_currency(raw, locale, format_currency)
            elif kind == "unit":
                value = _format_unit(raw, locale, format_unit)
            elif kind == "percent":
                amount = re.sub(r"\s*%$", "", raw)
                value = format_percent(
                    _parse_decimal(amount) / Decimal(100),
                    locale=locale.replace("-", "_"), decimal_quantization=False,
                )
            elif kind == "number":
                value = format_decimal(
                    _parse_decimal(raw), locale=locale.replace("-", "_"),
                    decimal_quantization=False,
                )
            else:
                # Slash-separated numeric dates are ambiguous without a
                # source-region setting; preserve them instead of guessing.
                return raw
        except (ValueError, InvalidOperation):
            return raw
        index = len(formatted_values)
        formatted_values.append(value)
        return f"{{__locale_value_{index}__}}"

    masked = _VALUE_RE.sub(replace, text)
    return LocaleFormatting(masked, tuple(formatted_values))
