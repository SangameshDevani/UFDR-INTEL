import hashlib
import re
import zipfile
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

from app.models import ArtifactType


@dataclass
class ParsedArtifact:
    artifact_type: ArtifactType
    title: str | None
    content: str
    app_name: str | None = None
    participants: list[str] = field(default_factory=list)
    timestamp: datetime | None = None
    source_path: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ParseResult:
    device_info: dict[str, Any]
    artifacts: list[ParsedArtifact]
    stats: dict[str, int]


def _local(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag


def _text(elem: ET.Element | None) -> str:
    if elem is None:
        return ""
    return (elem.text or "").strip()


def _find_child(parent: ET.Element, name: str) -> ET.Element | None:
    for child in parent:
        if _local(child.tag) == name:
            return child
    return None


def _find_children(parent: ET.Element, name: str) -> list[ET.Element]:
    return [c for c in parent if _local(c.tag) == name]


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    for fmt in (
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ):
        try:
            return datetime.strptime(value.replace("+00:00", "Z"), fmt.replace("Z", ""))
        except ValueError:
            continue
    return None


def _collect_participants(node: ET.Element) -> list[str]:
    participants: list[str] = []
    for child in node.iter():
        tag = _local(child.tag)
        if tag in {"from", "to", "participant", "name", "identifier"}:
            val = _text(child)
            if val and val not in participants:
                participants.append(val)
    return participants


def _parse_instant_messages(decoded: ET.Element) -> list[ParsedArtifact]:
    artifacts: list[ParsedArtifact] = []
    seen: set[int] = set()

    for msg_container in decoded.iter():
        if _local(msg_container.tag) != "instantMessage":
            continue
        node_id = id(msg_container)
        if node_id in seen:
            continue
        seen.add(node_id)

        body_parts: list[str] = []
        app_name = None
        ts = None
        participants: list[str] = []

        for child in msg_container.iter():
            tag = _local(child.tag)
            if tag == "body" and _text(child):
                body_parts.append(_text(child))
            elif tag in {"timestamp", "time", "dateTime"}:
                ts = _parse_timestamp(_text(child) or child.get("value"))
            elif tag in {"source", "application", "serviceIdentifier"}:
                app_name = app_name or _text(child) or child.get("name")
            elif tag in {"from", "to", "participant"}:
                val = _text(child)
                if val:
                    participants.append(val)

        if not body_parts:
            for field_node in _find_children(msg_container, "field"):
                if field_node.get("name") in {"Body", "Text", "Message"}:
                    body_parts.append(_text(field_node))

        content = "\n".join(body_parts).strip()
        if not content:
            continue

        artifacts.append(
            ParsedArtifact(
                artifact_type=ArtifactType.CHAT,
                title=app_name or "Instant Message",
                content=content,
                app_name=app_name,
                participants=participants or _collect_participants(msg_container),
                timestamp=ts,
                metadata={"raw_tag": "instantMessage"},
            )
        )

    return artifacts


def _parse_sms(decoded: ET.Element) -> list[ParsedArtifact]:
    artifacts: list[ParsedArtifact] = []
    for sms in decoded.iter():
        if _local(sms.tag) != "sms":
            continue
        body = _text(_find_child(sms, "body")) or _text(_find_child(sms, "text"))
        if not body:
            continue
        artifacts.append(
            ParsedArtifact(
                artifact_type=ArtifactType.SMS,
                title="SMS",
                content=body,
                app_name="SMS",
                participants=_collect_participants(sms),
                timestamp=_parse_timestamp(
                    _text(_find_child(sms, "timestamp")) or sms.get("timestamp")
                ),
                metadata={"direction": sms.get("direction")},
            )
        )
    return artifacts


def _parse_calls(decoded: ET.Element) -> list[ParsedArtifact]:
    artifacts: list[ParsedArtifact] = []
    for call in decoded.iter():
        if _local(call.tag) != "call":
            continue
        parties = _collect_participants(call)
        duration = _text(_find_child(call, "duration")) or call.get("duration", "")
        direction = call.get("direction") or _text(_find_child(call, "direction"))
        ts = _parse_timestamp(_text(_find_child(call, "timestamp")) or call.get("timestamp"))
        content = f"Call {direction or 'unknown'} — parties: {', '.join(parties) or 'N/A'}"
        if duration:
            content += f" — duration: {duration}s"
        artifacts.append(
            ParsedArtifact(
                artifact_type=ArtifactType.CALL,
                title=f"Call {direction or ''}".strip(),
                content=content,
                app_name="Phone",
                participants=parties,
                timestamp=ts,
                metadata={"duration": duration, "direction": direction},
            )
        )
    return artifacts


def _parse_contacts(decoded: ET.Element) -> list[ParsedArtifact]:
    artifacts: list[ParsedArtifact] = []
    for contact in decoded.iter():
        if _local(contact.tag) != "contact":
            continue
        name = _text(_find_child(contact, "name")) or "Unknown Contact"
        phones = [_text(p) for p in _find_children(contact, "phone") if _text(p)]
        emails = [_text(e) for e in _find_children(contact, "email") if _text(e)]
        content = f"Name: {name}"
        if phones:
            content += f"\nPhones: {', '.join(phones)}"
        if emails:
            content += f"\nEmails: {', '.join(emails)}"
        artifacts.append(
            ParsedArtifact(
                artifact_type=ArtifactType.CONTACT,
                title=name,
                content=content,
                app_name="Contacts",
                participants=[name, *phones],
                metadata={"phones": phones, "emails": emails},
            )
        )
    return artifacts


def _parse_locations(decoded: ET.Element) -> list[ParsedArtifact]:
    artifacts: list[ParsedArtifact] = []
    for loc in decoded.iter():
        if _local(loc.tag) not in {"location", "coordinate", "visitedPage"}:
            continue
        lat = _text(_find_child(loc, "latitude")) or loc.get("latitude")
        lon = _text(_find_child(loc, "longitude")) or loc.get("longitude")
        url = _text(_find_child(loc, "url"))
        content = f"Location: lat={lat}, lon={lon}" if lat or lon else url or _text(loc)
        if not content.strip():
            continue
        artifacts.append(
            ParsedArtifact(
                artifact_type=ArtifactType.LOCATION if _local(loc.tag) != "visitedPage" else ArtifactType.WEB,
                title="Location" if lat else "Visited Page",
                content=content,
                timestamp=_parse_timestamp(_text(_find_child(loc, "timestamp"))),
                metadata={"latitude": lat, "longitude": lon, "url": url},
            )
        )
    return artifacts


def _parse_tagged_files(root: ET.Element) -> list[ParsedArtifact]:
    artifacts: list[ParsedArtifact] = []
    for tagged in root.iter():
        if _local(tagged.tag) != "file":
            continue
        path = tagged.get("path") or _text(_find_child(tagged, "path"))
        name = tagged.get("name") or _text(_find_child(tagged, "name")) or path
        if not name:
            continue
        mime = tagged.get("type") or _text(_find_child(tagged, "type"))
        artifacts.append(
            ParsedArtifact(
                artifact_type=ArtifactType.MEDIA,
                title=name,
                content=f"File: {name}" + (f" ({mime})" if mime else ""),
                source_path=path,
                metadata={"mime": mime, "size": tagged.get("size")},
            )
        )
    return artifacts


def _parse_device_info(root: ET.Element) -> dict[str, Any]:
    info: dict[str, Any] = {}
    for key in ("deviceName", "model", "manufacturer", "osVersion", "imei", "imsi"):
        for elem in root.iter():
            if _local(elem.tag).lower() == key.lower():
                info[key] = _text(elem) or elem.get("value")
    return info


def parse_report_xml(xml_path: Path) -> ParseResult:
    tree = ET.parse(xml_path)
    root = tree.getroot()

    device_info = _parse_device_info(root)
    artifacts: list[ParsedArtifact] = []

    decoded = None
    for elem in root.iter():
        if _local(elem.tag) == "decodedData":
            decoded = elem
            break

    if decoded is not None:
        artifacts.extend(_parse_instant_messages(decoded))
        artifacts.extend(_parse_sms(decoded))
        artifacts.extend(_parse_calls(decoded))
        artifacts.extend(_parse_contacts(decoded))
        artifacts.extend(_parse_locations(decoded))

    artifacts.extend(_parse_tagged_files(root))

    stats: dict[str, int] = {}
    for art in artifacts:
        key = art.artifact_type.value
        stats[key] = stats.get(key, 0) + 1

    return ParseResult(device_info=device_info, artifacts=artifacts, stats=stats)


def extract_ufdr(ufdr_path: Path, dest_dir: Path, password: str | None = None) -> Path:
    dest_dir.mkdir(parents=True, exist_ok=True)
    pwd = password.encode() if password else None
    with zipfile.ZipFile(ufdr_path, "r") as zf:
        zf.extractall(dest_dir, pwd=pwd)

    report_xml = dest_dir / "report.xml"
    if not report_xml.exists():
        for candidate in dest_dir.rglob("report.xml"):
            report_xml = candidate
            break

    if not report_xml.exists():
        raise FileNotFoundError("report.xml not found inside UFDR archive")

    return report_xml


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def is_valid_ufdr(path: Path) -> bool:
    if not zipfile.is_zipfile(path):
        return False
    try:
        with zipfile.ZipFile(path, "r") as zf:
            return any(n.endswith("report.xml") or n == "report.xml" for n in zf.namelist())
    except zipfile.BadZipFile:
        return False
