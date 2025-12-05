import base64
import hmac
import json
import time
import urllib.parse
import urllib.request
from hashlib import sha1
from random import SystemRandom
from typing import Dict, List, Optional, Tuple


FATSECRET_API_URL = "https://platform.fatsecret.com/rest/server.api"
_RANDOM = SystemRandom()

# FatSecret exposes a limited nutrient set per porción; we capture the most relevant.
_SERVING_NUTRIENT_UNITS: Dict[str, str] = {
    "saturated_fat": "g",
    "polyunsaturated_fat": "g",
    "monounsaturated_fat": "g",
    "trans_fat": "g",
    "cholesterol": "mg",
    "sodium": "mg",
    "potassium": "mg",
    "fiber": "g",
    "sugar": "g",
    "vitamin_a": "IU",
    "vitamin_c": "mg",
    "calcium": "mg",
    "iron": "mg",
    "vitamin_d": "IU",
    "vitamin_b12": "mcg",
    "vitamin_b6": "mg",
    "magnesium": "mg",
    "zinc": "mg",
}


class FatSecretError(Exception):
    """Raised when the FatSecret API call fails."""


def _to_float(value) -> float:
    try:
        if value in (None, "", "--"):
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _quote(value: str) -> str:
    return urllib.parse.quote(str(value), safe="~-._")


def _normalise_param_pairs(params: Dict[str, str]) -> str:
    sorted_items = sorted(
        ((str(k), str(v)) for k, v in params.items()),
        key=lambda item: (item[0], item[1]),
    )
    return "&".join(f"{_quote(k)}={_quote(v)}" for k, v in sorted_items)


def _apply_market(params: Dict[str, str], region: Optional[str], language: Optional[str]) -> Dict[str, str]:
    merged = dict(params)
    if region:
        merged["region"] = region
    if language:
        merged["language"] = language
    return merged


def _extract_serving_nutrients(raw: Dict) -> Dict[str, Tuple[float, str]]:
    nutrients: Dict[str, Tuple[float, str]] = {}
    for key, unit in _SERVING_NUTRIENT_UNITS.items():
        value = _to_float(raw.get(key))
        if value > 0:
            nutrients[key] = (value, unit)
    return nutrients


