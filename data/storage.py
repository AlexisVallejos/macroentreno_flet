import json, os, datetime as dt, uuid

DB_FILE = "macroentreno.json"

def _load():
    if not os.path.exists(DB_FILE):
        return {"diary": [], "workouts": [], "user": {"name": "Alexis", "kcal_goal": 1800}}
    with open(DB_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def _save(data):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def _ensure_entry_id(entry):
    if "entry_id" not in entry or not entry["entry_id"]:
        entry["entry_id"] = f"entry-{uuid.uuid4().hex}"

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
