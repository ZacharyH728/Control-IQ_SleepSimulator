"""
Parse Tandem t:slim X2 export CSVs.
Handles UTF-8 BOM and Unicode pump-name characters in headers.
"""

import csv
import io
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class CGMReading:
    timestamp: datetime
    glucose: float          # mg/dL


@dataclass
class BolusRecord:
    timestamp: datetime
    bolus_type: str         # "Food", "Correction", "Food / Correction"
    total_delivered: float  # U
    food_delivered: float   # U
    correction_delivered: float  # U
    carb_size: float        # g
    bg_at_bolus: float      # mg/dL


@dataclass
class BasalDose:
    timestamp: datetime
    dose_units: float       # U delivered over 5 min


@dataclass
class ParsedData:
    cgm: list[CGMReading]
    boluses: list[BolusRecord]
    basal_doses: list[BasalDose]


def _clean_header(h: str) -> str:
    return h.strip().lstrip("﻿").strip()


def _parse_cgm(text: str) -> list[CGMReading]:
    reader = csv.DictReader(io.StringIO(text))
    reader.fieldnames = [_clean_header(f) for f in (reader.fieldnames or [])]
    result = []
    for row in reader:
        try:
            ts = datetime.fromisoformat(row["Event Date Time"])
            bg = float(row["Readings (mg/dL)"])
            result.append(CGMReading(ts, bg))
        except (KeyError, ValueError):
            continue
    return result


def _parse_bolus(text: str) -> list[BolusRecord]:
    reader = csv.DictReader(io.StringIO(text))
    reader.fieldnames = [_clean_header(f) for f in (reader.fieldnames or [])]
    result = []
    for row in reader:
        try:
            ts = datetime.fromisoformat(row["Completion Date Time"])
            carbs = float(row.get("Carb Size", 0) or 0)
            bg = float(row.get("BG (mg/dL)", 0) or 0)
            result.append(BolusRecord(
                timestamp=ts,
                bolus_type=row.get("Bolus Type", "").strip(),
                total_delivered=float(row.get("Insulin Delivered", 0) or 0),
                food_delivered=float(row.get("Food Delivered", 0) or 0),
                correction_delivered=float(row.get("Correction Delivered", 0) or 0),
                carb_size=carbs,
                bg_at_bolus=bg,
            ))
        except (KeyError, ValueError):
            continue
    return result


def _parse_basal_doses(text: str) -> list[BasalDose]:
    reader = csv.DictReader(io.StringIO(text))
    reader.fieldnames = [_clean_header(f) for f in (reader.fieldnames or [])]
    result = []
    for row in reader:
        try:
            ts = datetime.fromisoformat(row["Event Date Time"])
            dose = float(row["Commanded Basal Dose (units of insulin)"])
            result.append(BasalDose(ts, dose))
        except (KeyError, ValueError):
            continue
    return result


def classify_and_parse(filename: str, content: bytes) -> tuple[str, object]:
    """
    Identify CSV type by filename suffix and parse.
    Returns (kind, parsed_list) where kind is 'cgm', 'bolus', 'basal_doses', or 'unknown'.
    """
    text = content.decode("utf-8-sig", errors="replace")
    name_lower = filename.lower()

    if "-cgm" in name_lower:
        return "cgm", _parse_cgm(text)
    elif "-bolus" in name_lower:
        return "bolus", _parse_bolus(text)
    elif "-basal-doses" in name_lower:
        return "basal_doses", _parse_basal_doses(text)
    else:
        return "unknown", []
