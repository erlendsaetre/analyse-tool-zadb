"""
Smart Excel Parser
==================
Auto-detects Excel file format and extracts all rate information intelligently.

Supported formats (auto-detected):
  1. KN ML-Rates: Standard KN quote file with "ML-Rates" sheet
  2. KN Row_based: KN TE Connect / tender export with "Row_based" sheet
  3. Generic: Falls back to header-matching on any sheet

Detection strategy:
  - Check sheet names for known patterns
  - Scan headers for known column names
  - Map columns dynamically based on header text matching
"""

import openpyxl
import pandas as pd
import io
import re
from datetime import datetime


# ══════════════════════════════════════════════════════════════
#  Known header patterns → our field names
# ══════════════════════════════════════════════════════════════

# Maps known header text (lowercase) to our internal field names.
# Multiple header texts can map to the same field for flexibility.
HEADER_MAP = {
    # Airline / Carrier
    'airline': 'airline',
    'carrier': 'airline',
    'iata code': 'airline',
    
    # GSA
    'gsa': 'gsa',
    
    # Product / Service
    'product': 'product',
    'service': 'product',
    'service level': 'product',
    'kn product': 'product',
    
    # Origin
    'origin': 'origin',
    'origin airport': 'origin',
    'kn assigned origin airport': 'origin',
    'kn origin airport': 'origin',
    'from': 'origin',
    'pol': 'origin',   # Port of Loading
    
    # Destination
    'destination': 'destination',
    'dest': 'destination',
    'destination airport': 'destination',
    'kn assigned destination airport': 'destination',
    'kn destination airport': 'destination',
    'to': 'destination',
    'pod': 'destination',  # Port of Discharge
    
    # Origin details
    'origin city': 'origin_city',
    'origin country': 'origin_country',
    'origin country code': 'origin_country',
    'pickup zip': 'origin_zip',
    'pickup postal code': 'origin_zip',
    'pickup zip code': 'origin_zip',
    'collection zip': 'origin_zip',
    'collection postal code': 'origin_zip',
    
    # Destination details
    'destination city': 'destination_city',
    'dest city': 'destination_city',
    'destination country': 'destination_country',
    'destination country code': 'destination_country',
    'delivery zip': 'destination_zip',
    'delivery postal code': 'destination_zip',
    'delivery zip code': 'destination_zip',
    
    # Via / Routing
    'via': 'via',
    'transit': 'via',
    'transit airport': 'via',
    'routing': 'routing',
    'route': 'routing',
    
    # Rate brackets
    'min': 'cost_min',
    'minimum': 'cost_min',
    'min rate': 'cost_min',
    'main carriage (min)': 'cost_min',
    
    'normal': 'cost_normal',
    '+0kg': 'cost_normal',
    'normal rate': 'cost_normal',
    'main carriage (+0kg)': 'cost_normal',
    
    'q45': 'cost_q45',
    '+45': 'cost_q45',
    '+45kg': 'cost_q45',
    'main carriage (+45kg)': 'cost_q45',
    
    'q100': 'cost_q100',
    '+100': 'cost_q100',
    '+100kg': 'cost_q100',
    'main carriage (+100kg)': 'cost_q100',
    
    'q300': 'cost_q300',
    '+300': 'cost_q300',
    '+300kg': 'cost_q300',
    'main carriage (+300kg)': 'cost_q300',
    
    'q500': 'cost_q500',
    '+500': 'cost_q500',
    '+500kg': 'cost_q500',
    'main carriage (+500kg)': 'cost_q500',
    
    'q1000': 'cost_q1000',
    '+1000': 'cost_q1000',
    '+1000kg': 'cost_q1000',
    'main carriage (+1000kg)': 'cost_q1000',
    
    'q3000': 'cost_q3000',
    '+3000': 'cost_q3000',
    '+3000kg': 'cost_q3000',
    'main carriage (+3000kg)': 'cost_q3000',
    
    # Currency
    'currency': 'currency',
    'curr': 'currency',
    'ccy': 'currency',
    'main carriage currency': 'currency',
    
    # Validity
    'valid': 'valid_from',
    'valid from': 'valid_from',
    'start date': 'valid_from',
    'effective date': 'valid_from',
    'effective from': 'valid_from',
    
    'expires': 'valid_until',
    'valid until': 'valid_until',
    'valid to': 'valid_until',
    'expiry': 'valid_until',
    'expiry date': 'valid_until',
    'end date': 'valid_until',
    
    # Fuel / Surcharges
    'fuel': 'fuel',
    'fuel surcharge': 'fuel',
    'fuel charge': 'fuel',
    'security surcharge': 'security_surcharge',
    'security': 'security_surcharge',
    'fixed': 'fixed',
    
    # Misc
    'relation kg/m3': 'relation_kg_m3',
    'volume ratio': 'relation_kg_m3',
    'terms': 'terms',
    'terms of delivery': 'terms',
    'incoterm': 'terms',
    'incoterms': 'terms',
    'movement type': 'direction',
    'traffic direction': 'direction',
    
    # Lane ID
    'kn lane id': 'lane_id',
    'lane id': 'lane_id',
    'lane': 'lane_id',
    
    # Notes
    'commodity': 'notes',
    'remarks': 'notes',
    'comment': 'notes',
    'comments': 'notes',
}