class FatSecretClient:
    def __init__(
        self,
        consumer_key: str,
        consumer_secret: str,
        *,
        default_region: Optional[str] = None,
        default_language: Optional[str] = None,
    ):
        if not consumer_key or not consumer_secret:
            raise ValueError("FatSecret consumer key and secret are required.")
        self.consumer_key = consumer_key
        self.consumer_secret = consumer_secret
        self.default_region = default_region
        self.default_language = default_language

    def search_foods(
        self,
        query: str,
        limit: int = 8,
        *,
        region: Optional[str] = None,
        language: Optional[str] = None,
    ) -> List[Dict]:
        query = (query or "").strip()
        if not query:
            return []

        limit = max(1, min(limit, 60))
        region = region or self.default_region
        language = language or self.default_language

        market = {k: v for k, v in (("region", region), ("language", language)) if v}

        collected: List[Dict] = []
        page_number = 0

        while len(collected) < limit:
            batch_limit = min(20, limit - len(collected))
            payload = _apply_market(
                {
                    "method": "foods.search",
                    "search_expression": query,
                    "max_results": str(batch_limit),
                    "page_number": str(page_number),
                    "include_sub_categories": "true",
                    "format": "json",
                },
                region,
                language,
            )

            response = self._request(payload)
            foods_payload = response.get("foods", {}).get("food")
            if not foods_payload:
                break

            foods_list = foods_payload if isinstance(foods_payload, list) else [foods_payload]
            for item in foods_list:
                food_id = item.get("food_id")
                if not food_id:
                    continue
                try:
                    detail_payload = self._fetch_food(food_id, region=region, language=language)
                except FatSecretError:
                    continue
                data = self._normalise_food(detail_payload, market=market or None)
                if data:
                    collected.append(data)
                if len(collected) >= limit:
                    break
            if len(foods_list) < batch_limit:
                break
            page_number += 1

        return collected

    def _fetch_food(
        self,
        food_id: str,
        *,
        region: Optional[str] = None,
        language: Optional[str] = None,
    ) -> Dict:
        payload = _apply_market(
            {
                "method": "food.get",
                "food_id": str(food_id),
                "format": "json",
            },
            region,
            language,
        )
        response = self._request(payload)
        food = response.get("food")
        if not food:
            raise FatSecretError("Empty food payload.")
        return food

    def _normalise_food(self, food: Dict, *, market: Optional[Dict[str, str]] = None) -> Optional[Dict]:
        servings_payload = food.get("servings", {}).get("serving")
        if not servings_payload:
            return None
        servings_raw = servings_payload if isinstance(servings_payload, list) else [servings_payload]

        servings: List[Dict] = []
        preferred_index = -1

        for idx, raw in enumerate(servings_raw):
            description = raw.get("serving_description") or raw.get("measurement_description") or ""
            macros = {
                "kcal": _to_float(raw.get("calories")),
                "p": _to_float(raw.get("protein")),
                "c": _to_float(raw.get("carbohydrate")),
                "g": _to_float(raw.get("fat") or raw.get("total_fat")),
            }

            grams = 0.0
            metric_amount = _to_float(raw.get("metric_serving_amount"))
            metric_unit = (raw.get("metric_serving_unit") or "").lower()
            serving_weight = _to_float(raw.get("serving_weight_grams"))
            if metric_unit == "g" and metric_amount > 0:
                grams = metric_amount
            elif serving_weight > 0:
                grams = serving_weight
            elif metric_unit == "ml" and metric_amount > 0:
                grams = metric_amount

            serving_id = str(raw.get("serving_id") or idx)
            nutrients = _extract_serving_nutrients(raw)

            servings.append(
                {
                    "id": serving_id,
                    "description": description or (f"por {grams:.0f} g" if grams > 0 else "porcion sugerida"),
                    "grams": grams,
                    "macros": macros,
                    "nutrients": nutrients,
                }
            )

            if preferred_index == -1:
                preferred_index = idx
            else:
                previous = servings[preferred_index]
                prev_grams = previous["grams"]
                prev_macro_sum = sum(previous["macros"].values())
                current_macro_sum = sum(macros.values())
                if prev_grams <= 0 < grams:
                    preferred_index = idx
                elif grams > 0 and current_macro_sum > prev_macro_sum:
                    preferred_index = idx

        if preferred_index == -1:
            return None

        preferred_serving = servings[preferred_index]
        if not any(preferred_serving["macros"].values()):
            return None

        grams = preferred_serving["grams"]
        portion_desc = preferred_serving["description"]
        if grams <= 0 and not portion_desc:
            portion_desc = "porcion sugerida"

        normalised = {
            "id": f"fatsecret-{food.get('food_id')}",
            "name": food.get("food_name") or "Alimento FatSecret",
            "brand": food.get("brand_name"),
            "description": food.get("food_description"),
            "food_type": food.get("food_type"),
            "url": food.get("food_url"),
            "source": "fatsecret",
            "portion": {
                "grams": grams if grams > 0 else 100.0,
                "description": portion_desc,
            },
            "macros": {
                "kcal": preferred_serving["macros"]["kcal"],
                "p": preferred_serving["macros"]["p"],
                "c": preferred_serving["macros"]["c"],
                "g": preferred_serving["macros"]["g"],
            },
            "servings": servings,
        }

        if market:
            normalised["market"] = market

        return normalised

    def _request(self, params: Dict[str, str]) -> Dict:
        oauth_params = self._build_oauth_params()
        all_params = {**params, **oauth_params}
        signature = self._sign(all_params)
        signed_params = {**all_params, "oauth_signature": signature}

        query_string = _normalise_param_pairs(signed_params)
        url = f"{FATSECRET_API_URL}?{query_string}"

        try:
            with urllib.request.urlopen(url, timeout=6) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            raise FatSecretError(str(exc)) from exc

        if "error" in payload:
            raise FatSecretError(payload["error"].get("message", "Unknown FatSecret error"))
        return payload

    def _build_oauth_params(self) -> Dict[str, str]:
        return {
            "oauth_consumer_key": self.consumer_key,
            "oauth_nonce": f"{_RANDOM.getrandbits(64):x}",
            "oauth_signature_method": "HMAC-SHA1",
            "oauth_timestamp": str(int(time.time())),
            "oauth_version": "1.0",
        }

    def _sign(self, params: Dict[str, str]) -> str:
        base_param_string = _normalise_param_pairs(params)
        base_elems = ["GET", _quote(FATSECRET_API_URL), _quote(base_param_string)]
        base_string = "&".join(base_elems)

        signing_key = f"{_quote(self.consumer_secret)}&"
        digest = hmac.new(signing_key.encode("utf-8"), base_string.encode("utf-8"), sha1).digest()
        return base64.b64encode(digest).decode("utf-8")
