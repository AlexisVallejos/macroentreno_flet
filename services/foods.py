import json
import os
import ssl
import urllib.parse
import urllib.request
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from services.fatsecret import FatSecretClient, FatSecretError


LOCAL_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "foods.json"
USDA_API_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"

NUTRIENT_MAP = {
    "Protein": "p",
    "Carbohydrate, by difference": "c",
    "Total lipid (fat)": "g",
    "Energy": "kcal",
}


class FoodLookupError(Exception):
    """Raised when the external lookup fails."""


@lru_cache
def _load_local_foods() -> List[Dict]:
    if not LOCAL_DB_PATH.exists():
        return []
    with LOCAL_DB_PATH.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    return data


def search_foods(query: str, limit: int = 8) -> List[Dict]:
    """
    Returns a list of food dictionaries ready to be scaled for macros.
    The function tries the USDA FoodData Central API when an API key is present,
    and falls back to the bundled local catalogue.
    """
    query = (query or "").strip()

    foods: List[Dict] = []

    client = _get_fatsecret_client()
    if client and query:
        try:
            foods = client.search_foods(query, limit)
        except FatSecretError:
            foods = []

    api_key = os.getenv("FOODDATA_API_KEY")
    if not foods and api_key and query:
        try:
            foods = _search_usda(query, api_key, limit)
        except FoodLookupError:
            foods = []

    if not foods:
        foods = _search_local(query, limit)

    return foods


def scale_macros(food: Dict, grams: float) -> Dict[str, float]:
    """
    Scale the macros of the provided food dictionary to the desired grams.
    """
    portion = food.get("portion", {}) or {}
    base_grams = float(portion.get("grams") or 100)
    if base_grams <= 0:
        base_grams = 100.0

    ratio = float(grams) / base_grams
    ratio = max(ratio, 0.0)

    macros = {}
    for key in ("kcal", "p", "c", "g"):
        value = float(food.get("macros", {}).get(key, 0.0))
        macros[key] = round(value * ratio, 1) if key != "kcal" else round(value * ratio, 0)
    return macros


def describe_portion(food: Dict) -> str:
    portion = food.get("portion") or {}
    desc = portion.get("description")
    grams = portion.get("grams")
    if desc:
        return desc
    if grams:
        return f"por {grams} g"
    return "porcion estandar"


def _search_local(query: str, limit: int) -> List[Dict]:
    items = _load_local_foods()
    if not items:
        return []

    query_l = query.lower()

    def score(item: Dict) -> float:
        name = item.get("name", "").lower()
        if not query_l:
            return 1.0
        if query_l in name:
            return 0.9 + len(query_l) / max(len(name), 1)
        # simple bag-of-words overlap
        name_words = name.split()
        matches = sum(1 for w in name_words if w.startswith(query_l))
        return matches / len(name_words) if name_words else 0.0

    ranked = sorted(items, key=score, reverse=True)
    if query_l:
        ranked = [item for item in ranked if score(item) > 0]
    return [_normalise_food(item, source="local") for item in ranked[:limit]]


def _search_usda(query: str, api_key: str, limit: int) -> List[Dict]:
    params = {
        "api_key": api_key,
        "query": query,
        "pageSize": str(limit),
        "requireAllWords": "false",
        "dataType": "SR Legacy,Survey (FNDDS),Branded",
    }
    url = f"{USDA_API_URL}?{urllib.parse.urlencode(params)}"

    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    ctx = ssl.create_default_context()

    try:
        with urllib.request.urlopen(req, timeout=6, context=ctx) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        raise FoodLookupError(str(exc)) from exc

    foods = []
    for item in data.get("foods", []):
        macros = _extract_usda_macros(item.get("foodNutrients", []))
        if not macros:
            continue
        foods.append(
            _normalise_food(
                {
                    "id": f"usda-{item.get('fdcId')}",
                    "name": item.get("description", "Alimento USDA").title(),
                    "portion": {"grams": 100, "description": "por 100 g"},
                    "macros": macros,
                },
                source="usda",
            )
        )

    return foods[:limit]


def _extract_usda_macros(nutrients: List[Dict]) -> Optional[Dict[str, float]]:
    if not nutrients:
        return None

    macros: Dict[str, float] = {"kcal": 0.0, "p": 0.0, "c": 0.0, "g": 0.0}
    for nutrient in nutrients:
        name = nutrient.get("nutrientName")
        unit = nutrient.get("unitName")
        if name not in NUTRIENT_MAP:
            continue
        key = NUTRIENT_MAP[name]
        value = nutrient.get("value")
        if value is None:
            continue
        if key == "kcal" and unit != "kcal":
            continue
        macros[key] = float(value)

    if macros["kcal"] == 0.0 and any(macros[k] for k in ("p", "c", "g")):
        macros["kcal"] = round(
            macros["p"] * 4 + macros["c"] * 4 + macros["g"] * 9, 0
        )

    if not any(macros.values()):
        return None
    return macros


def _normalise_food(item: Dict, source: str) -> Dict:
    portion = item.get("portion", {}) or {}
    grams = portion.get("grams") or 100
    macros = item.get("macros", {}) or {}

    normalised = {
        "id": item.get("id") or f"{source}-item",
        "name": item.get("name") or "Alimento",
        "source": source,
        "portion": {
            "grams": float(grams),
            "description": portion.get("description") or f"por {grams} g",
        },
        "macros": {
            "kcal": float(macros.get("kcal", 0.0)),
            "p": float(macros.get("p", 0.0)),
            "c": float(macros.get("c", 0.0)),
            "g": float(macros.get("g", 0.0)),
        },
    }
    return normalised


_cached_client: Optional[FatSecretClient] = None
_cached_client_config: Optional[Tuple[str, str, Optional[str], Optional[str]]] = None


def _get_fatsecret_client() -> Optional[FatSecretClient]:
    global _cached_client, _cached_client_config

    key = os.getenv("FATSECRET_CONSUMER_KEY")
    secret = os.getenv("FATSECRET_CONSUMER_SECRET")
    if not key or not secret:
        _cached_client = None
        _cached_client_config = None
        return None

    region = os.getenv("FATSECRET_REGION") or "AR"
    language = os.getenv("FATSECRET_LANGUAGE") or "es"
    config: Tuple[str, str, Optional[str], Optional[str]] = (key, secret, region, language)

    if _cached_client is None or _cached_client_config != config:
        try:
            _cached_client = FatSecretClient(
                key,
                secret,
                default_region=region,
                default_language=language,
            )
            _cached_client_config = config
        except ValueError:
            _cached_client = None
            _cached_client_config = None

    return _cached_client


def format_macros(macros: Dict[str, float]) -> str:
    kcal = macros.get("kcal", 0)
    return f"{kcal:.0f} kcal  P {macros.get('p', 0):.1f}g  C {macros.get('c', 0):.1f}g  G {macros.get('g', 0):.1f}g"