def _safe_float(val):
    """Convert to float, handling common Excel quirks."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val) if val == val else None  # NaN check
    s = str(val).strip()
    if s.lower() in ('', '-', 'n/a', 'na', 'no', 'nan', 'o.r', 'o.r.', 'on request'):
        return None
    # Handle comma as thousand separator: "1,305.00" -> 1305.00
    s = s.replace(',', '')
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def _safe_str(val):
    """Convert to clean string."""
    if val is None:
        return ""
    if isinstance(val, float):
        if val != val:  # NaN
            return ""
        if val == int(val):
            return str(int(val))
    s = str(val).strip()
    if s.lower() in ('nan', 'none'):
        return ""
    return s


def _safe_date(val):
    """Parse date from various formats."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    s = str(val).strip()
    if s.lower() in ('', '-', 'n/a', 'na', 'nan'):
        return None
    # Try common date formats
    for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d.%m.%Y', '%d-%m-%Y', '%m/%d/%Y'):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    try:
        return pd.to_datetime(s, dayfirst=True).to_pydatetime()
    except Exception:
        return None


# ══════════════════════════════════════════════════════════════
#  Auto-detect and parse
# ══════════════════════════════════════════════════════════════

def smart_parse(contents: bytes):
    """
    Auto-detect Excel format and parse all rate data.
    
    Returns:
        (rates: list[dict], metadata: dict)
        
    metadata includes:
        - format_detected: str  (e.g. 'ml_rates', 'kn_row_based', 'generic')
        - sheet_used: str
        - header_row: int
        - columns_mapped: dict  (our field -> original header)
        - columns_unmapped: list  (headers we couldn't map)
        - direction: str  ('export', 'import', 'unknown')
        - total_rows: int
        - skipped_rows: int
        - notes: str
    """
    wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
    
    # ── Step 1: Detect format by sheet names ──
    sheet_names_lower = {name.lower(): name for name in wb.sheetnames}
    
    format_detected = 'generic'
    target_sheet = None
    
    # Check for ML-Rates (standard KN quote format)
    if 'ml-rates' in sheet_names_lower:
        format_detected = 'ml_rates'
        target_sheet = sheet_names_lower['ml-rates']
    
    # Check for Row_based (KN TE Connect tender export)
    for name_lower, name_actual in sheet_names_lower.items():
        if 'row_based' in name_lower:
            format_detected = 'kn_row_based'
            target_sheet = name_actual
            break
    
    # Fallback: use first non-"General" sheet, or just first sheet
    if not target_sheet:
        for name in wb.sheetnames:
            if name.lower() != 'general':
                target_sheet = name
                break
        if not target_sheet:
            target_sheet = wb.sheetnames[0]
    
    ws = wb[target_sheet]
    
    # ── Step 2: Find header row ──
    header_row = _find_header_row(ws, format_detected)
    
    # ── Step 3: Map columns ──
    column_mapping, unmapped_headers = _map_columns(ws, header_row, format_detected)
    
    # ── Step 4: Detect direction (export/import) ──
    direction = _detect_direction(ws, column_mapping, header_row)
    
    # ── Step 5: Extract data rows ──
    data_start_row = header_row + 1
    if format_detected == 'kn_row_based':
        data_start_row = header_row + 2  # KN format has a gap row
    
    rates = []
    skipped = 0
    
    for row_idx in range(data_start_row, ws.max_row + 1):
        row_data = {}
        has_any_value = False
        
        for our_field, col_idx in column_mapping.items():
            cell_val = ws.cell(row=row_idx, column=col_idx).value
            
            # Determine type based on field name
            if our_field.startswith('cost_') or our_field == 'relation_kg_m3':
                row_data[our_field] = _safe_float(cell_val)
            elif our_field in ('valid_from', 'valid_until'):
                row_data[our_field] = _safe_date(cell_val)
            else:
                row_data[our_field] = _safe_str(cell_val)
            
            if cell_val is not None and str(cell_val).strip() not in ('', 'nan', 'None'):
                has_any_value = True
        
        if not has_any_value:
            skipped += 1
            continue
        
        # Must have at least airline or origin to be valid
        airline = row_data.get('airline', '')
        origin = row_data.get('origin', '')
        if not airline and not origin:
            skipped += 1
            continue
        
        # Build notes from unmapped or context fields
        notes_parts = []
        if row_data.get('lane_id'):
            notes_parts.append(f"Lane {row_data['lane_id']}")
        if row_data.get('origin_city'):
            notes_parts.append(f"From: {row_data['origin_city']}")
        if row_data.get('destination_city'):
            notes_parts.append(f"To: {row_data['destination_city']}")
        if row_data.get('origin_zip'):
            notes_parts.append(f"Pickup ZIP: {row_data['origin_zip']}")
        if row_data.get('destination_zip'):
            notes_parts.append(f"Delivery ZIP: {row_data['destination_zip']}")
        if row_data.get('routing'):
            notes_parts.append(f"Route: {row_data['routing']}")
        if row_data.get('fuel'):
            notes_parts.append(f"Fuel: {row_data['fuel']}")
        if row_data.get('security_surcharge'):
            notes_parts.append(f"Security: {row_data['security_surcharge']}")
        if row_data.get('direction'):
            notes_parts.append(f"Direction: {row_data['direction']}")
        if row_data.get('notes'):
            notes_parts.append(row_data['notes'])
        
        # Build product label
        product = row_data.get('product', '')
        
        rate = {
            'lane_id': row_data.get('lane_id') or None,
            'airline': airline or 'Unknown',
            'product': product or None,
            'origin': origin or None,
            'destination': row_data.get('destination') or None,
            'via': row_data.get('via') or None,
            'routing': row_data.get('routing') or None,
            'currency': row_data.get('currency') or 'NOK',
            'terms': row_data.get('terms') or None,
            'cost_min': row_data.get('cost_min'),
            'cost_normal': row_data.get('cost_normal'),
            'cost_q45': row_data.get('cost_q45'),
            'cost_q100': row_data.get('cost_q100'),
            'cost_q300': row_data.get('cost_q300'),
            'cost_q500': row_data.get('cost_q500'),
            'cost_q1000': row_data.get('cost_q1000'),
            'cost_q3000': row_data.get('cost_q3000'),
            'valid_from': row_data.get('valid_from'),
            'valid_until': row_data.get('valid_until'),
            'notes': ' | '.join(notes_parts) if notes_parts else None,
        }
        rates.append(rate)
    
    metadata = {
        'format_detected': format_detected,
        'sheet_used': target_sheet,
        'header_row': header_row,
        'columns_mapped': {k: _col_index_to_letter(v) for k, v in column_mapping.items()},
        'columns_unmapped': unmapped_headers,
        'direction': direction,
        'total_rows': len(rates),
        'skipped_rows': skipped,
        'notes': f"Format: {format_detected} | Sheet: '{target_sheet}' | "
                 f"Headers on row {header_row} | {len(rates)} rates extracted, "
                 f"{skipped} rows skipped | Direction: {direction} | "
                 f"Mapped {len(column_mapping)} columns, {len(unmapped_headers)} unmapped"
    }
    
    return rates, metadata


