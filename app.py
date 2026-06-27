"""LTxLink - Flask aplikace s daty pouze v paměti (bez perzistence)."""
from __future__ import annotations

import copy
import json
import os
from pathlib import Path

from flask import Flask, jsonify, render_template, request

ROOT = Path(__file__).resolve().parent
INITIAL_STATE_PATH = ROOT / "initial_state.json"


def load_initial_state() -> dict:
    with INITIAL_STATE_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


app = Flask(__name__)
_memory_store = copy.deepcopy(load_initial_state())


@app.route("/")
def index():
    return render_template("index.html")


def app_config() -> dict:
    return {
        "googleMapsApiKey": os.environ.get("GOOGLE_MAPS_API_KEY", "").strip() or "AIzaSyCRAXQMlC7qFTOsTlIjcnPFGTXFw3I5ef0",
        "googleMapsMapId": os.environ.get("GOOGLE_MAPS_MAP_ID", "").strip() or "DEMO_MAP_ID"
    }


@app.route("/api/bootstrap")
def bootstrap():
    return jsonify({**_memory_store, "config": app_config()})


def _merge_chat_read_maps(existing: dict | None, incoming: dict | None) -> dict:
    merged: dict[str, dict] = copy.deepcopy(existing or {})
    for role_id, patients_map in (incoming or {}).items():
        if not isinstance(patients_map, dict):
            continue
        role_store = merged.setdefault(role_id, {})
        role_store.update(patients_map)
    return merged


@app.route("/api/state", methods=["POST"])
def sync_state():
    payload = request.get_json(silent=True) or {}
    if "demoState" in payload:
        incoming_state = payload["demoState"]
        current_state = _memory_store.get("demoState") or {}
        for read_key in ("internalChatRead", "referralChatRead", "referralNotificationRead"):
            if read_key in incoming_state or read_key in current_state:
                incoming_state[read_key] = _merge_chat_read_maps(
                    current_state.get(read_key),
                    incoming_state.get(read_key),
                )
        _memory_store["demoState"] = incoming_state
    if "patients" in payload:
        _memory_store["patients"] = payload["patients"]
    if "organOffers" in payload:
        _memory_store["organOffers"] = payload["organOffers"]
    if "referringNetwork" in payload:
        _memory_store["referringNetwork"] = payload["referringNetwork"]
    for admin_key in (
        "systemUsers",
        "codeLists",
        "sharedMaterials",
        "handbooks",
        "handbookCatalogByRole",
        "adminAudit",
    ):
        if admin_key in payload:
            _memory_store[admin_key] = payload[admin_key]
    return jsonify({"ok": True})


@app.route("/api/reset", methods=["POST"])
def reset_state():
    """Znovu načte initial_state.json do paměti (demo reset)."""
    global _memory_store
    _memory_store = copy.deepcopy(load_initial_state())
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
