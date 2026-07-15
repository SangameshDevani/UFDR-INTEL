import re
from dataclasses import dataclass


@dataclass
class QueryPlan:
    intent: str
    search_terms: list[str]
    artifact_type: str | None = None
    entity_type: str | None = None
    foreign_numbers_only: bool = False
    app_name: str | None = None
    summary_hint: str = ""


CRYPTO_PATTERNS = re.compile(r"crypto|bitcoin|btc|ethereum|wallet|usdt", re.I)
FOREIGN_PATTERNS = re.compile(r"foreign|international|outside\s+\+?\d+|non.?indian", re.I)
CALL_PATTERNS = re.compile(r"call|phone call|dialed|incoming|outgoing", re.I)
CHAT_PATTERNS = re.compile(r"chat|message|whatsapp|telegram|signal|sms|text", re.I)
CONTACT_PATTERNS = re.compile(r"contact|address book", re.I)
LOCATION_PATTERNS = re.compile(r"location|gps|coordinate|visited", re.I)


def plan_query(nl_query: str) -> QueryPlan:
    q = nl_query.strip()
    lower = q.lower()

    plan = QueryPlan(intent="general_search", search_terms=[])

    if CRYPTO_PATTERNS.search(q):
        plan.intent = "crypto_search"
        plan.entity_type = "crypto_address"
        plan.search_terms = ["crypto", "bitcoin", "wallet", "btc", "eth", "0x"]
        plan.summary_hint = "communications containing cryptocurrency references or wallet addresses"

    elif FOREIGN_PATTERNS.search(q) or "foreign number" in lower:
        plan.intent = "foreign_numbers"
        plan.foreign_numbers_only = True
        plan.search_terms = []
        plan.summary_hint = "records involving foreign (non-+91) phone numbers"

    elif CALL_PATTERNS.search(q):
        plan.intent = "call_search"
        plan.artifact_type = "call"
        plan.search_terms = _extract_keywords(q, stopwords={"call", "calls", "phone", "list", "all", "show", "me"})
        plan.summary_hint = "call records matching your query"

    elif CONTACT_PATTERNS.search(q):
        plan.intent = "contact_search"
        plan.artifact_type = "contact"
        plan.search_terms = _extract_keywords(q, stopwords={"contact", "contacts", "list", "all", "show"})
        plan.summary_hint = "contact records matching your query"

    elif LOCATION_PATTERNS.search(q):
        plan.intent = "location_search"
        plan.artifact_type = "location"
        plan.search_terms = _extract_keywords(q, stopwords={"location", "gps", "list", "show"})
        plan.summary_hint = "location and visited page records"

    elif CHAT_PATTERNS.search(q):
        plan.intent = "chat_search"
        plan.artifact_type = "chat"
        plan.search_terms = _extract_keywords(
            q,
            stopwords={"chat", "chats", "message", "messages", "show", "list", "all", "records", "containing"},
        )
        plan.summary_hint = "chat and message records matching your query"

    else:
        plan.search_terms = _extract_keywords(q, stopwords={"show", "me", "list", "all", "find", "get"})
        plan.summary_hint = "artifacts matching your query"

    for app in ("whatsapp", "telegram", "signal", "instagram", "facebook", "sms"):
        if app in lower:
            plan.app_name = app
            break

    quoted = re.findall(r'"([^"]+)"|\'([^\']+)\'', q)
    for a, b in quoted:
        term = a or b
        if term and term not in plan.search_terms:
            plan.search_terms.insert(0, term)

    return plan


def _extract_keywords(text: str, stopwords: set[str]) -> list[str]:
    words = re.findall(r"[a-zA-Z0-9@.+_-]+", text.lower())
    return [w for w in words if w not in stopwords and len(w) > 2][:5]
