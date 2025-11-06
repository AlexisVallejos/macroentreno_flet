import datetime as dt
from typing import Callable
import flet as ft

from data.storage import get_user
from services.reports import weekly_macros_summary


PRIMARY_COLOR = "#76EE46"
TEXT_MUTED = "#E5E5EA"
TEXT_DARK = "#000000"
TEXT_MUTED_DARK = "#6E6E73"
CARD_BORDER = "rgba(255, 255, 255, 0.10)"
CARD_TEXT_COLOR = "#FFFFFF"
PROTEIN_COLOR = "#56CCF2"
CARB_COLOR = "#F2C94D"
FAT_COLOR = "#F39A4A"

CARD_OVERLAY_COLOR = "rgba(0, 0, 0, 0.45)"


def _elevated_image_card(
    *,
    title: str,
    subtitle: str,
    cta: str | None,
    image_url: str,
    height: int,
    on_tap: Callable[[ft.ControlEvent], None] | None = None,
    content_alignment: ft.Alignment = ft.alignment.center,
    text_align: ft.TextAlign = ft.TextAlign.CENTER,
) -> ft.Control:
    # Background image card with translucent black overlay behind the text
    return ft.Container(
        height=height,
        border_radius=24,
        clip_behavior=ft.ClipBehavior.HARD_EDGE,
        border=ft.border.all(1, CARD_BORDER),
        image=ft.DecorationImage(src=image_url, fit=ft.ImageFit.COVER),
        content=ft.Stack(
            expand=True,
            controls=[
                ft.Container(expand=True, bgcolor=CARD_OVERLAY_COLOR),
                ft.Container(
                    padding=ft.padding.symmetric(horizontal=28, vertical=24),
                    alignment=content_alignment,
                    content=_card_content(title, subtitle, cta, text_align),
                ),
            ]
        ),
        on_click=on_tap,
    )


def _format_day_label(date_str: str) -> str:
    return dt.datetime.fromisoformat(date_str).strftime("%a").upper()


def _card_content(title: str, subtitle: str, cta: str | None, text_align: ft.TextAlign) -> ft.Control:
    controls: list[ft.Control] = [
        ft.Text(title, size=18, weight=ft.FontWeight.W_600, color=CARD_TEXT_COLOR, text_align=text_align),
        ft.Text(subtitle, size=13, color=CARD_TEXT_COLOR, text_align=text_align),
        ft.Container(height=12),
    ]
    if cta:
        controls.append(
            ft.Row(
                controls=[
                    ft.Text(cta, size=12, color=CARD_TEXT_COLOR),
                    ft.Icon(ft.Icons.CHEVRON_RIGHT, size=16, color=CARD_TEXT_COLOR),
                ],
                spacing=4,
                alignment=ft.MainAxisAlignment.CENTER,
            )
        )

    return ft.Column(
        controls=controls,
        spacing=6,
        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
        alignment=ft.MainAxisAlignment.CENTER,
    )


def _build_macro_chart(week_summary: list[dict], label_color: str) -> ft.Control:
    macro_values = []
    for day in week_summary:
        macro_values.extend([day["p"], day["c"], day["g"]])
    max_macro = max(macro_values or [1])
    target_height = 180
    scale = target_height / max_macro if max_macro else 1

    bars: list[ft.Control] = []
    bar_width = 35
    for day in week_summary:
        proteins = max(int(day["p"] * scale), 0)
        carbs = max(int(day["c"] * scale), 0)
        fats = max(int(day["g"] * scale), 0)

        bar_stack = ft.Column(
            controls=[
                ft.Container(height=fats, width=bar_width, bgcolor=FAT_COLOR),
                ft.Container(height=carbs, width=bar_width, bgcolor=CARB_COLOR),
                ft.Container(height=proteins, width=bar_width, bgcolor=PROTEIN_COLOR),
            ],
            spacing=0,
            horizontal_alignment=ft.CrossAxisAlignment.CENTER,
        )

        bars.append(
            ft.Column(
                controls=[
                    bar_stack,
                    ft.Text(_format_day_label(day["date"]), size=11, color=label_color),
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
                    ft.Text("Proteinas", size=11, color=label_color),
                ],
                spacing=6,
            ),
            ft.Row(
                [
                    ft.Container(width=10, height=10, bgcolor=CARB_COLOR, border_radius=5),
                    ft.Text("Carbohidratos", size=11, color=label_color),
                ],
                spacing=6,
            ),
            ft.Row(
                [
                    ft.Container(width=10, height=10, bgcolor=FAT_COLOR, border_radius=5),
                    ft.Text("Grasas", size=11, color=label_color),
                ],
                spacing=6,
            ),
        ],
        spacing=18,
        wrap=True,
    )

    return ft.Column(
        controls=[
            ft.Row(
                controls=bars,
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                vertical_alignment=ft.CrossAxisAlignment.END,
            ),
            legend,
        ],
        spacing=20,
    )


