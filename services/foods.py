import json
import os
import ssl
import urllib.parse
import urllib.request
from functools import lru_cache
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

from data.argentina_meta import ARGENTINA_PRODUCTS_META
from data.argentina_micros import ARGENTINA_CATEGORY_MICROS, ARGENTINA_MICRO_OVERRIDES
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


def search_local_foods(query: str, limit: int = 12, *, tags: Optional[Iterable[str]] = None) -> List[Dict]:
    """
    Returns items from the bundled local catalogue.
    """
    return _search_local(query, limit, tags=tags)


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


def _search_local(query: str, limit: int, tags: Optional[Iterable[str]] = None) -> List[Dict]:
    items = _load_local_foods()
    if not items:
        return []

    query_l = (query or "").lower()
    tag_filter = {str(tag).lower() for tag in tags} if tags else None

    def score(item: Dict) -> float:
        name = item.get("name", "").lower()
        if not query_l:
            return 1.0
        if query_l in name:
            return 0.9 + len(query_l) / max(len(name), 1)
        name_words = name.split()
        matches = sum(1 for w in name_words if w.startswith(query_l))
        return matches / len(name_words) if name_words else 0.0

    def matches_tags(item_id: Optional[str]) -> bool:
        if not tag_filter:
            return True
        meta = ARGENTINA_PRODUCTS_META.get(item_id or "")
        meta_tags = set(tag.lower() for tag in (meta.get("tags") if meta else []) or [])
        return bool(meta_tags & tag_filter)

    scored: List[Tuple[float, Dict]] = []
    for item in items:
        if not matches_tags(item.get("id")):
            continue
        sc = score(item)
        if query_l and sc <= 0:
            continue
        scored.append((sc, item))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    ranked_items = [item for _, item in scored]
    return [_normalise_food(item, source="local") for item in ranked_items[:limit]]


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


def _scale_micro_payload(payload: Dict[str, Tuple[float, str]], grams: float) -> Dict[str, Tuple[float, str]]:
    if not payload:
        return {}
    base = 100.0
    ratio = grams / base if base > 0 else 1.0
    scaled: Dict[str, Tuple[float, str]] = {}
    for nutrient, (value, unit) in payload.items():
        try:
            amount = float(value) * ratio
        except (TypeError, ValueError):
            continue
        scaled[nutrient] = (amount, unit)
    return scaled


def _lookup_local_nutrients(item_id: str, category: Optional[str], grams: float) -> Optional[Dict[str, Tuple[float, str]]]:
    payload = ARGENTINA_MICRO_OVERRIDES.get(item_id)
    if not payload and category:
        payload = ARGENTINA_CATEGORY_MICROS.get(category)
    if not payload:
        return None
    return _scale_micro_payload(payload, grams or 100.0)


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
    brand = item.get("brand")
    if brand:
        normalised["brand"] = str(brand)
    item_tags = item.get("tags")
    if isinstance(item_tags, (list, tuple)):
        normalised["tags"] = [str(tag) for tag in item_tags]
    category = item.get("category")
    if category:
        normalised["category"] = str(category)

    meta = None
    if source == "local":
        meta = ARGENTINA_PRODUCTS_META.get(normalised["id"])
        if meta:
            meta_brand = meta.get("brand")
            if meta_brand and not normalised.get("brand"):
                normalised["brand"] = meta_brand
            meta_category = meta.get("category")
            if meta_category and not normalised.get("category"):
                normalised["category"] = meta_category
            meta_tags = meta.get("tags") or []
            existing = list(normalised.get("tags", []))
            merged = existing + [tag for tag in meta_tags if tag not in existing]
            if merged:
                normalised["tags"] = merged
        if not item.get("servings"):
            nutrients = item.get("nutrients")
            if nutrients:
                nutrient_payload = {k: (float(val[0]), val[1]) for k, val in nutrients.items()}
            else:
                category = meta.get("category") if meta else normalised.get("category")
                nutrient_payload = _lookup_local_nutrients(normalised["id"], category, normalised["portion"]["grams"])
            if nutrient_payload:
                normalised["servings"] = [
                    {
                        "id": "local-default",
                        "description": normalised["portion"]["description"],
                        "grams": normalised["portion"]["grams"],
                        "macros": dict(normalised["macros"]),
                        "nutrients": nutrient_payload,
                    }
                ]
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
