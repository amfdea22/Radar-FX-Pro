def sanitize_comment(comment):
    """Sanitiza o comentário para garantir compatibilidade com MT5 (máx 30 chars, apenas ASCII)."""
    if comment is None:
        return "Radar-FX"
    try:
        import re
        text = str(comment).strip()
        clean = re.sub(r'[^a-zA-Z0-9 \-_]', '', text)
        clean = re.sub(r' +', ' ', clean).strip()
    except Exception:
        return "Radar-FX"
    if not clean:
        return "Radar-FX"
    return clean[:30]

test_cases = [
    (None, "Radar-FX"),
    ("", "Radar-FX"),
    ("   ", "Radar-FX"),
    ("Short comment", "Short comment"),
    ("A very long comment that exceeds thirty one characters for sure and should be truncated", "A very long comment that excee"),
    ("   Clean me   ", "Clean me"),
    (12345, "12345"),
    ("MANUAL | Quick Trade | BUY EURUSD", "MANUAL Quick Trade BUY EURUSD"),
    ("AlphaInst Accumulation S8", "AlphaInst Accumulation S8"),
    ("MANUAL  BUY  EURUSD", "MANUAL BUY EURUSD"),
]

for input_val, expected in test_cases:
    result = sanitize_comment(input_val)
    status = 'PASS' if result == expected else f'FAIL (got {repr(result)})'
    print(f"{status}: {repr(input_val)} -> {repr(result)}")