def HomeView(go_to):
    user = get_user()
    today = dt.date.today()
    week = weekly_macros_summary(today, 7)
    today_summary = next((day for day in week if day["date"] == today.isoformat()), None)

    macros_today = (
        f"{int(today_summary['p'])}P / {int(today_summary['c'])}C / {int(today_summary['g'])}G"
        if today_summary
        else "Registra tus comidas"
    )

    greeting = ft.Column(
        controls=[
            ft.Text(
                f"Hola, {user['name'].title()}",
                size=18,
                weight=ft.FontWeight.W_600,
                color=PRIMARY_COLOR,
            ),
            ft.Text("Personalicemos tu macroentreno de hoy", size=12, color=TEXT_MUTED),
        ],
        spacing=6,
    )

    hero_card = _elevated_image_card(
        title="Mis ejercicios",
        subtitle="Rutina de hoy - Lunes Pecho y Biceps",
        cta="Ir a ejercicios",
        image_url="rutina.jpg",
        height=100,
        on_tap=lambda e: go_to("workouts"),
    )

    macros_card = _elevated_image_card(
        title="Mis macros",
        subtitle=macros_today,
        cta="Ir a macros",
        image_url="Macronutrientes.jpg",
        height=150,
        on_tap=lambda e: go_to("macros"),
    )

    micros_card = _elevated_image_card(
        title="Mis micronutrientes",
        subtitle="HOY",
        cta="Ir a micros",
        image_url="micro.jpg",
        height=150,
        on_tap=lambda e: go_to("micros"),
    )

    progress_card = _elevated_image_card(
        title="Mi progreso semanal",
        subtitle=f"{today.strftime('%B').title()} - Seguimiento grafico",
        cta="Ir a progreso",
        image_url="home_progress.jpg",
        height=180,
        on_tap=lambda e: go_to("progress"),
        content_alignment=ft.alignment.center_left,
        text_align=ft.TextAlign.LEFT,
    )

    chart_card = ft.Container(
        padding=ft.padding.symmetric(horizontal=26, vertical=28),
        margin=ft.margin.symmetric(horizontal=18),
        border_radius=24,
        bgcolor="#FFFFFF",
        content=ft.Column(
            controls=[
                ft.Text("Tus macronutrientes", size=17, weight=ft.FontWeight.W_600, color=TEXT_DARK),
                ft.Text("Semana actual", size=12, color=TEXT_MUTED_DARK),
                _build_macro_chart(week, TEXT_MUTED_DARK),
            ],
            spacing=16,
        ),
    )

    return ft.ListView(
        controls=[
            ft.Container(height=40),
            ft.Container(content=greeting, padding=ft.padding.symmetric(horizontal=18)),
            ft.Container(height=20),
            chart_card,
            ft.Container(height=24),
            ft.Container(content=hero_card, padding=ft.padding.symmetric(horizontal=18)),
            ft.Container(height=20),
            ft.Container(
                padding=ft.padding.symmetric(horizontal=18),
                content=ft.Row(
                    controls=[
                        ft.Container(expand=1, content=macros_card),
                        ft.Container(width=16),
                        ft.Container(expand=1, content=micros_card),
                    ],
                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                ),
            ),
            ft.Container(height=20),
            ft.Container(content=progress_card, padding=ft.padding.symmetric(horizontal=18)),
            ft.Container(height=60),
        ],
        expand=True,
        spacing=0,
        padding=ft.padding.only(bottom=24),
      
    )
