from pathlib import Path

import flet as ft
from features.home import HomeView
from features.macros import MacrosView
from features.progress import ProgressView
from features.workouts import WorkoutsView

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional dependency
    load_dotenv = None

if load_dotenv:
    base_dir = Path(__file__).resolve().parent
    for env_file in (".env.local", ".env"):
        candidate = base_dir / env_file
        if candidate.exists():
            load_dotenv(candidate, override=False)

def main(page: ft.Page):
    page.title = "MacroEntreno Argento"
    page.window_min_width, page.window_min_height = 380, 700
    page.theme_mode = ft.ThemeMode.DARK
    primary_blue = "#007AFF"
    secondary_blue = "#5AC8FA"
    page.theme = ft.Theme(color_scheme_seed=primary_blue)
    page.bgcolor = "#0A0A0A"
    page.horizontal_alignment = ft.CrossAxisAlignment.STRETCH

    # Estado simple de navegacion
    routes = ["home", "workouts", "add", "progress", "macros", "micros"]
    current_route = "home"
    last_nav_index = 0

    content = ft.Column(expand=True)

    def make_placeholder(title: str, message: str) -> ft.Control:
        return ft.Container(
            content=ft.Column(
                [
                    ft.Icon(ft.Icons.BUILD_CIRCLE_OUTLINED, size=48),
                    ft.Text(title, size=18, weight=ft.FontWeight.W_600),
                    ft.Text(message, size=13, color=ft.Colors.GREY),
                ],
                alignment=ft.MainAxisAlignment.CENTER,
                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                spacing=8,
            ),
            expand=True,
            alignment=ft.alignment.center,
        )

    def go_to(route: str):
        nonlocal current_route, last_nav_index
        if route not in routes:
            route = "home"
        current_route = route

        if route in routes:
            idx = routes.index(route)
            if idx < len(nav.destinations):
                last_nav_index = idx
                if nav.selected_index != idx:
                    nav.selected_index = idx
                    nav.update()

        render()

    def handle_add_action(route: str):
        close_add_sheet()
        go_to(route)

    def open_add_sheet():
        add_sheet.open = True
        page.update()

    def close_add_sheet():
        add_sheet.open = False
        page.update()

    def on_nav_change(e: ft.ControlEvent):
        idx = e.control.selected_index
        add_idx = routes.index("add")
        if idx == add_idx:
            e.control.selected_index = last_nav_index
            e.control.update()
            open_add_sheet()
            return
        go_to(routes[idx])

    add_sheet = ft.BottomSheet(
        ft.Container(
            padding=16,
            content=ft.Column(
                [
                    ft.Text("Agregar", size=18, weight=ft.FontWeight.W_600),
                    ft.ListTile(
                        leading=ft.Icon(ft.Icons.SCALE),
                        title=ft.Text("Agregar macronutrientes"),
                        subtitle=ft.Text("Registrar comidas y macros"),
                        on_click=lambda _: handle_add_action("macros"),
                    ),
                    ft.ListTile(
                        leading=ft.Icon(ft.Icons.SCIENCE),
                        title=ft.Text("Agregar micronutrientes"),
                        subtitle=ft.Text("Control de vitaminas y minerales"),
                        on_click=lambda _: handle_add_action("micros"),
                    ),
                    ft.ListTile(
                        leading=ft.Icon(ft.Icons.FITNESS_CENTER),
                        title=ft.Text("Agregar ejercicio"),
                        subtitle=ft.Text("Suma una sesion a tu rutina"),
                        on_click=lambda _: handle_add_action("workouts"),
                    ),
                ],
                tight=True,
                spacing=4,
            ),
        ),
        show_drag_handle=True,
    )

    # Barra de navegacion (Flet actual: NavigationBarDestination + Icons)
    nav = ft.NavigationBar(
        destinations=[
            ft.NavigationBarDestination(icon=ft.Icons.HOME, label="Inicio"),
            ft.NavigationBarDestination(icon=ft.Icons.FITNESS_CENTER, label="Mis Ejercicios"),
            ft.NavigationBarDestination(icon=ft.Icons.ADD_CIRCLE, label=""),
            ft.NavigationBarDestination(icon=ft.Icons.ANALYTICS, label="Mi Progreso"),
            ft.NavigationBarDestination(icon=ft.Icons.SSID_CHART, label="Mis Macros"),
        ],
        selected_index=0,
        on_change=on_nav_change,
        bgcolor="#1C1C1E",
        indicator_color=primary_blue,
        shadow_color=secondary_blue,
    )

    def render():
        content.controls.clear()
        if current_route == "home":
            content.controls.append(HomeView(go_to))
        elif current_route == "macros":
            content.controls.append(MacrosView())
        elif current_route == "micros":
            content.controls.append(
                make_placeholder("Micronutrientes", "Modulo en construccion. Proximamente.")
            )
        elif current_route == "workouts":
            content.controls.append(WorkoutsView())
        elif current_route == "progress":
            content.controls.append(ProgressView())
        else:
            content.controls.append(make_placeholder("Proximamente", "Seccion en desarrollo."))
        page.update()

    # Layout: contenido + barra de navegacion
    page.overlay.append(add_sheet)
    page.add(content)
    page.navigation_bar = nav  # forma recomendada y compatible

    render()


# Punto de entrada Flet
ft.app(target=main)
