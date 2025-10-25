import flet as ft
from features.home import HomeView
from features.macros import MacrosView

def main(page: ft.Page):
    page.title = "MacroEntreno Argento"
    page.window_min_width, page.window_min_height = 380, 700
    page.theme_mode = ft.ThemeMode.DARK

    # Estado simple de navegación
    routes = ["home", "workouts", "add", "progress", "macros"]
    current_route = "home"

    content = ft.Column(expand=True)

    def go_to(route: str):
        nonlocal current_route
        if route not in routes:
            route = "home"
        current_route = route
        render()

    def on_nav_change(e: ft.ControlEvent):
        idx = e.control.selected_index
        go_to(routes[idx])

    # Barra de navegación (Flet actual: NavigationBarDestination + Icons)
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
    )

    def render():
        content.controls.clear()
        if current_route == "home":
            content.controls.append(HomeView(go_to))
        elif current_route == "macros":
            content.controls.append(MacrosView())
        else:
            # Placeholders para secciones aún no implementadas
            content.controls.append(
                ft.Container(
                    content=ft.Column(
                        [
                            ft.Icon(ft.Icons.BUILD_CIRCLE_OUTLINED, size=48),
                            ft.Text("Próximamente…", size=20, weight=ft.FontWeight.W_600),
                        ],
                        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                        alignment=ft.MainAxisAlignment.CENTER,
                    ),
                    expand=True,
                    alignment=ft.alignment.center,
                )
            )
        page.update()

    # Layout: contenido + barra de navegación
    page.add(content)
    page.navigation_bar = nav  # forma recomendada y compatible

    render()

# Punto de entrada Flet
ft.app(target=main)