def _find_header_row(ws, format_detected: str) -> int:
    """Find the row containing column headers."""
    if format_detected == 'kn_row_based':
        # KN Row_based format: headers are on row 12
        return 12
    
    # For ML-Rates and generic: scan first 20 rows for header patterns
    header_keywords = {'airline', 'carrier', 'origin', 'destination', 'product', 
                       'min', 'normal', 'q100', 'currency', '+100', 'via'}
    
    best_row = 1
    best_score = 0
    
    for row_idx in range(1, min(21, ws.max_row + 1)):
        score = 0
        for col_idx in range(1, min(30, ws.max_column + 1)):
            val = ws.cell(row=row_idx, column=col_idx).value
            if val and str(val).strip().lower() in header_keywords:
                score += 1
        if score > best_score:
            best_score = score
            best_row = row_idx
    
    return best_row


def _map_columns(ws, header_row: int, format_detected: str) -> tuple:
    """
    Map column indices to our field names based on header text.
    Returns (mapping: dict[str, int], unmapped: list[str])
    """
    mapping = {}
    unmapped = []
    
    for col_idx in range(1, ws.max_column + 1):
        header_val = ws.cell(row=header_row, column=col_idx).value
        if header_val is None:
            continue
        
        header_text = str(header_val).strip().lower()
        if not header_text:
            continue
        
        # Direct match
        if header_text in HEADER_MAP:
            our_field = HEADER_MAP[header_text]
            # Don't overwrite if already mapped (first match wins)
            if our_field not in mapping:
                mapping[our_field] = col_idx
        else:
            # Try partial matching for longer headers
            matched = False
            for pattern, field in HEADER_MAP.items():
                if pattern in header_text or header_text in pattern:
                    if field not in mapping:
                        mapping[field] = col_idx
                        matched = True
                        break
            if not matched:
                unmapped.append(f"{_col_index_to_letter(col_idx)}: {header_val}")
    
    return mapping, unmapped


