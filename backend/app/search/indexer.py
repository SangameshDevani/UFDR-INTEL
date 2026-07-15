from app.ingestion.ufdr_parser import ParsedArtifact


def build_chunks(parsed: ParsedArtifact, chunk_size: int = 20) -> list[str]:
    header = []
    if parsed.app_name:
        header.append(f"App: {parsed.app_name}")
    if parsed.title:
        header.append(f"Title: {parsed.title}")
    if parsed.participants:
        header.append(f"Participants: {', '.join(parsed.participants)}")
    if parsed.timestamp:
        header.append(f"Time: {parsed.timestamp.isoformat()}")

    prefix = " | ".join(header)
    body = parsed.content or ""

    if parsed.artifact_type.value in {"chat", "sms"} and "\n" in body:
        lines = [ln for ln in body.splitlines() if ln.strip()]
        if len(lines) <= chunk_size:
            return [f"{prefix}\n{body}".strip()] if body else []

        chunks: list[str] = []
        for i in range(0, len(lines), chunk_size):
            block = "\n".join(lines[i : i + chunk_size])
            chunks.append(f"{prefix}\n{block}".strip())
        return chunks

    text = f"{prefix}\n{body}".strip() if prefix else body
    return [text] if text else []
