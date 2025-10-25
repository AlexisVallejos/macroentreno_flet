import flet as ft, datetime as dt
from data.storage import get_day_entries, add_food_entry

def MacrosView():
    today = dt.date.today()
    items = get_day_entries(today)

    list_controls = []
    for e in items:
        list_controls.append(
            ft.Container(
                content=ft.Row([
                    ft.Text(e["name"], weight=ft.FontWeight.BOLD),
                    ft.Text(f'{e["kcal"]:.0f} kcal  P {e["p"]}g  C {e["c"]}g  G {e["g"]}g'),
                ], alignment=ft.MainAxisAlignment.SPACE_BETWEEN),
                padding=10, border_radius=12,
                bgcolor=ft.Colors.BLACK, opacity=0.05
            )
        )

    def add_quick_food(e):
        # Demo: 100g de pollo
        add_food_entry(today, "almuerzo", "Pollo (100g)", 100, 165, 31, 0, 3.6)
        e.page.snack_bar = ft.SnackBar(ft.Text("Comida agregada"))
        e.page.snack_bar.open = True
        # refrescar
        e.page.go(e.page.route)

    return ft.Column([
        ft.Text(today.strftime("%A %d/%m"), size=16, weight=ft.FontWeight.BOLD),
        ft.Column(list_controls, spacing=8),
        ft.ElevatedButton("Agregar comida de ejemplo", on_click=add_quick_food, icon=ft.Icons.ADD)
    ], spacing=12, scroll=ft.ScrollMode.AUTO)
