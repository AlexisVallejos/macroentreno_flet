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
            "micronutrients": [],
        }
    with open(DB_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    changed = False
    changed |= _normalise_diary_entries(data)
    changed |= _migrate_meal_micros(data)
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
    if "micronutrients" not in data:
        data["micronutrients"] = []
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

def _ensure_workout_id(workout: Dict):
    if "id" not in workout or not workout["id"]:
        workout["id"] = f"workout-{uuid.uuid4().hex}"
        workout["created_at"] = dt.datetime.utcnow().isoformat()
    workout["updated_at"] = dt.datetime.utcnow().isoformat()

def _ensure_micro_entry_id(entry: Dict):
    if "entry_id" not in entry or not entry["entry_id"]:
        entry["entry_id"] = f"micro-{uuid.uuid4().hex}"

def _normalise_diary_entries(data: Dict) -> bool:
    changed = False
    for entry in data.get("diary", []):
        micros = entry.get("micros")
        if isinstance(micros, dict):
            entry["micros"] = []
            changed = True
        elif micros is None:
            entry["micros"] = []
            changed = True
        elif isinstance(micros, list):
            for micro in micros:
                if "date" not in micro:
                    micro["date"] = entry.get("date")
                    changed = True
                if "meal_entry_id" not in micro:
                    micro["meal_entry_id"] = entry.get("entry_id")
                    changed = True
                if "kind" not in micro:
                    micro["kind"] = "meal"
                    changed = True
                if "created_at" not in micro:
                    micro["created_at"] = micro.get("date") or dt.datetime.utcnow().isoformat()
                    changed = True
                if "updated_at" not in micro:
                    micro["updated_at"] = micro["created_at"]
                    changed = True
                prev_id = micro.get("entry_id")
                _ensure_micro_entry_id(micro)
                if micro.get("entry_id") != prev_id:
                    changed = True
    return changed

def _find_diary_entry(data: Dict, entry_id: str) -> Optional[Dict]:
    for entry in data.get("diary", []):
        if entry.get("entry_id") == entry_id:
            if not isinstance(entry.get("micros"), list):
                entry["micros"] = []
            return entry
    return None

def _get_entry_micros(entry: Dict) -> List[Dict]:
    micros = entry.get("micros")
    if isinstance(micros, list):
        return micros
    entry["micros"] = []
    return entry["micros"]

def _migrate_meal_micros(data: Dict) -> bool:
    """Move any micronutrient entries that reference a meal into that meal."""
    micros = data.get("micronutrients", [])
    if not micros:
        return False
    remaining = []
    changed = False
    for micro in micros:
        meal_entry_id = micro.get("meal_entry_id")
        if not meal_entry_id:
            remaining.append(micro)
            continue
        entry = _find_diary_entry(data, meal_entry_id)
        if not entry:
            remaining.append(micro)
            continue
        entry_micros = entry.setdefault("micros", [])
        _ensure_micro_entry_id(micro)
        micro.setdefault("kind", "meal")
        micro["date"] = entry.get("date")
        entry_micros.append(micro)
        changed = True
    if changed:
        data["micronutrients"] = remaining
    return changed

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
        "micros": micros or []
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

def get_recent_entries(limit: int = 4):
    data = _load()
    diary = data.get("diary", [])
    if limit <= 0:
        return []
    recent = diary[-limit:]
    recent_reversed = list(reversed(recent))
    return [deepcopy(entry) for entry in recent_reversed]

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

def add_micro_entry(date, nutrient_id, label, amount, unit, source=None, notes=None, meal_entry_id=None, kind=None):
    data = _load()
    micro_entry = {
        "date": str(date),
        "nutrient": nutrient_id or "custom",
        "label": (label or "Micronutriente").strip(),
        "amount": float(amount or 0.0),
        "unit": (unit or "mg").strip(),
        "source": (source or "").strip(),
        "notes": (notes or "").strip(),
        "meal_entry_id": meal_entry_id,
        "kind": kind or ("meal" if meal_entry_id else "supplement"),
        "created_at": dt.datetime.utcnow().isoformat(),
    }
    micro_entry["updated_at"] = micro_entry["created_at"]
    _ensure_micro_entry_id(micro_entry)

    if meal_entry_id:
        diary_entry = _find_diary_entry(data, meal_entry_id)
        if not diary_entry:
            raise ValueError("meal_entry_id no encontrado")
        micro_entry["date"] = diary_entry.get("date")
        _get_entry_micros(diary_entry).append(micro_entry)
    else:
        micros = data.setdefault("micronutrients", [])
        micros.append(micro_entry)

    _save(data)
    return deepcopy(micro_entry)

def list_micro_entries(date=None):
    data = _load()
    date_filter = str(date) if date is not None else None
    result: List[Dict] = []
    changed = False

    for entry in data.get("diary", []):
        entry_micros = _get_entry_micros(entry)
        for micro in entry_micros:
            if micro.get("date") != entry.get("date"):
                micro["date"] = entry.get("date")
                changed = True
            if micro.get("meal_entry_id") != entry.get("entry_id"):
                micro["meal_entry_id"] = entry.get("entry_id")
                changed = True
            if micro.get("kind") not in {"meal", "supplement"}:
                micro["kind"] = "meal"
                changed = True
            if "created_at" not in micro:
                micro["created_at"] = micro.get("date") or dt.datetime.utcnow().isoformat()
                changed = True
            if "updated_at" not in micro:
                micro["updated_at"] = micro["created_at"]
                changed = True
            _ensure_micro_entry_id(micro)
            if date_filter and entry.get("date") != date_filter:
                continue
            result.append(deepcopy(micro))

    supplements = data.get("micronutrients", [])
    for micro in supplements:
        if "entry_id" not in micro or not micro["entry_id"]:
            _ensure_micro_entry_id(micro)
            changed = True
        if "created_at" not in micro:
            micro["created_at"] = micro.get("date") or dt.datetime.utcnow().isoformat()
            changed = True
        if "updated_at" not in micro:
            micro["updated_at"] = micro["created_at"]
            changed = True
        if "meal_entry_id" not in micro:
            micro["meal_entry_id"] = None
            changed = True
        if "kind" not in micro or micro["kind"] != "supplement":
            micro["kind"] = "supplement"
            changed = True
        if date_filter and micro.get("date") != date_filter:
            continue
        result.append(deepcopy(micro))

    if changed:
        _save(data)
    return sorted(result, key=lambda e: e.get("created_at", ""))

def delete_micro_entry(entry_id: str) -> bool:
    if not entry_id:
        return False
    data = _load()
    removed = False
    for diary_entry in data.get("diary", []):
        micros = _get_entry_micros(diary_entry)
        before = len(micros)
        diary_entry["micros"] = [micro for micro in micros if micro.get("entry_id") != entry_id]
        if len(diary_entry["micros"]) != before:
            removed = True
    if not removed:
        micros = data.get("micronutrients", [])
        before = len(micros)
        data["micronutrients"] = [entry for entry in micros if entry.get("entry_id") != entry_id]
        removed = len(data["micronutrients"]) != before
    if removed:
        _save(data)
    return removed

def update_micro_entry(entry_id: str, *, label=None, amount=None, unit=None, source=None, notes=None, nutrient_id=None, meal_entry_id=None, kind=None):
    data = _load()
    updated = False

    supplements = data.setdefault("micronutrients", [])

    def apply_common_updates(micro: Dict):
        if label is not None:
            micro["label"] = label
        if amount is not None:
            micro["amount"] = float(amount)
        if unit is not None:
            micro["unit"] = unit
        if source is not None:
            micro["source"] = source
        if notes is not None:
            micro["notes"] = notes
        if nutrient_id is not None:
            micro["nutrient"] = nutrient_id

    target_kind = kind
    target_meal_id = meal_entry_id

    for entry in data.get("diary", []):
        micros = _get_entry_micros(entry)
        for idx, micro in enumerate(micros):
            if micro.get("entry_id") != entry_id:
                continue
            apply_common_updates(micro)

            new_kind = target_kind if target_kind is not None else micro.get("kind")
            new_kind = new_kind or "meal"
            if new_kind == "supplement":
                # Move to supplements
                del micros[idx]
                micro["meal_entry_id"] = None
                micro["kind"] = "supplement"
                supplements.append(micro)
            else:
                desired_meal = target_meal_id if target_meal_id is not None else micro.get("meal_entry_id")
                desired_meal = desired_meal or entry.get("entry_id")
                if desired_meal != entry.get("entry_id"):
                    target_entry = _find_diary_entry(data, desired_meal)
                    if target_entry:
                        del micros[idx]
                        micro["meal_entry_id"] = desired_meal
                        micro["date"] = target_entry.get("date")
                        _get_entry_micros(target_entry).append(micro)
                    else:
                        micro["meal_entry_id"] = entry.get("entry_id")
                else:
                    micro["meal_entry_id"] = entry.get("entry_id")
                micro["kind"] = "meal"

            micro["updated_at"] = dt.datetime.utcnow().isoformat()
            updated = True
            break
        if updated:
            break

    if not updated:
        for idx, micro in enumerate(supplements):
            if micro.get("entry_id") != entry_id:
                continue
            apply_common_updates(micro)
            move_to_meal = (target_kind == "meal") or (target_meal_id is not None)
            if move_to_meal and target_meal_id:
                target_entry = _find_diary_entry(data, target_meal_id)
                if target_entry:
                    micro["meal_entry_id"] = target_meal_id
                    micro["kind"] = "meal"
                    micro["date"] = target_entry.get("date")
                    _get_entry_micros(target_entry).append(micro)
                    del supplements[idx]
                else:
                    micro["meal_entry_id"] = None
                    micro["kind"] = "supplement"
            else:
                micro["meal_entry_id"] = None
                micro["kind"] = "supplement" if (target_kind is None or target_kind == "supplement") else micro.get("kind", "supplement")
            micro["updated_at"] = dt.datetime.utcnow().isoformat()
            updated = True
            break

    if updated:
        _save(data)
    return updated

def get_micro_totals(date):
    totals = {}
    for entry in list_micro_entries(date):
        key = entry.get("nutrient") or entry.get("label")
        if not key:
            continue
        bucket = totals.setdefault(
            key,
            {
                "amount": 0.0,
                "unit": entry.get("unit") or "mg",
                "label": entry.get("label") or key.title(),
            },
        )
        bucket["amount"] += float(entry.get("amount") or 0.0)
    return totals

def _normalise_sets(sets: List[Dict]) -> List[Dict]:
    normalised = []
    for idx, item in enumerate(sets or [], 1):
        reps = item.get("reps")
        weight = item.get("weight")
        effort = item.get("effort")
        try:
            reps = int(reps)
        except (TypeError, ValueError):
            reps = 0
        try:
            weight = float(weight)
        except (TypeError, ValueError):
            weight = 0.0
        try:
            effort = int(effort) if effort is not None else None
        except (TypeError, ValueError):
            effort = None
        normalised.append(
            {
                "set": item.get("set") or idx,
                "reps": reps,
                "weight": weight,
                "effort": effort,
            }
        )
    return normalised

def create_workout(date, title, muscle_groups, exercises, notes: Optional[str] = None) -> Dict:
    data = _load()
    workouts = data.setdefault("workouts", [])
    workout = {
        "date": str(date),
        "title": title.strip() if title else "Sesion de entrenamiento",
        "muscle_groups": [m.strip() for m in (muscle_groups or []) if m],
        "exercises": [],
        "notes": notes or "",
    }
    for exercise in exercises or []:
        info = {
            "id": exercise.get("id"),
            "name": exercise.get("name", "Ejercicio"),
            "image": exercise.get("image"),
            "notes": exercise.get("notes", ""),
            "sets": _normalise_sets(exercise.get("sets", [])),
        }
        workout["exercises"].append(info)
    _ensure_workout_id(workout)
    workouts.append(workout)
    _save(data)
    return deepcopy(workout)

def list_workouts(limit: Optional[int] = None) -> List[Dict]:
    data = _load()
    workouts = data.get("workouts", [])
    sorted_workouts = sorted(workouts, key=lambda w: w.get("date", ""), reverse=True)
    if limit is not None and limit >= 0:
        sorted_workouts = sorted_workouts[:limit]
    return deepcopy(sorted_workouts)

def get_workouts_by_week(end_date, days: int = 7) -> List[Dict]:
    end = dt.date.fromisoformat(str(end_date))
    start = end - dt.timedelta(days=days - 1)
    workouts = list_workouts()
    selected = []
    for workout in workouts:
        d = dt.date.fromisoformat(workout.get("date", str(end)))
        if start <= d <= end:
            selected.append(workout)
    return selected

def get_exercise_progress(end_date=None, days: int = 14) -> Dict[str, Dict]:
    """
    Returns progress information per exercise, comparing the last two logged sessions
    within the provided time window.
    """
    if end_date is None:
        end_date = dt.date.today()
    end = dt.date.fromisoformat(str(end_date))
    start = end - dt.timedelta(days=days - 1)
    workouts = list_workouts()
    history: Dict[str, List[Dict]] = {}
    for workout in workouts:
        workout_date = dt.date.fromisoformat(workout.get("date", str(end)))
        if not (start <= workout_date <= end):
            continue
        for exercise in workout.get("exercises", []):
            ex_id = exercise.get("id") or exercise.get("name")
            history.setdefault(ex_id, []).append(
                {
                    "date": workout_date,
                    "exercise": exercise,
                    "workout_title": workout.get("title", ""),
                }
            )
    progress: Dict[str, Dict] = {}
    for ex_id, sessions in history.items():
        if len(sessions) < 2:
            continue
        sorted_sessions = sorted(sessions, key=lambda s: s["date"])
        previous = sorted_sessions[-2]
        latest = sorted_sessions[-1]

        def aggregate(session: Dict) -> Dict:
            sets = session["exercise"].get("sets", [])
            total_sets = len(sets)
            total_reps = sum(s.get("reps", 0) for s in sets)
            total_volume = sum(s.get("reps", 0) * s.get("weight", 0.0) for s in sets)
            best_weight = max([s.get("weight", 0.0) for s in sets] or [0.0])
            avg_reps = total_reps / total_sets if total_sets else 0.0
            efforts = [s.get("effort") for s in sets if s.get("effort") is not None]
            avg_effort = sum(efforts) / len(efforts) if efforts else None
            return {
                "sets": total_sets,
                "reps": total_reps,
                "avg_reps": avg_reps,
                "volume": total_volume,
                "best_weight": best_weight,
                "avg_effort": avg_effort,
            }

        prev_stats = aggregate(previous)
        latest_stats = aggregate(latest)
        progress[ex_id] = {
            "exercise": latest["exercise"],
            "latest": {
                "date": latest["date"],
                "workout_title": latest["workout_title"],
                **latest_stats,
            },
            "previous": {
                "date": previous["date"],
                "workout_title": previous["workout_title"],
                **prev_stats,
            },
            "delta": {
                "volume": latest_stats["volume"] - prev_stats["volume"],
                "best_weight": latest_stats["best_weight"] - prev_stats["best_weight"],
                "avg_reps": latest_stats["avg_reps"] - prev_stats["avg_reps"],
                "sets": latest_stats["sets"] - prev_stats["sets"],
                "effort": None if latest_stats["avg_effort"] is None or prev_stats["avg_effort"] is None else prev_stats["avg_effort"] - latest_stats["avg_effort"],
            },
        }
    return progress

def add_workout(date, muscle_group, exercises):
    title = f"{str(date)} - {muscle_group}"
    return create_workout(date, title, [muscle_group], exercises)

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
