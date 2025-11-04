import base64
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Dict, List, Optional, Tuple, Union


TOKEN_URL = "https://oauth.fatsecret.com/connect/token"
API_URL = "https://platform.fatsecret.com/rest/server.api"
DEFAULT_SCOPE = "premier"
DEFAULT_METHOD = "platform.availableLocales.get"


class PlatformLocationError(Exception):
    """Raised when the Platform localization lookup fails."""


class PlatformLocationConfigError(PlatformLocationError):
    """Raised when the Platform client is not properly configured."""


class FatSecretPlatformClient:
    def __init__(
        self,
        client_id: str,
        client_secret: str,
        *,
        scope: Optional[str] = None,
        timeout: float = 6.0,
        method: Optional[str] = None,
    ):
        if not client_id or not client_secret:
            raise PlatformLocationConfigError("Client ID and secret are required for Platform API access.")
        self.client_id = client_id
        self.client_secret = client_secret
        self.scope = scope or DEFAULT_SCOPE
        self.timeout = timeout
        self.method = method or DEFAULT_METHOD

        self._access_token: Optional[str] = None
        self._token_expiry: float = 0.0

    def list_locales(
        self,
        *,
        include_measurement_system: bool = False,
        region: Optional[str] = None,
        language: Optional[str] = None,
    ) -> List[Dict]:
        """
        Returns a list of locales supported by the FatSecret Platform.
        The structure mirrors the API response; this method normalises common variants into a list of dicts.
        """
        params = {
            "method": self.method,
            "format": "json",
        }
        if region:
            params["region"] = region
        if language:
            params["language"] = language
        if include_measurement_system:
            params["include_measurement_system"] = "true"

        payload = self._request(params)
        return _normalise_locales_payload(payload)

    def _request(self, params: Dict[str, str]) -> Dict:
        token = self._ensure_token()
        query_string = urllib.parse.urlencode(params)
        url = f"{API_URL}?{query_string}"

        req = urllib.request.Request(url)
        req.add_header("Authorization", f"Bearer {token}")
        req.add_header("Accept", "application/json")

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                data = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            message = exc.read().decode("utf-8", errors="ignore")
            raise PlatformLocationError(f"HTTP {exc.code}: {message}") from exc
        except Exception as exc:
            raise PlatformLocationError(str(exc)) from exc

        try:
            payload = json.loads(data)
        except json.JSONDecodeError as exc:
            raise PlatformLocationError("Invalid JSON payload from Platform API.") from exc

        if isinstance(payload, dict) and "error" in payload:
            error = payload["error"]
            if isinstance(error, dict):
                message = error.get("message") or error.get("code") or "Unknown error"
            else:
                message = str(error)
            raise PlatformLocationError(message)
        return payload

    def _ensure_token(self) -> str:
        margin = 60.0
        if self._access_token and (time.time() + margin) < self._token_expiry:
            return self._access_token
        return self._fetch_token()

    def _fetch_token(self) -> str:
        credentials = f"{self.client_id}:{self.client_secret}"
        encoded_credentials = base64.b64encode(credentials.encode("utf-8")).decode("ascii")

        body = {
            "grant_type": "client_credentials",
        }
        if self.scope:
            body["scope"] = self.scope

        data = urllib.parse.urlencode(body).encode("utf-8")

        req = urllib.request.Request(TOKEN_URL, data=data, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        req.add_header("Authorization", f"Basic {encoded_credentials}")

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            message = exc.read().decode("utf-8", errors="ignore")
            raise PlatformLocationError(f"Auth HTTP {exc.code}: {message}") from exc
        except Exception as exc:
            raise PlatformLocationError(str(exc)) from exc

        token = payload.get("access_token")
        expires_in = float(payload.get("expires_in", 3600))
        if not token:
            raise PlatformLocationError("Auth response missing access_token.")

        self._access_token = token
        self._token_expiry = time.time() + max(expires_in, 60.0)
        return token


def _normalise_locales_payload(payload: Union[Dict, List]) -> List[Dict]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]

    if not isinstance(payload, dict):
        return []

    candidates: List[Dict] = []
    possible_keys = [
        "available_locales",
        "locales",
        "countries",
        "markets",
        "data",
    ]

    for key in possible_keys:
        section = payload.get(key)
        if isinstance(section, list):
            candidates.extend(item for item in section if isinstance(item, dict))
        elif isinstance(section, dict):
            inner = section.get("locale") or section.get("market") or section.get("country")
            if isinstance(inner, list):
                candidates.extend(item for item in inner if isinstance(item, dict))
            elif isinstance(inner, dict):
                candidates.append(inner)

    if not candidates and all(not isinstance(payload.get(k), (dict, list)) for k in possible_keys):
        candidates.append(payload)

    return candidates


