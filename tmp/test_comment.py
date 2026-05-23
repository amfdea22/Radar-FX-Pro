def sanitize_comment(comment):
    """Sanitiza o comentário para garantir compatibilidade com MT5 (máx 31 chars)."""
    if comment is None:
        return "Radar-FX"
    
    # Converter para string e remover espaços
    clean = str(comment).strip()
    
    if not clean:
        return "Radar-FX"
        
    # Truncar para 31 caracteres (limite do MT5 para comentário de ordem)
    return clean[:31]

# Test Cases
test_cases = [
    (None, "Radar-FX"),
    ("", "Radar-FX"),
    ("   ", "Radar-FX"),
    ("Short comment", "Short comment"),
    ("A very long comment that exceeds thirty one characters for sure and should be truncated", "A very long comment that exceed"),
    ("   Clean me   ", "Clean me"),
    (12345, "12345")
]

for input_val, expected in test_cases:
    result = sanitize_comment(input_val)
    print(f"Input: {repr(input_val)} -> Result: {repr(result)} | {'PASS' if result == expected else 'FAIL'}")
