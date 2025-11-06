import datetime as dt
from typing import Dict, List

import flet as ft

from data.storage import get_exercise_progress
from services.exercises import get_exercise_info


_raw_colors = getattr(ft, "colors", None) or getattr(ft, "Colors", None)


class _ColorsCompat:
    def __init__(self, raw):
        if raw is None:
            raise AttributeError("Flet colors API is not available")
        self._raw = raw

    def __getattr__(self, name: str):
        attr = getattr(self._raw, name)
        return getattr(attr, "value", attr)


COLORS = _ColorsCompat(_raw_colors)


def _format_delta(value: float, unit: str = "", invert: bool = False) -> tuple[str, str]:
    if value is None:
        return "-", COLORS.GREY
    delta = -value if invert else value
    if abs(delta) < 1e-6:
        return f"= {0:.1f}{unit}", COLORS.GREY
    color = COLORS.GREEN if delta > 0 else COLORS.RED
    sign = "+" if delta > 0 else "-"
    return f"{sign} {abs(delta):.1f}{unit}", color


def ProgressView() -> ft.Control:
    today = dt.date.today()
    progress = get_exercise_progress(today, days=28)
    cards: List[ft.Control] = []

    if not progress:
        return ft.Column(
            controls=[
                ft.Text("Progreso de tus ejercicios", size=18, weight=ft.FontWeight.W_600, color=COLORS.WHITE),
                ft.Container(
                    padding=20,
                    border_radius=16,
                    bgcolor="#1E1E20",
                    border=ft.border.all(1, "#2C2C2E"),
                    content=ft.Column(
                        [
                            ft.Text("Aun no hay suficiente informacion para mostrar mejoras.", size=13, color=COLORS.GREY),
                            ft.Text(
                                "Registra al menos dos sesiones por ejercicio para ver comparaciones semanales.",
                                size=12,
                                color=COLORS.GREY,
                            ),
                        ],
                        spacing=8,
                    ),
                ),
            ],
            spacing=16,
            expand=True,
        )

    for ex_id, payload in progress.items():
        exercise = payload["exercise"]
        latest = payload["latest"]
        previous = payload["previous"]
        delta = payload["delta"]

        info = get_exercise_info(ex_id) or {}
        name = exercise.get("name") or info.get("name") or "Ejercicio"
        image = exercise.get("image") or info.get("image")

        volume_delta, volume_color = _format_delta(delta["volume"], " kg")
        weight_delta, weight_color = _format_delta(delta["best_weight"], " kg")
        reps_delta, reps_color = _format_delta(delta["avg_reps"], " reps")
        sets_delta, sets_color = _format_delta(delta["sets"], " sets")

        effort_delta, effort_color = "-", COLORS.GREY
        if delta.get("effort") is not None:
            effort_delta, effort_color = _format_delta(delta["effort"], "", invert=True)

        latest_date = latest["date"].strftime("%d/%m/%Y")
        previous_date = previous["date"].strftime("%d/%m/%Y")

        cards.append(
            ft.Container(
                padding=16,
                border_radius=16,
                bgcolor="#1E1E20",
                border=ft.border.all(1, "#2C2C2E"),
                content=ft.Column(
                    [
                        ft.Row(
                            [
                                ft.Row(
                                    [
                                        ft.Image(src=image, width=80, height=80, fit=ft.ImageFit.COVER, border_radius=12)
                                        if image
                                        else ft.Icon(ft.Icons.FITNESS_CENTER, size=42, color=COLORS.PRIMARY),
                                        ft.Column(
                                            [
                                                ft.Text(name, size=14, weight=ft.FontWeight.W_600, color=COLORS.WHITE),
                                                ft.Text(
                                                    f"Ultima sesion {latest_date} - {latest.get('workout_title', '')}",
                                                    size=11,
                                                    color=COLORS.GREY,
                                                ),
                                                ft.Text(
                                                    f"Anterior {previous_date}",
                                                    size=11,
                                                    color=COLORS.GREY,
                                                ),
                                            ],
                                            spacing=4,
                                        ),
                                    ],
                                    spacing=12,
                                ),
                            ],
                            alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                        ),
                        ft.Divider(color="#30384C"),
                        ft.Row(
                            [
                                ft.Column(
                                    [
                                        ft.Text("Volumen", size=11, color=COLORS.GREY),
                                        ft.Text(
                                            f"{latest['volume']:.1f} kg totales",
                                            size=12,
                                            color=COLORS.WHITE,
                                        ),
                                        ft.Text(volume_delta, size=11, color=volume_color),
                                    ],
                                    spacing=2,
                                ),
                                ft.Column(
                                    [
                                        ft.Text("Mejor peso", size=11, color=COLORS.GREY),
                                        ft.Text(f"{latest['best_weight']:.1f} kg", size=12, color=COLORS.WHITE),
                                        ft.Text(weight_delta, size=11, color=weight_color),
                                    ],
                                    spacing=2,
                                ),
                                ft.Column(
                                    [
                                        ft.Text("Repeticiones promedio", size=11, color=COLORS.GREY),
                                        ft.Text(f"{latest['avg_reps']:.1f}", size=12, color=COLORS.WHITE),
                                        ft.Text(reps_delta, size=11, color=reps_color),
                                    ],
                                    spacing=2,
                                ),
                                ft.Column(
                                    [
                                        ft.Text("Series", size=11, color=COLORS.GREY),
                                        ft.Text(str(latest["sets"]), size=12, color=COLORS.WHITE),
                                        ft.Text(sets_delta, size=11, color=sets_color),
                                    ],
                                    spacing=2,
                                ),
                                ft.Column(
                                    [
                                        ft.Text("Esfuerzo", size=11, color=COLORS.GREY),
                                        ft.Text(
                                            "-" if latest["avg_effort"] is None else f"{latest['avg_effort']:.1f}",
                                            size=12,
                                            color=COLORS.WHITE,
                                        ),
                                        ft.Text(
                                            effort_delta if latest["avg_effort"] is not None else "-",
                                            size=11,
                                            color=effort_color,
                                        ),
                                    ],
                                    spacing=2,
                                ),
                            ],
                            spacing=20,
                            wrap=True,
                        ),
                    ],
                    spacing=12,
                ),
            )
        )

    return ft.Column(
        controls=[
            ft.Text("Progreso de tus ejercicios", size=18, weight=ft.FontWeight.W_600, color=COLORS.WHITE),
            ft.Text(
                "Comparacion de las dos sesiones mas recientes dentro de las ultimas cuatro semanas.",
                size=12,
                color=COLORS.GREY,
            ),
            ft.Column(cards, spacing=12),
        ],
        spacing=16,
        expand=True,
        scroll=ft.ScrollMode.AUTO,
    )
