from typing import Dict, List

MICRO_PRESETS: List[Dict] = [
    {"id": "vitamin_c", "label": "Vitamina C", "unit": "mg", "goal": 90, "hint": "Sistema inmune"},
    {"id": "vitamin_d", "label": "Vitamina D", "unit": "IU", "goal": 600, "hint": "Salud osea"},
    {"id": "magnesium", "label": "Magnesio", "unit": "mg", "goal": 350, "hint": "Funcion muscular"},
    {"id": "iron", "label": "Hierro", "unit": "mg", "goal": 18, "hint": "Transporte de oxigeno"},
    {"id": "calcium", "label": "Calcio", "unit": "mg", "goal": 1000, "hint": "Huesos fuertes"},
    {"id": "potassium", "label": "Potasio", "unit": "mg", "goal": 3500, "hint": "Equilibrio electrolitico"},
    {"id": "fiber", "label": "Fibra", "unit": "g", "goal": 30, "hint": "Salud digestiva"},
    {"id": "zinc", "label": "Zinc", "unit": "mg", "goal": 11, "hint": "Recuperacion muscular"},
]

UNIT_SUGGESTIONS = ["mg", "mcg", "IU", "g", "caps", "tabs"]
