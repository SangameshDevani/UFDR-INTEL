import re
from dataclasses import dataclass


@dataclass
class EntityMatch:
    entity_type: str
    value: str
    context: str | None = None


PHONE_RE = re.compile(
    r"(?<!\d)(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}(?!\d)"
)
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
URL_RE = re.compile(r"https?://[^\s<>\"']+|www\.[^\s<>\"']+")
CRYPTO_BTC_RE = re.compile(r"\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b")
CRYPTO_ETH_RE = re.compile(r"\b0x[a-fA-F0-9]{40}\b")
CRYPTO_GENERIC_RE = re.compile(r"\b(?:bitcoin|btc|ethereum|eth|crypto|wallet|usdt|bnb)\b", re.I)
FOREIGN_NUMBER_HINT = re.compile(r"^\+\d{1,3}")


def extract_entities(text: str) -> list[EntityMatch]:
    if not text:
        return []

    seen: set[tuple[str, str]] = set()
    matches: list[EntityMatch] = []

    def add(entity_type: str, value: str, context: str | None = None) -> None:
        key = (entity_type, value.lower())
        if key in seen or len(value) < 3:
            return
        seen.add(key)
        matches.append(EntityMatch(entity_type=entity_type, value=value, context=context))

    for m in EMAIL_RE.finditer(text):
        add("email", m.group())

    for m in URL_RE.finditer(text):
        add("url", m.group())

    for m in CRYPTO_BTC_RE.finditer(text):
        add("crypto_btc", m.group())
        add("crypto_address", m.group())

    for m in CRYPTO_ETH_RE.finditer(text):
        add("crypto_eth", m.group())
        add("crypto_address", m.group())

    for m in PHONE_RE.finditer(text):
        phone = re.sub(r"[\s.\-()]", "", m.group())
        if len(re.sub(r"\D", "", phone)) >= 8:
            entity_type = "phone_foreign" if FOREIGN_NUMBER_HINT.match(phone) and not phone.startswith("+91") else "phone"
            add(entity_type, m.group().strip())

    return matches
