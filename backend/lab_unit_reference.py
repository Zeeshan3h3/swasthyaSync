"""
SwasthyaSync — Laboratory Unit Normalization Reference
"""

import re

# Each entry defines the canonical US unit, the SI unit, and the multiplier
# required to convert US -> SI. To convert SI -> US, divide by this factor.
LAB_UNIT_REFERENCE = {
    # Hematology
    "hemoglobin":       {"canonical_unit": "g/dL", "si_unit": "mmol/L", "factor_us_to_si": 0.6206},
    "haemoglobin":      {"canonical_unit": "g/dL", "si_unit": "mmol/L", "factor_us_to_si": 0.6206},
    "hb":               {"canonical_unit": "g/dL", "si_unit": "mmol/L", "factor_us_to_si": 0.6206},
    "platelet":         {"canonical_unit": "10^3/uL", "si_unit": "10^9/L", "factor_us_to_si": 1.0},
    "platelets":        {"canonical_unit": "10^3/uL", "si_unit": "10^9/L", "factor_us_to_si": 1.0},
    
    # Metabolic
    "blood glucose":    {"canonical_unit": "mg/dL", "si_unit": "mmol/L", "factor_us_to_si": 0.05551},
    "glucose":          {"canonical_unit": "mg/dL", "si_unit": "mmol/L", "factor_us_to_si": 0.05551},
    "fasting glucose":  {"canonical_unit": "mg/dL", "si_unit": "mmol/L", "factor_us_to_si": 0.05551},
    "random glucose":   {"canonical_unit": "mg/dL", "si_unit": "mmol/L", "factor_us_to_si": 0.05551},
    "hba1c":            {"canonical_unit": "%", "si_unit": "%", "factor_us_to_si": 1.0},
    "glycated hemoglobin": {"canonical_unit": "%", "si_unit": "%", "factor_us_to_si": 1.0},
    
    # Renal
    "creatinine":       {"canonical_unit": "mg/dL", "si_unit": "umol/L", "factor_us_to_si": 88.4},
    "serum creatinine": {"canonical_unit": "mg/dL", "si_unit": "umol/L", "factor_us_to_si": 88.4},
    "blood urea":       {"canonical_unit": "mg/dL", "si_unit": "mmol/L", "factor_us_to_si": 0.357},
    "bun":              {"canonical_unit": "mg/dL", "si_unit": "mmol/L", "factor_us_to_si": 0.357},
    "potassium":        {"canonical_unit": "mmol/L", "si_unit": "mEq/L", "factor_us_to_si": 1.0},
    "sodium":           {"canonical_unit": "mmol/L", "si_unit": "mEq/L", "factor_us_to_si": 1.0},
    
    # Liver
    "bilirubin":        {"canonical_unit": "mg/dL", "si_unit": "umol/L", "factor_us_to_si": 17.1},
    "total bilirubin":  {"canonical_unit": "mg/dL", "si_unit": "umol/L", "factor_us_to_si": 17.1},
    "sgpt":             {"canonical_unit": "U/L", "si_unit": "ukat/L", "factor_us_to_si": 0.01667},
    "alt":              {"canonical_unit": "U/L", "si_unit": "ukat/L", "factor_us_to_si": 0.01667},
    "sgot":             {"canonical_unit": "U/L", "si_unit": "ukat/L", "factor_us_to_si": 0.01667},
    "ast":              {"canonical_unit": "U/L", "si_unit": "ukat/L", "factor_us_to_si": 0.01667},
    
    # Cardiac
    "troponin":         {"canonical_unit": "ng/mL", "si_unit": "ng/L", "factor_us_to_si": 1000.0},
    "troponin i":       {"canonical_unit": "ng/mL", "si_unit": "ng/L", "factor_us_to_si": 1000.0},
    "troponin t":       {"canonical_unit": "ng/mL", "si_unit": "ng/L", "factor_us_to_si": 1000.0},
    "ck-mb":            {"canonical_unit": "U/L", "si_unit": "ukat/L", "factor_us_to_si": 0.01667},
    "bnp":              {"canonical_unit": "pg/mL", "si_unit": "ng/L", "factor_us_to_si": 1.0},
    
    # Coagulation
    "inr":              {"canonical_unit": "", "si_unit": "", "factor_us_to_si": 1.0},
    "pt":               {"canonical_unit": "seconds", "si_unit": "s", "factor_us_to_si": 1.0},
}

def _clean_unit(u: str) -> str:
    """Normalize a unit string to easily compare variants."""
    u = u.lower().strip()
    u = re.sub(r'\s+', '', u)
    u = u.replace("µ", "u").replace("mcg", "ug")
    return u

def normalize_lab_value(test_name: str, raw_value: float, raw_unit: str) -> float | None:
    """
    Convert raw_value/raw_unit into the test's canonical_unit.
    Returns the converted float, or None if raw_unit doesn't match either
    the canonical or SI unit for this test (i.e. it can't be confidently
    normalized).
    """
    key = test_name.lower().strip()
    
    # Exact or partial match
    ref = LAB_UNIT_REFERENCE.get(key)
    if not ref:
        for pattern, data in LAB_UNIT_REFERENCE.items():
            if pattern in key:
                ref = data
                break

    if not ref:
        # If we truly know nothing about this test, we can't normalize it, 
        # but the prompt implies this should only apply to tests we DO know.
        # However, for safety, if we don't know the test at all, we return None.
        return None

    clean_raw = _clean_unit(raw_unit)
    clean_canonical = _clean_unit(ref["canonical_unit"])
    clean_si = _clean_unit(ref["si_unit"])
    
    # Check if troponin pg/mL variant (si_unit is ng/L but pg/mL is equivalent)
    if "troponin" in key and clean_raw == "pg/ml":
        clean_raw = "ng/l"

    if clean_raw == clean_canonical:
        return float(raw_value)
    
    if clean_raw == clean_si:
        # Convert SI to canonical (US)
        return float(raw_value) / ref["factor_us_to_si"]
        
    # Extra check for dimensionless / no unit
    if clean_canonical == "" and clean_raw in ["", "none", "n/a", "-"]:
        return float(raw_value)
        
    # Some extra loose matching for U/L
    if clean_canonical == "u/l" and clean_raw in ["units/l", "iu/l"]:
        return float(raw_value)
        
    # Same for 10^3/uL
    if clean_canonical == "10^3/ul" and clean_raw in ["10*3/ul", "x10^3/ul", "k/ul", "10^3/mm3", "10*9/l", "10^9/l"]:
        return float(raw_value)
        
    # Seconds
    if clean_canonical == "seconds" and clean_raw in ["sec", "secs", "s"]:
        return float(raw_value)

    return None
