import datetime as dt
import flet as ft

from data.storage import get_user
from services.reports import weekly_macros_summary


PRIMARY_COLOR = "#007AFF"
SECONDARY_COLOR = "#5AC8FA"
PROTEIN_COLOR = "#34C759"
CARB_COLOR = SECONDARY_COLOR
FAT_COLOR = "#FF9F0A"
TEXT_PRIMARY = "#FFFFFF"
TEXT_MUTED = "#8E8E93"
CARD_BG = "#1C1C1E"
CARD_BORDER = "#2C2C2E"


def _format_day_label(date_str: str) -> str:
    return dt.datetime.fromisoformat(date_str).strftime("%a").upper()


def _build_macro_chart(week_summary: list[dict]) -> ft.Control:
    macro_values = []
    for day in week_summary:
        macro_values.extend([day["p"], day["c"], day["g"]])
    max_macro = max(macro_values or [1]) or 1
    target_height = 140
    scale = target_height / max_macro

    bars = []
    bar_width = 18
    for day in week_summary:
        proteins = max(int(day["p"] * scale), 4)
        carbs = max(int(day["c"] * scale), 4)
        fats = max(int(day["g"] * scale), 4)

        bar_stack = ft.Column(
            controls=[
                ft.Container(height=fats, width=bar_width, bgcolor=FAT_COLOR, border_radius=6),
                ft.Container(height=carbs, width=bar_width, bgcolor=CARB_COLOR, border_radius=6),
                ft.Container(height=proteins, width=bar_width, bgcolor=PROTEIN_COLOR, border_radius=6),
            ],
            spacing=6,
            horizontal_alignment=ft.CrossAxisAlignment.CENTER,
        )

        bars.append(
            ft.Column(
                controls=[
                    bar_stack,
                    ft.Text(_format_day_label(day["date"]), size=12, color=TEXT_MUTED),
                ],
                spacing=8,
                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
            )
        )

    legend = ft.Row(
        controls=[
            ft.Row(
                [
                    ft.Container(width=10, height=10, bgcolor=PROTEIN_COLOR, border_radius=5),
                    ft.Text("Proteinas", size=11, color=TEXT_MUTED),
                ],
                spacing=6,
            ),
            ft.Row(
                [
                    ft.Container(width=10, height=10, bgcolor=CARB_COLOR, border_radius=5),
                    ft.Text("Carbohidratos", size=11, color=TEXT_MUTED),
                ],
                spacing=6,
            ),
            ft.Row(
                [
                    ft.Container(width=10, height=10, bgcolor=FAT_COLOR, border_radius=5),
                    ft.Text("Grasas", size=11, color=TEXT_MUTED),
                ],
                spacing=6,
            ),
        ],
        spacing=20,
        wrap=True,
        alignment=ft.MainAxisAlignment.START,
    )

    chart = ft.Column(
        controls=[
            ft.Row(
                controls=bars,
                alignment=ft.MainAxisAlignment.SPACE_EVENLY,
                vertical_alignment=ft.CrossAxisAlignment.END,
            ),
            legend,
        ],
        spacing=16,
    )
    return chart


def HomeView(go_to):
    user = get_user()
    greeting = ft.Text(
        f"HOLA, {user['name'].upper()}",
        size=18,
        weight=ft.FontWeight.W_600,
        color=TEXT_PRIMARY,
    )

    week = weekly_macros_summary(dt.date.today(), 7)
    chart = _build_macro_chart(week)

    cards = ft.Column(
        controls=[
            ft.Container(
                content=ft.Column(
                    controls=[
                        ft.Text(
                            "TUS MACRONUTRIENTES",
                            size=16,
                            weight=ft.FontWeight.BOLD,
                            color=TEXT_PRIMARY,
                        ),
                        ft.Text(
                            "Vista semanal - ultimos 7 dias",
                            size=12,
                            color=TEXT_MUTED,
                        ),
                        chart,
                    ],
                    spacing=16,
                ),
                padding=20,
                bgcolor=CARD_BG,
                border_radius=18,
                border=ft.border.all(1, CARD_BORDER),
            ),
            ft.Container(
                content=ft.Column(
                    controls=[
                        ft.Text("Ejercicio de hoy", size=16, weight=ft.FontWeight.BOLD, color=TEXT_PRIMARY),
                        ft.Text("PECHO Y BICEPS (ejemplo)", size=14, color=TEXT_MUTED),
                    ],
                    spacing=6,
                ),
                padding=18,
                bgcolor=CARD_BG,
                border_radius=18,
                border=ft.border.all(1, CARD_BORDER),
            ),
            ft.Row(
                controls=[
                    ft.Container(
                        expand=1,
                        padding=18,
                        border_radius=18,
                        bgcolor=CARD_BG,
                        border=ft.border.all(1, CARD_BORDER),
                        content=ft.Column(
                            controls=[
                                ft.Text("Tus Macronutrientes", color=TEXT_PRIMARY, weight=ft.FontWeight.W_600),
                                ft.Text("HOY", color=TEXT_MUTED),
                            ],
                            spacing=4,
                        ),
                        on_click=lambda e: go_to("macros"),
                    ),
                    ft.Container(
                        expand=1,
                        padding=18,
                        border_radius=18,
                        bgcolor=CARD_BG,
                        border=ft.border.all(1, CARD_BORDER),
                        content=ft.Column(
                            controls=[
                                ft.Text("Tus Micronutrientes", color=TEXT_PRIMARY, weight=ft.FontWeight.W_600),
                                ft.Text("HOY", color=TEXT_MUTED),
                            ],
                            spacing=4,
                        ),
                        on_click=lambda e: go_to("micros"),
                    ),
                ],
                spacing=12,
            ),
        ],
        spacing=16,
    )

    return ft.ListView(
        controls=[greeting, cards],
        expand=True,
        spacing=20,
        padding=ft.padding.only(left=16, right=16, top=0, bottom=24),
    )
