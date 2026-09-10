"""Posun demo dat relativne k dnesnimu dni.

Seed data v `initial_state.json` jsou psana k pevnemu referencnimu dni
(`demoAnchorDate`). Pri kazdem nacteni se vsechna data posunou tak, aby
referencni den odpovidal dnesku - demo tim nikdy neukazuje "planovane"
udalosti v minulosti, at se prezentuje kdykoliv.

Zaroven sjednocuje format casu na `D. M. RRRR HH:MM` (bez sekund) a
generuje casy aktualni nabidky organu vzhledem k aktualnimu okamziku.
"""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta

# Klice, jejichz hodnoty se NEPOSOUVAJI (skutecna historicka fakta).
FROZEN_KEYS = {
    "birthDate",
    "birthNumber",
    "diagnosisDate",
    "insurance",
    "phone",
    "email",
}

# "1. 6." nebo "26. 6. 2026", pripadne s casem "19:18" / "19:18:38".
DATE_RE = re.compile(
    r"(?<![\d/])"
    r"(\d{1,2})\.\s*(\d{1,2})\."          # den. mesic.
    r"(?:\s*(\d{4}))?"                     # volitelny rok
    r"(?:(\s+)(\d{1,2}):(\d{2})(?::\d{2})?)?"  # volitelny cas (sekundy zahodime)
)


def _format_date(value: date, with_year: bool) -> str:
    if with_year:
        return "%d. %d. %d" % (value.day, value.month, value.year)
    return "%d. %d." % (value.day, value.month)


def shift_text(text: str, delta_days: int, anchor_year: int) -> str:
    """Posune vsechna data v retezci a sjednoti format casu."""

    def replace(match: re.Match) -> str:
        day, month, year = match.group(1), match.group(2), match.group(3)
        gap, hour, minute = match.group(4), match.group(5), match.group(6)
        with_year = year is not None
        try:
            original = date(int(year) if with_year else anchor_year, int(month), int(day))
        except ValueError:
            return match.group(0)

        shifted = original + timedelta(days=delta_days)
        out = _format_date(shifted, with_year)
        if hour is not None:
            out += "%s%02d:%s" % (gap or " ", int(hour), minute)
        return out

    return DATE_RE.sub(replace, text)


def shift_structure(node, delta_days: int, anchor_year: int, key: str | None = None):
    if isinstance(node, dict):
        return {
            k: shift_structure(v, delta_days, anchor_year, k)
            for k, v in node.items()
        }
    if isinstance(node, list):
        return [shift_structure(item, delta_days, anchor_year, key) for item in node]
    if isinstance(node, str):
        if key in FROZEN_KEYS:
            return node
        return shift_text(node, delta_days, anchor_year)
    return node


def parse_anchor(value: str) -> date | None:
    match = re.match(r"\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})", value or "")
    if not match:
        return None
    try:
        return date(int(match.group(3)), int(match.group(2)), int(match.group(1)))
    except ValueError:
        return None


def _stamp(moment: datetime) -> str:
    return "%d. %d. %d %02d:%02d" % (
        moment.day, moment.month, moment.year, moment.hour, moment.minute
    )


def refresh_organ_offers(state: dict, now: datetime | None = None) -> None:
    """Aktivni nabidka organu ma vzdy zit "ted" - jinak vyprsi pred prezentaci."""
    now = now or datetime.now()
    for offer in state.get("organOffers") or []:
        if offer.get("status") != "new" or offer.get("archiveStatus") != "active":
            continue

        received = now - timedelta(minutes=22)
        expires_in = int(offer.get("expiresInMin") or 180)
        offer["receivedAt"] = _stamp(received)
        offer["logistics"] = offer.get("logistics") or {}
        offer["logistics"]["validUntil"] = _stamp(received + timedelta(minutes=expires_in))
        if offer.get("donor"):
            offer["donor"]["collectionPlan"] = _stamp(received + timedelta(hours=7))

        # Zpravy ve vlakne navazuji na prijeti nabidky. Prerazitkuji se jen
        # zpravy ze seed dat - co pribylo behem dema, zustava se svym casem.
        thread = offer.get("thread") or []
        seed_index = 0
        for message in thread:
            if not message.get("seed"):
                continue
            message["createdAt"] = _stamp(received + timedelta(minutes=3 + seed_index * 3))
            seed_index += 1


def apply_demo_dates(state: dict, today: date | None = None) -> dict:
    """Vrati kopii stavu posunutou k dnesnimu dni."""
    anchor = parse_anchor(state.get("demoAnchorDate") or "")
    if anchor is None:
        return state

    today = today or date.today()
    delta_days = (today - anchor).days
    shifted = shift_structure(state, delta_days, anchor.year)
    shifted["demoAnchorDate"] = _format_date(today, True)
    shifted["demoDateOffsetDays"] = delta_days
    refresh_organ_offers(shifted)
    return shifted