_cached_client: Optional[FatSecretPlatformClient] = None
_cached_client_config: Optional[Tuple[str, str, Optional[str], Optional[str]]] = None
_cached_locales: Tuple[List[Dict], float] = ([], 0.0)
_LOCALES_TTL = 6 * 60 * 60  # 6 hours


def _get_client() -> FatSecretPlatformClient:
    global _cached_client, _cached_client_config

    client_id = os.getenv("FATSECRET_PLATFORM_CLIENT_ID") or os.getenv("FATSECRET_CONSUMER_KEY")
    client_secret = os.getenv("FATSECRET_PLATFORM_CLIENT_SECRET") or os.getenv("FATSECRET_CONSUMER_SECRET")
    scope = os.getenv("FATSECRET_PLATFORM_SCOPE") or DEFAULT_SCOPE
    method = os.getenv("FATSECRET_PLATFORM_LOCALES_METHOD") or DEFAULT_METHOD

    if not client_id or not client_secret:
        raise PlatformLocationConfigError(
            "Set FATSECRET_PLATFORM_CLIENT_ID and FATSECRET_PLATFORM_CLIENT_SECRET environment variables."
        )

    config: Tuple[str, str, Optional[str], Optional[str]] = (client_id, client_secret, scope, method)

    if _cached_client is None or _cached_client_config != config:
        _cached_client = FatSecretPlatformClient(
            client_id,
            client_secret,
            scope=scope,
            method=method,
        )
        _cached_client_config = config

    return _cached_client


def get_platform_locales(force_refresh: bool = False) -> List[Dict]:
    global _cached_locales

    now = time.time()
    locales, cached_at = _cached_locales
    if locales and not force_refresh and (now - cached_at) < _LOCALES_TTL:
        return locales

    client = _get_client()
    locales = client.list_locales()

    _cached_locales = (locales, now)
    return locales


def get_platform_locale_summary(limit: int = 6, force_refresh: bool = False) -> List[str]:
    locales = get_platform_locales(force_refresh=force_refresh)
    summary: List[str] = []

    for locale in locales:
        market = locale.get("market_code") or locale.get("market") or locale.get("code")
        country = locale.get("country_name") or locale.get("country") or locale.get("description")
        language = _first_supported_language(locale)
        measurement = locale.get("default_measurement_system") or locale.get("unit_system")

        parts = []
        if country:
            parts.append(str(country))
        if market:
            parts.append(f"({market})")
        if language:
            parts.append(language)
        if measurement:
            parts.append(f"Medida: {measurement}")

        if parts:
            summary.append(" · ".join(parts))
        else:
            summary.append(json.dumps(locale))

        if len(summary) >= limit:
            break

    return summary


def _first_supported_language(locale: Dict) -> Optional[str]:
    languages = locale.get("supported_languages") or locale.get("languages")
    if isinstance(languages, dict):
        lang_entries = languages.get("language") or languages.get("items")
    else:
        lang_entries = languages

    if isinstance(lang_entries, dict):
        lang_entries = [lang_entries]

    if isinstance(lang_entries, list):
        for entry in lang_entries:
            if not isinstance(entry, dict):
                continue
            name = entry.get("language_name") or entry.get("name")
            code = entry.get("language_code") or entry.get("code")
            if name and code:
                return f"{name} [{code}]"
            if name:
                return str(name)
            if code:
                return str(code)
    return None