def _detect_direction(ws, column_mapping: dict, header_row: int) -> str:
    """Detect if the shipment direction is export or import relative to Norway."""
    # Check if we have a direction field mapped
    if 'direction' in column_mapping:
        for row_idx in range(header_row + 1, min(header_row + 10, ws.max_row + 1)):
            val = ws.cell(row=row_idx, column=column_mapping['direction']).value
            if val:
                v = str(val).strip().lower()
                if 'export' in v:
                    return 'export'
                if 'import' in v:
                    return 'import'
    
    # Heuristic: check origin/destination values
    norway_codes = {'osl', 'bgo', 'svg', 'trd', 'bod', 'trf', 'hau', 'tos', 'alesund', 'no'}
    
    if 'origin' in column_mapping:
        for row_idx in range(header_row + 1, min(header_row + 10, ws.max_row + 1)):
            val = ws.cell(row=row_idx, column=column_mapping['origin']).value
            if val and str(val).strip().lower() in norway_codes:
                return 'export'
    
    if 'destination' in column_mapping:
        for row_idx in range(header_row + 1, min(header_row + 10, ws.max_row + 1)):
            val = ws.cell(row=row_idx, column=column_mapping['destination']).value
            if val and str(val).strip().lower() in norway_codes:
                return 'import'
    
    return 'unknown'


def _col_index_to_letter(idx: int) -> str:
    """Convert 1-based column index to Excel column letter."""
    result = ""
    while idx > 0:
        idx, remainder = divmod(idx - 1, 26)
        result = chr(65 + remainder) + result
    return result
