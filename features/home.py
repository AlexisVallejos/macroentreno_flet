import flet as ft
import datetime as dt
from services.reports import weekly_macros_summary
from data.storage import get_user

def HomeView(go_to):
    user = get_user()
    greeting = ft.Text(f"HOLA, {user['name'].upper()}", size=18, weight=ft.FontWeight.W_600)

    week = weekly_macros_summary(dt.date.today(), 7)

    bars = []
    for d in week:
        p_h = int(d["p"])
        c_h = int(d["c"])
        g_h = int(d["g"])

        col = ft.Column(
            controls=[
                ft.Container(height=max(p_h, 4), width=10, bgcolor="#43B4E8", border_radius=5),
                ft.Container(height=max(c_h, 4), width=10, bgcolor="#F3C44C", border_radius=5),
                ft.Container(height=max(g_h, 4), width=10, bgcolor="#F58A5E", border_radius=5),
            ],
            spacing=2,
            horizontal_alignment=ft.CrossAxisAlignment.CENTER,
        )
        label = ft.Text(dt.datetime.fromisoformat(d["date"]).strftime("%a"), size=12)
        bars.append(ft.Column([col, label], horizontal_alignment=ft.CrossAxisAlignment.CENTER))

    chart = ft.Row(bars, alignment=ft.MainAxisAlignment.SPACE_BETWEEN)

    cards = ft.Column([
        ft.Container(
            content=ft.Column([
                ft.Text("TUS MACRONUTRIENTES", size=16, weight=ft.FontWeight.BOLD),
                ft.Text("Vista semanal - Últimos 7 días", size=12, color=ft.Colors.GREY),
                chart
            ], spacing=10),
            padding=15, bgcolor=ft.Colors.WHITE, border_radius=16
        ),
        ft.Container(
            content=ft.Column([
                ft.Text("Ejercicio de hoy", size=16, weight=ft.FontWeight.BOLD),
                ft.Text("PECHO Y BÍCEPS (ejemplo)", size=14)
            ], spacing=5),
            padding=15,
            bgcolor=ft.Colors.BLUE_GREY,
            opacity=0.10,                # en vez de with_opacity
            border_radius=16
        ),
        ft.Row([
            ft.Container(
                expand=1, padding=12, border_radius=14,
                bgcolor=ft.Colors.BLACK, opacity=0.08,
                content=ft.Column([ft.Text("Tus Macronutrientes"), ft.Text("HOY")]),
                on_click=lambda e: go_to("macros"),
            ),
            ft.Container(
                expand=1, padding=12, border_radius=14,
                bgcolor=ft.Colors.BLACK, opacity=0.08,
                content=ft.Column([ft.Text("Tus Micronutrientes"), ft.Text("HOY")]),
                on_click=lambda e: go_to("micros"),
            ),
        ], spacing=12),
    ], spacing=16)

    return ft.Column([greeting, cards], scroll=ft.ScrollMode.AUTO, spacing=16)
