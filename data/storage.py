import json, os, datetime as dt

DB_FILE = "macroentreno.json"

def _load():
    if not os.path.exists(DB_FILE):
        return {"diary": [], "workouts": [], "user": {"name": "Alexis", "kcal_goal": 1800}}
    with open(DB_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def _save(data):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def add_food_entry(date, meal_type, name, grams, kcal, p, c, g, micros=None):
    data = _load()
    data["diary"].append({
        "date": str(date),
        "meal": meal_type,
        "name": name,
        "grams": grams,
        "kcal": float(kcal), "p": float(p), "c": float(c), "g": float(g),
        "micros": micros or {}
    })
    _save(data)

def get_day_entries(date):
    data = _load()
    return [e for e in data["diary"] if e["date"] == str(date)]

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
