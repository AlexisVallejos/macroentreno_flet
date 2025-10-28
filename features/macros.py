import datetime as dt
import flet as ft
from data.storage import (
    add_food_entry,
    delete_food_entry,
    get_day_entries,
    update_food_entry,
)
from services.foods import describe_portion, format_macros, scale_macros, search_foods


MEAL_OPTIONS = [
    ("desayuno", "Desayuno"),
    ("almuerzo", "Almuerzo"),
    ("merienda", "Merienda"),
    ("cena", "Cena"),
    ("snack", "Snack"),
]

MACRO_CARD_STYLES = [
    {
        "title": "Calorias",
        "key": "kcal",
        "unit": "kcal",
        "accent": "#FFB74D",
        "bg": "#3F3219",
        "icon": ft.Icons.LOCAL_FIRE_DEPARTMENT,
        "format": lambda v: f"{v:.0f}",
    },
    {
        "title": "Proteinas",
        "key": "p",
        "unit": "g",
        "accent": "#64D8CB",
        "bg": "#23454D",
        "icon": ft.Icons.FITNESS_CENTER,
        "format": lambda v: f"{v:.1f}",
    },
    {
        "title": "Carbohidratos",
        "key": "c",
        "unit": "g",
        "accent": "#AED581",
        "bg": "#2F4528",
        "icon": ft.Icons.SSID_CHART,
        "format": lambda v: f"{v:.1f}",
    },
    {
        "title": "Grasas",
        "key": "g",
        "unit": "g",
        "accent": "#FF8A65",
        "bg": "#4A2D32",
        "icon": ft.Icons.WATER_DROP,
        "format": lambda v: f"{v:.1f}",
    },
]

QUICK_CARD_BG = "#2B3650"
ENTRY_GROUP_BG = "#253049"
ENTRY_ITEM_BG = "#31415F"
TEXT_MUTED = "#A8B4C8"


