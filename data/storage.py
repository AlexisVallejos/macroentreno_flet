import json, os, datetime as dt, uuid
from copy import deepcopy
from typing import Dict, List, Optional

DB_FILE = "macroentreno.json"

def _load() -> Dict:
    if not os.path.exists(DB_FILE):
        return {
            "diary": [],
            "workouts": [],
            "user": {"name": "Alexis", "kcal_goal": 1800},
            "custom_foods": [],
        }
    with open(DB_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    changed = False
    if "diary" not in data:
        data["diary"] = []
        changed = True
    if "workouts" not in data:
        data["workouts"] = []
        changed = True
    if "user" not in data:
        data["user"] = {"name": "Alexis", "kcal_goal": 1800}
        changed = True
    if "custom_foods" not in data:
        data["custom_foods"] = []
        changed = True
    if changed:
        _save(data)
    return data

def _save(data: Dict):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def _ensure_entry_id(entry: Dict):
    if "entry_id" not in entry or not entry["entry_id"]:
        entry["entry_id"] = f"entry-{uuid.uuid4().hex}"

def _ensure_custom_food_id(food: Dict):
    if "id" not in food or not food["id"]:
        food["id"] = f"custom-{uuid.uuid4().hex}"

def _normalise_portion(grams: float, description: Optional[str] = None) -> Dict:
    grams = float(grams or 0)
    if grams <= 0:
        grams = 100.0
    description = description or f"por {grams:.0f} g"
    return {"grams": grams, "description": description}

def _normalise_macros(kcal, p, c, g) -> Dict:
    return {
        "kcal": float(kcal or 0.0),
        "p": float(p or 0.0),
        "c": float(c or 0.0),
        "g": float(g or 0.0),
    }

def add_food_entry(date, meal_type, name, grams, kcal, p, c, g, micros=None, food_ref=None, entry_id=None):
    data = _load()
    entry = {
        "date": str(date),
        "meal": meal_type,
        "name": name,
        "grams": grams,
        "kcal": float(kcal), "p": float(p), "c": float(c), "g": float(g),
        "micros": micros or {}
    }
    if food_ref:
        entry["food"] = food_ref
    if entry_id:
        entry["entry_id"] = entry_id
    _ensure_entry_id(entry)
    data["diary"].append(entry)
    _save(data)

def get_day_entries(date):
    data = _load()
    changed = False
    result = []
    for entry in data["diary"]:
        if entry["date"] == str(date):
            if "entry_id" not in entry:
                _ensure_entry_id(entry)
                changed = True
            result.append(entry)
        else:
            if "entry_id" not in entry:
                _ensure_entry_id(entry)
                changed = True
    if changed:
        _save(data)
    return result

def get_week_entries(end_date, days=7):
    data = _load()
    end = dt.date.fromisoformat(str(end_date))
    start = end - dt.timedelta(days=days-1)
    out = []
    for e in data["diary"]:
        d = dt.date.fromisoformat(e["date"])
        if start <= d <= end:
            out.append(e)
    return out

def add_workout(date, muscle_group, exercises):
    data = _load()
    data["workouts"].append({"date": str(date), "muscle": muscle_group, "exercises": exercises})
    _save(data)

def get_user():
    return _load()["user"]

def update_food_entry(entry_id, *, name=None, meal=None, grams=None, kcal=None, p=None, c=None, g=None, food_ref=None, micros=None):
    data = _load()
    updated = False
    for entry in data["diary"]:
        if entry.get("entry_id") == entry_id:
            if name is not None:
                entry["name"] = name
            if meal is not None:
                entry["meal"] = meal
            if grams is not None:
                entry["grams"] = grams
            if kcal is not None:
                entry["kcal"] = float(kcal)
            if p is not None:
                entry["p"] = float(p)
            if c is not None:
                entry["c"] = float(c)
            if g is not None:
                entry["g"] = float(g)
            if micros is not None:
                entry["micros"] = micros
            if food_ref is not None:
                entry["food"] = food_ref
            updated = True
            break
    if updated:
        _save(data)
    return updated

def delete_food_entry(entry_id):
    data = _load()
    before = len(data["diary"])
    data["diary"] = [entry for entry in data["diary"] if entry.get("entry_id") != entry_id]
    removed = len(data["diary"]) != before
    if removed:
        _save(data)
    return removed

def list_custom_foods() -> List[Dict]:
    data = _load()
    custom_foods = data.get("custom_foods", [])
    changed = False
    for food in custom_foods:
        if "source" not in food:
            food["source"] = "custom"
            changed = True
        if "portion" not in food:
            food["portion"] = _normalise_portion(100.0)
            changed = True
        if "macros" not in food:
            food["macros"] = _normalise_macros(0, 0, 0, 0)
            changed = True
        if "name" not in food:
            food["name"] = "Comida personalizada"
            changed = True
        prev_id = food.get("id")
        _ensure_custom_food_id(food)
        if prev_id != food["id"]:
            changed = True
    if changed:
        _save(data)
    return deepcopy(custom_foods)

def get_custom_food(food_id: str) -> Optional[Dict]:
    if not food_id:
        return None
    foods = list_custom_foods()
    for food in foods:
        if food.get("id") == food_id:
            return food
    return None

def create_custom_food(name: str, grams: float, kcal: float, p: float, c: float, g: float, description: Optional[str] = None) -> Dict:
    data = _load()
    custom_foods = data.setdefault("custom_foods", [])
    food = {
        "name": name.strip() if name else "Comida personalizada",
        "source": "custom",
        "portion": _normalise_portion(grams, description),
        "macros": _normalise_macros(kcal, p, c, g),
    }
    _ensure_custom_food_id(food)
    custom_foods.append(food)
    _save(data)
    return deepcopy(food)

def update_custom_food(food_id: str, *, name: Optional[str] = None, grams: Optional[float] = None, kcal: Optional[float] = None, p: Optional[float] = None, c: Optional[float] = None, g: Optional[float] = None, description: Optional[str] = None) -> Optional[Dict]:
    data = _load()
    custom_foods = data.setdefault("custom_foods", [])
    updated_food: Optional[Dict] = None
    for food in custom_foods:
        if food.get("id") == food_id:
            if name is not None:
                food["name"] = name.strip() or food.get("name", "Comida personalizada")
            if "source" not in food:
                food["source"] = "custom"
            if grams is not None or description is not None:
                grams_value = grams if grams is not None else food.get("portion", {}).get("grams", 100)
                desc_value = description if description is not None else food.get("portion", {}).get("description")
                food["portion"] = _normalise_portion(grams_value, desc_value)
            macros = food.setdefault("macros", _normalise_macros(0, 0, 0, 0))
            if kcal is not None:
                macros["kcal"] = float(kcal)
            if p is not None:
                macros["p"] = float(p)
            if c is not None:
                macros["c"] = float(c)
            if g is not None:
                macros["g"] = float(g)
            updated_food = deepcopy(food)
            break
    if updated_food:
        _save(data)
    return updated_food

def delete_custom_food(food_id: str) -> bool:
    data = _load()
    custom_foods = data.setdefault("custom_foods", [])
    before = len(custom_foods)
    data["custom_foods"] = [food for food in custom_foods if food.get("id") != food_id]
    removed = len(data["custom_foods"]) != before
    if removed:
        _save(data)
    return removed