def MacrosView():
    today = dt.date.today()
    entries_column = ft.Column(spacing=12)
    totals_info_text = ft.Text("", size=13, color=TEXT_MUTED)
    macro_summary_column = ft.Column(spacing=10)
    favorites = search_foods("", limit=8)

    meal_order = {key: idx for idx, (key, _) in enumerate(MEAL_OPTIONS)}
    default_meal = MEAL_OPTIONS[1][0] if len(MEAL_OPTIONS) > 1 else MEAL_OPTIONS[0][0]

    quick_meal_dropdown = ft.Dropdown(
        label="Guardar en",
        value=default_meal,
        width=200,
        options=[ft.dropdown.Option(label, key) for key, label in MEAL_OPTIONS],
    )
    quick_section_column = ft.Column(spacing=10)

    def _format_meal(meal_key: str) -> str:
        lookup = {key: label for key, label in MEAL_OPTIONS}
        return lookup.get(meal_key, meal_key.capitalize())

    def compute_totals(items):
        totals = {"kcal": 0.0, "p": 0.0, "c": 0.0, "g": 0.0}
        for entry in items:
            totals["kcal"] += float(entry.get("kcal", 0) or 0)
            totals["p"] += float(entry.get("p", 0) or 0)
            totals["c"] += float(entry.get("c", 0) or 0)
            totals["g"] += float(entry.get("g", 0) or 0)
        return totals

    def chunk_controls(controls, size=2):
        rows = []
        buffer = []
        for ctrl in controls:
            buffer.append(ctrl)
            if len(buffer) == size:
                rows.append(ft.Row(buffer, spacing=10))
                buffer = []
        if buffer:
            rows.append(ft.Row(buffer, spacing=10))
        return rows

    def build_macro_cards(totals):
        cards = []
        for config in MACRO_CARD_STYLES:
            value = totals[config["key"]]
            cards.append(
                ft.Container(
                    expand=1,
                    bgcolor=config["bg"],
                    border_radius=14,
                    padding=14,
                    border=ft.border.all(1, "#4F5D73"),
                    shadow=ft.BoxShadow(
                        blur_radius=8,
                        spread_radius=0,
                        offset=ft.Offset(0, 2),
                        color="#000000",
                    ),
                    content=ft.Column(
                        [
                            ft.Row(
                                [
                                    ft.Icon(config["icon"], color=config["accent"], size=22),
                                    ft.Text(config["title"], size=12, weight=ft.FontWeight.W_600),
                                ],
                                spacing=6,
                            ),
                            ft.Text(
                                f"{config['format'](value)} {config['unit']}",
                                size=20,
                                weight=ft.FontWeight.BOLD,
                            ),
                        ],
                        spacing=8,
                    ),
                )
            )
        return cards

    def open_food_dialog(event: ft.ControlEvent, existing: dict | None = None):
        page = event.page
        entry_snapshot = existing.copy() if existing else None
        editing = entry_snapshot is not None
        current_ref = (existing or {}).get("food")
        entry_id = (existing or {}).get("entry_id")

        dialog_meal_dropdown = ft.Dropdown(
            label="Tipo de comida",
            value=(entry_snapshot or {}).get("meal", quick_meal_dropdown.value),
            options=[ft.dropdown.Option(label, key) for key, label in MEAL_OPTIONS],
        )

        catalog_search_field = ft.TextField(
            label="Buscar alimento",
            suffix_icon=ft.Icons.SEARCH,
            on_change=lambda ev: update_catalog_results(ev.control.value),
            on_submit=lambda ev: update_catalog_results(ev.control.value),
        )
        catalog_grams_field = ft.TextField(
            label="Cantidad (g)",
            value="100" if not editing else f"{float(entry_snapshot.get('grams', 100)):.0f}",
            keyboard_type=ft.KeyboardType.NUMBER,
        )
        catalog_selected_text = ft.Text(
            "Selecciona un alimento del catalogo" if not current_ref else current_ref.get("lookup_name", ""),
            size=12,
            color=TEXT_MUTED,
        )
        catalog_results_column = ft.Column(spacing=4, expand=True, scroll=ft.ScrollMode.AUTO)
        selected_catalog = {"food": None}

        manual_name_field = ft.TextField(
            label="Nombre del alimento",
            value=(entry_snapshot or {}).get("name", ""),
        )
        manual_grams_field = ft.TextField(
            label="Cantidad (g)",
            value=f"{float((entry_snapshot or {}).get('grams', 100)):.0f}",
            keyboard_type=ft.KeyboardType.NUMBER,
        )
        manual_kcal_field = ft.TextField(
            label="Calorias (kcal)",
            value=f"{float((entry_snapshot or {}).get('kcal', 0)):.0f}",
            keyboard_type=ft.KeyboardType.NUMBER,
        )
        manual_p_field = ft.TextField(
            label="Proteinas (g)",
            value=f"{float((entry_snapshot or {}).get('p', 0)):.1f}",
            keyboard_type=ft.KeyboardType.NUMBER,
        )
        manual_c_field = ft.TextField(
            label="Carbohidratos (g)",
            value=f"{float((entry_snapshot or {}).get('c', 0)):.1f}",
            keyboard_type=ft.KeyboardType.NUMBER,
        )
        manual_g_field = ft.TextField(
            label="Grasas (g)",
            value=f"{float((entry_snapshot or {}).get('g', 0)):.1f}",
            keyboard_type=ft.KeyboardType.NUMBER,
        )

        error_text = ft.Text("", color=ft.Colors.RED, size=12)

        def parse_float_field(field: ft.TextField, default=None):
            raw = (field.value or "").strip()
            if raw == "":
                return default
            try:
                return float(raw.replace(",", "."))
            except ValueError:
                return None

        def set_catalog_results(foods):
            catalog_results_column.controls.clear()
            if not foods:
                catalog_results_column.controls.append(
                    ft.Text("Sin coincidencias", size=12, color=TEXT_MUTED)
                )
            for food in foods:
                macros_preview = format_macros(food["macros"])
                catalog_results_column.controls.append(
                    ft.ListTile(
                        title=ft.Text(food["name"]),
                        subtitle=ft.Text(
                            f"{describe_portion(food)} - {macros_preview}",
                            size=12,
                        ),
                        dense=True,
                        on_click=lambda _, food=food: select_catalog_food(food),
                    )
                )
            if catalog_results_column.page:
                catalog_results_column.update()

        def update_catalog_results(query: str):
            foods = search_foods(query, limit=12)
            set_catalog_results(foods)

        def select_catalog_food(food: dict):
            selected_catalog["food"] = food
            catalog_selected_text.value = f"{food['name']} ({describe_portion(food)})"
            catalog_selected_text.color = ft.Colors.PRIMARY
            if catalog_selected_text.page:
                catalog_selected_text.update()

        def on_tab_change(ev):
            page.update()

        def submit(_: ft.ControlEvent):
            meal_value = dialog_meal_dropdown.value or default_meal
            error_text.value = ""

            if tabs.selected_index == 0:
                food = selected_catalog.get("food")
                grams = parse_float_field(catalog_grams_field, default=None)

                if not food:
                    error_text.value = "Selecciona un alimento del catalogo."
                elif grams is None or grams <= 0:
                    error_text.value = "Ingresa una cantidad valida en gramos."
                else:
                    macros = scale_macros(food, grams)
                    if editing:
                        update_food_entry(
                            entry_id,
                            name=food["name"],
                            meal=meal_value,
                            grams=grams,
                            kcal=macros["kcal"],
                            p=macros["p"],
                            c=macros["c"],
                            g=macros["g"],
                            food_ref={
                                "id": food["id"],
                                "source": food.get("source"),
                                "portion": food.get("portion"),
                                "lookup_name": food["name"],
                            },
                        )
                    else:
                        add_food_entry(
                            today,
                            meal_value,
                            food["name"],
                            grams,
                            macros["kcal"],
                            macros["p"],
                            macros["c"],
                            macros["g"],
                            food_ref={
                                "id": food["id"],
                                "source": food.get("source"),
                                "portion": food.get("portion"),
                                "lookup_name": food["name"],
                            },
                        )
            else:
                name = (manual_name_field.value or "").strip()
                grams = parse_float_field(manual_grams_field, default=None)
                kcal = parse_float_field(manual_kcal_field, default=0.0)
                p_val = parse_float_field(manual_p_field, default=0.0)
                c_val = parse_float_field(manual_c_field, default=0.0)
                g_val = parse_float_field(manual_g_field, default=0.0)

                if not name:
                    error_text.value = "Ingresa el nombre del alimento."
                elif grams is None or grams <= 0:
                    error_text.value = "Ingresa una cantidad valida en gramos."
                elif None in (kcal, p_val, c_val, g_val):
                    error_text.value = "Revisa los valores nutricionales."
                else:
                    food_ref = current_ref if (current_ref and current_ref.get("source") == "manual") else None
                    if not food_ref:
                        food_ref = {
                            "id": f"manual-{int(dt.datetime.now().timestamp())}",
                            "source": "manual",
                            "portion": {"grams": grams, "description": "ingreso manual"},
                            "lookup_name": name,
                        }
                    else:
                        food_ref = {**food_ref, "lookup_name": name, "portion": {"grams": grams, "description": "ingreso manual"}}

                    if editing:
                        update_food_entry(
                            entry_id,
                            name=name,
                            meal=meal_value,
                            grams=grams,
                            kcal=kcal or 0.0,
                            p=p_val or 0.0,
                            c=c_val or 0.0,
                            g=g_val or 0.0,
                            food_ref=food_ref,
                        )
                    else:
                        add_food_entry(
                            today,
                            meal_value,
                            name,
                            grams,
                            kcal or 0.0,
                            p_val or 0.0,
                            c_val or 0.0,
                            g_val or 0.0,
                            food_ref=food_ref,
                        )

            if error_text.value:
                if error_text.page:
                    error_text.update()
                return

            dialog.open = False
            page.snack_bar = ft.SnackBar(
                ft.Text("Comida actualizada" if editing else "Comida agregada")
            )
            page.snack_bar.open = True
            page.update()
            refresh_entries()

        def close_dialog(_=None):
            dialog.open = False
            page.update()

        catalog_tab_content = ft.Column(
            [
                catalog_search_field,
                catalog_grams_field,
                ft.Container(catalog_results_column, height=200),
                catalog_selected_text,
            ],
            spacing=10,
            tight=True,
        )

        manual_tab_content = ft.Column(
            [
                manual_name_field,
                manual_grams_field,
                manual_kcal_field,
                manual_p_field,
                manual_c_field,
                manual_g_field,
            ],
            spacing=10,
            tight=True,
        )

        tabs = ft.Tabs(
            selected_index=1 if editing else 0,
            on_change=on_tab_change,
            tabs=[
                ft.Tab(text="Catalogo", content=catalog_tab_content),
                ft.Tab(text="Manual", content=manual_tab_content),
            ],
        )

        dialog = ft.AlertDialog(
            modal=True,
            title=ft.Text("Editar comida" if editing else "Agregar comida"),
            content=ft.Container(
                width=390,
                content=ft.Column(
                    [
                        dialog_meal_dropdown,
                        tabs,
                        error_text,
                    ],
                    spacing=14,
                    tight=True,
                ),
            ),
            actions=[
                ft.TextButton("Cancelar", on_click=close_dialog),
                ft.ElevatedButton(
                    "Guardar" if editing else "Agregar",
                    icon=ft.Icons.CHECK,
                    on_click=submit,
                ),
            ],
            actions_alignment=ft.MainAxisAlignment.END,
        )

        set_catalog_results(search_foods("", limit=12))

        page.dialog = dialog
        dialog.open = True
        page.update()

    def confirm_delete(event: ft.ControlEvent, entry_id: str, entry_name: str, meal_key: str):
        page = event.page

        def do_delete(_):
            if entry_id:
                delete_food_entry(entry_id)
            confirm_dialog.open = False
            page.snack_bar = ft.SnackBar(ft.Text("Comida eliminada"))
            page.snack_bar.open = True
            page.update()
            refresh_entries()

        def cancel(_):
            confirm_dialog.open = False
            page.update()

        confirm_dialog = ft.AlertDialog(
            modal=True,
            title=ft.Text("Eliminar comida"),
            content=ft.Text(
                f"Estas seguro de eliminar {entry_name} de {_format_meal(meal_key)}?"
            ),
            actions=[
                ft.TextButton("Cancelar", on_click=cancel),
                ft.ElevatedButton("Eliminar", icon=ft.Icons.DELETE, on_click=do_delete, bgcolor=ft.Colors.RED, color=ft.Colors.WHITE),
            ],
            actions_alignment=ft.MainAxisAlignment.END,
        )
        page.dialog = confirm_dialog
        confirm_dialog.open = True
        page.update()

    def refresh_entries():
        items = get_day_entries(today)
        totals = compute_totals(items)

        macro_summary_column.controls.clear()
        macro_cards = build_macro_cards(totals)
        macro_summary_column.controls.extend(chunk_controls(macro_cards))
        if macro_summary_column.page:
            macro_summary_column.update()

        totals_info_text.value = (
            f"{len(items)} comidas registradas hoy" if items else "Sin registros para hoy"
        )
        totals_info_text.color = TEXT_MUTED if items else ft.Colors.GREY
        if totals_info_text.page:
            totals_info_text.update()

        entries_column.controls.clear()
        if not items:
            entries_column.controls.append(
                ft.Container(
                    content=ft.Column(
                        [
                            ft.Icon(ft.Icons.RESTAURANT_OUTLINED, size=48, color=TEXT_MUTED),
                            ft.Text("Todavia no agregaste comidas hoy.", color=TEXT_MUTED),
                        ],
                        alignment=ft.MainAxisAlignment.CENTER,
                        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                        spacing=8,
                    ),
                    padding=24,
                    border_radius=14,
                    bgcolor=ENTRY_GROUP_BG,
                    border=ft.border.all(1, "#3E4B66"),
                    shadow=ft.BoxShadow(
                        blur_radius=8,
                        spread_radius=0,
                        offset=ft.Offset(0, 2),
                        color="#000000",
                    ),
                )
            )
        else:
            groups = {}
            for entry in items:
                meal_key = entry.get("meal") or "otros"
                groups.setdefault(meal_key, []).append(entry)

            sorted_meals = sorted(
                groups.items(), key=lambda kv: meal_order.get(kv[0], len(meal_order))
            )
            for meal_key, meal_entries in sorted_meals:
                meal_totals = compute_totals(meal_entries)
                meal_controls = []
                for entry in meal_entries:
                    entry_data = entry.copy()
                    entry_id = entry_data.get("entry_id")
                    entry_name = entry_data.get("name", "")
                    meal_value = entry_data.get("meal", meal_key)
                    entry_controls = ft.Column(
                        [
                            ft.Row(
                                [
                                    ft.Column(
                                        [
                                            ft.Text(entry["name"], weight=ft.FontWeight.BOLD, size=13),
                                            ft.Text(
                                                format_macros(
                                                    {
                                                        "kcal": entry.get("kcal", 0),
                                                        "p": entry.get("p", 0),
                                                        "c": entry.get("c", 0),
                                                        "g": entry.get("g", 0),
                                                    }
                                                ),
                                                size=12,
                                                color=TEXT_MUTED,
                                            ),
                                        ],
                                        spacing=4,
                                        expand=True,
                                    ),
                                    ft.Column(
                                        [
                                            ft.IconButton(
                                                icon=ft.Icons.EDIT,
                                                icon_color=ft.Colors.BLUE,
                                                tooltip="Editar",
                                                on_click=lambda ev, data=entry_data: open_food_dialog(ev, data),
                                            ),
                                            ft.IconButton(
                                                icon=ft.Icons.DELETE,
                                                icon_color=ft.Colors.RED,
                                                tooltip="Eliminar",
                                                on_click=lambda ev, entry_id=entry_id, entry_name=entry_name, meal_key=meal_value: confirm_delete(ev, entry_id, entry_name, meal_key),
                                            ),
                                        ],
                                        spacing=0,
                                    ),
                                ],
                                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                            ),
                            ft.Text(
                                f"{float(entry.get('grams', 0) or 0):.0f} g",
                                size=11,
                                color=TEXT_MUTED,
                            ),
                        ],
                        spacing=6,
                    )

                    meal_controls.append(
                        ft.Container(
                            padding=12,
                            border_radius=12,
                            bgcolor=ENTRY_ITEM_BG,
                            border=ft.border.all(1, "#4A5875"),
                            content=entry_controls,
                        )
                    )

                entries_column.controls.append(
                    ft.Container(
                        padding=14,
                        border_radius=16,
                        bgcolor=ENTRY_GROUP_BG,
                        border=ft.border.all(1, "#3E4B66"),
                        shadow=ft.BoxShadow(
                            blur_radius=8,
                            spread_radius=0,
                            offset=ft.Offset(0, 3),
                            color="#000000",
                        ),
                        content=ft.Column(
                            [
                                ft.Row(
                                    [
                                        ft.Text(
                                            _format_meal(meal_key),
                                            size=14,
                                            weight=ft.FontWeight.W_600,
                                        ),
                                        ft.Text(
                                            format_macros(meal_totals),
                                            size=12,
                                            color=TEXT_MUTED,
                                        ),
                                    ],
                                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                                ),
                                ft.Column(meal_controls, spacing=10),
                            ],
                            spacing=12,
                        ),
                    )
                )
        if entries_column.page:
            entries_column.update()

    def quick_add(food: dict, grams: float, page: ft.Page):
        target_meal = quick_meal_dropdown.value or default_meal
        macros = scale_macros(food, grams)
        add_food_entry(
            today,
            target_meal,
            food["name"],
            grams,
            macros["kcal"],
            macros["p"],
            macros["c"],
            macros["g"],
            food_ref={
                "id": food["id"],
                "source": food.get("source"),
                "portion": food.get("portion"),
                "lookup_name": food["name"],
            },
        )
        page.snack_bar = ft.SnackBar(
            ft.Text(f"{food['name']} agregada a {_format_meal(target_meal)}")
        )
        page.snack_bar.open = True
        page.update()
        refresh_entries()

    quick_controls = []
    for food in favorites:
        grams = float(food.get("portion", {}).get("grams") or 100)
        macros_preview = scale_macros(food, grams)
        quick_controls.append(
            ft.Container(
                expand=1,
                bgcolor=QUICK_CARD_BG,
                border_radius=14,
                padding=12,
                border=ft.border.all(1, "#3E4A65"),
                shadow=ft.BoxShadow(
                    blur_radius=6,
                    spread_radius=0,
                    offset=ft.Offset(0, 2),
                    color="#000000",
                ),
                on_click=lambda e, f=food, g=grams: quick_add(f, g, e.page),
                content=ft.Column(
                    [
                        ft.Text(food["name"], size=13, weight=ft.FontWeight.W_600),
                        ft.Text(describe_portion(food), size=11, color=TEXT_MUTED),
                        ft.Text(format_macros(macros_preview), size=11),
                    ],
                    spacing=4,
                ),
            )
        )

    quick_section_column.controls.clear()
    if quick_controls:
        quick_section_column.controls.extend(chunk_controls(quick_controls))
        quick_section_column.controls.append(
            ft.Text(
                "Toca una tarjeta para agregarla con la porcion sugerida.",
                size=11,
                color=TEXT_MUTED,
            )
        )
    else:
        quick_section_column.controls.append(
            ft.Container(
                padding=12,
                bgcolor=QUICK_CARD_BG,
                border_radius=12,
                content=ft.Text("Sin alimentos precargados", size=12, color=TEXT_MUTED),
            )
        )

    refresh_entries()

    return ft.Column(
        [
            ft.Text(today.strftime("%A %d/%m"), size=18, weight=ft.FontWeight.BOLD),
            totals_info_text,
            ft.Text("Resumen diario", size=15, weight=ft.FontWeight.W_600),
            macro_summary_column,
            ft.Text("Comidas frecuentes", size=15, weight=ft.FontWeight.W_600),
            ft.Row(
                [
                    ft.Text("Agregar rapido en:", size=12, color=TEXT_MUTED),
                    quick_meal_dropdown,
                ],
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
            ),
            quick_section_column,
            ft.Divider(color="#30384C"),
            ft.Text("Diario de comidas", size=15, weight=ft.FontWeight.W_600),
            entries_column,
            ft.ElevatedButton(
                "Agregar comida",
                icon=ft.Icons.ADD,
                on_click=lambda e: open_food_dialog(e, None),
            ),
        ],
        spacing=16,
        expand=True,
        scroll=ft.ScrollMode.AUTO,
    )
