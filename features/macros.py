import datetime as dt
import flet as ft
from data.storage import (
    add_food_entry,
    create_custom_food,
    delete_custom_food,
    delete_food_entry,
    get_custom_food,
    get_day_entries,
    list_custom_foods,
    update_custom_food,
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

PRIMARY_COLOR = "#007AFF"
SECONDARY_COLOR = "#5AC8FA"
ACCENT_GREEN = "#34C759"
BACKGROUND_COLOR = "#0A0A0A"
CARD_BG = "#1C1C1E"
TEXT_PRIMARY = "#FFFFFF"
TEXT_MUTED = "#8E8E93"
ALERT_RED = "ALERT_RED"

MACRO_CARD_STYLES = [
    {
        "title": "Calorias",
        "key": "kcal",
        "unit": "kcal",
        "accent": PRIMARY_COLOR,
        "bg": CARD_BG,
        "icon": ft.Icons.LOCAL_FIRE_DEPARTMENT,
        "format": lambda v: f"{v:.0f}",
    },
    {
        "title": "Proteinas",
        "key": "p",
        "unit": "g",
        "accent": ACCENT_GREEN,
        "bg": CARD_BG,
        "icon": ft.Icons.FITNESS_CENTER,
        "format": lambda v: f"{v:.1f}",
    },
    {
        "title": "Carbohidratos",
        "key": "c",
        "unit": "g",
        "accent": SECONDARY_COLOR,
        "bg": CARD_BG,
        "icon": ft.Icons.SSID_CHART,
        "format": lambda v: f"{v:.1f}",
    },
    {
        "title": "Grasas",
        "key": "g",
        "unit": "g",
        "accent": "#FF9F0A",
        "bg": CARD_BG,
        "icon": ft.Icons.WATER_DROP,
        "format": lambda v: f"{v:.1f}",
    },
]

QUICK_CARD_BG = "#1F1F21"
ENTRY_GROUP_BG = "#121214"
ENTRY_ITEM_BG = "#1E1E20"
CUSTOM_CARD_BG = "#1C1C1E"


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
        color=TEXT_PRIMARY,
        bgcolor=CARD_BG,
        border_color="#2C2C2E",
        focused_border_color=PRIMARY_COLOR,
    )
    quick_section_column = ft.Column(spacing=10)
    custom_library_column = ft.Column(spacing=10)

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

    def refresh_custom_library():
        foods = list_custom_foods()
        custom_library_column.controls.clear()
        if not foods:
            custom_library_column.controls.append(
                ft.Container(
                    padding=12,
                    border_radius=12,
                    border=ft.border.all(1, "#2C2C2E"),
                    bgcolor=CUSTOM_CARD_BG,
                    content=ft.Text(
                        "Todavia no creaste comidas definidas. Usa el boton para guardar tus combinaciones favoritas.",
                        size=12,
                        color=TEXT_MUTED,
                    ),
                )
            )
        else:
            for food in foods:
                grams = float(food.get("portion", {}).get("grams") or 100)
                macros_preview = format_macros(scale_macros(food, grams))
                custom_library_column.controls.append(
                    ft.Container(
                        padding=12,
                        border_radius=16,
                        bgcolor=CUSTOM_CARD_BG,
                        border=ft.border.all(1, "#2C2C2E"),
                        content=ft.Column(
                            [
                                ft.Row(
                                    [
                                        ft.Column(
                                            [
                                                ft.Text(
                                                    food["name"],
                                                    size=13,
                                                    weight=ft.FontWeight.W_600,
                                                    color=TEXT_PRIMARY,
                                                ),
                                                ft.Text(
                                                    f"{describe_portion(food)} - {macros_preview}",
                                                    size=11,
                                                    color=TEXT_MUTED,
                                                ),
                                            ],
                                            spacing=4,
                                            expand=True,
                                        ),
                                        ft.Row(
                                            [
                                                ft.IconButton(
                                                    icon=ft.Icons.ADD_CIRCLE,
                                                    tooltip="Agregar al diario",
                                                    icon_color=ACCENT_GREEN,
                                                    on_click=lambda ev, f=food: add_custom_food_to_meal(f, ev.page),
                                                ),
                                                ft.IconButton(
                                                    icon=ft.Icons.EDIT,
                                                    tooltip="Editar comida definida",
                                                    icon_color=PRIMARY_COLOR,
                                                    on_click=lambda ev, f=food: show_custom_food_form(ev, f),
                                                ),
                                                ft.IconButton(
                                                    icon=ft.Icons.DELETE,
                                                    tooltip="Eliminar comida definida",
                                                    icon_color="ALERT_RED",
                                                    on_click=lambda ev, f=food: confirm_delete_custom_food(ev, f),
                                                ),
                                            ],
                                            spacing=0,
                                        ),
                                    ],
                                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                                ),
                            ],
                            spacing=8,
                        ),
                    )
                )
        if custom_library_column.page:
            custom_library_column.update()

    def add_custom_food_to_meal(food: dict, page: ft.Page):
        target_meal = quick_meal_dropdown.value or default_meal
        grams = float(food.get("portion", {}).get("grams") or 100)
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
                "source": food.get("source", "custom"),
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
                    border_radius=16,
                    padding=16,
                    border=ft.border.all(1, "#2C2C2E"),
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
                                    ft.Text(config["title"], size=12, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                                ],
                                spacing=6,
                            ),
                            ft.Text(
                                f"{config['format'](value)} {config['unit']}",
                                size=20,
                                weight=ft.FontWeight.BOLD,
                                color=TEXT_PRIMARY,
                            ),
                        ],
                        spacing=8,
                    ),
                )
            )
        return cards

    def show_custom_food_form(
        event: ft.ControlEvent,
        food: dict | None = None,
        on_saved=None,
    ):
        page_local = event.page
        food_snapshot = food.copy() if food else None
        editing_custom = food_snapshot is not None

        name_field = ft.TextField(
            label="Nombre",
            value=(food_snapshot or {}).get("name", ""),
        )
        portion_grams_field = ft.TextField(
            label="Porción base (g)",
            value=f"{float((food_snapshot or {}).get('portion', {}).get('grams', 100)):.0f}",
            keyboard_type=ft.KeyboardType.NUMBER,
        )
        portion_desc_field = ft.TextField(
            label="Descripción de la porción (opcional)",
            value=(food_snapshot or {}).get("portion", {}).get("description", ""),
        )
        kcal_field = ft.TextField(
            label="Calorías (kcal)",
            value=f"{float((food_snapshot or {}).get('macros', {}).get('kcal', 0)):.0f}",
            keyboard_type=ft.KeyboardType.NUMBER,
        )
        p_field = ft.TextField(
            label="Proteínas (g)",
            value=f"{float((food_snapshot or {}).get('macros', {}).get('p', 0)):.1f}",
            keyboard_type=ft.KeyboardType.NUMBER,
        )
        c_field = ft.TextField(
            label="Carbohidratos (g)",
            value=f"{float((food_snapshot or {}).get('macros', {}).get('c', 0)):.1f}",
            keyboard_type=ft.KeyboardType.NUMBER,
        )
        g_field = ft.TextField(
            label="Grasas (g)",
            value=f"{float((food_snapshot or {}).get('macros', {}).get('g', 0)):.1f}",
            keyboard_type=ft.KeyboardType.NUMBER,
        )
        error_field = ft.Text("", color=ALERT_RED, size=12)

        def parse_value(field: ft.TextField, default=None):
            raw = (field.value or "").strip()
            if raw == "":
                return default
            try:
                return float(raw.replace(",", "."))
            except ValueError:
                return None

        def submit_custom(_: ft.ControlEvent):
            name_value = (name_field.value or "").strip()
            grams_val = parse_value(portion_grams_field, default=None)
            kcal_val = parse_value(kcal_field, default=None)
            p_val = parse_value(p_field, default=None)
            c_val = parse_value(c_field, default=None)
            g_val = parse_value(g_field, default=None)

            if not name_value:
                error_field.value = "Ingresa el nombre de la comida."
            elif grams_val is None or grams_val <= 0:
                error_field.value = "Ingresa una porción base válida."
            elif None in (kcal_val, p_val, c_val, g_val):
                error_field.value = "Revisa los valores nutricionales."
            else:
                description_val = (portion_desc_field.value or "").strip() or None
                if editing_custom:
                    updated = update_custom_food(
                        food_snapshot["id"],
                        name=name_value,
                        grams=grams_val,
                        kcal=kcal_val,
                        p=p_val,
                        c=c_val,
                        g=g_val,
                        description=description_val,
                    )
                    if not updated:
                        error_field.value = "No se pudo actualizar la comida definida."
                        if error_field.page:
                            error_field.update()
                        return
                    target_id = updated["id"]
                    message = "Comida definida actualizada"
                else:
                    created = create_custom_food(
                        name=name_value,
                        grams=grams_val,
                        kcal=kcal_val or 0.0,
                        p=p_val or 0.0,
                        c=c_val or 0.0,
                        g=g_val or 0.0,
                        description=description_val,
                    )
                    target_id = created["id"]
                    message = "Comida definida creada"
                page_local.close(custom_dialog)
                refresh_custom_library()
                if on_saved:
                    on_saved(target_id)
                page_local.snack_bar = ft.SnackBar(ft.Text(message))
                page_local.snack_bar.open = True
                page_local.update()
                return

            if error_field.page:
                error_field.update()

        def cancel_custom(_=None):
            page_local.close(custom_dialog)

        custom_dialog = ft.AlertDialog(
            modal=True,
            title=ft.Text(
                "Editar comida definida" if editing_custom else "Nueva comida definida"
            ),
            content=ft.Container(
                width=360,
                content=ft.Column(
                    [
                        name_field,
                        portion_grams_field,
                        portion_desc_field,
                        kcal_field,
                        p_field,
                        c_field,
                        g_field,
                        error_field,
                    ],
                    spacing=10,
                    tight=True,
                ),
            ),
            actions=[
                ft.TextButton("Cancelar", on_click=cancel_custom),
                ft.ElevatedButton("Guardar", icon=ft.Icons.CHECK, on_click=submit_custom),
            ],
            actions_alignment=ft.MainAxisAlignment.END,
        )
        page_local.open(custom_dialog)

    def confirm_delete_custom_food(event: ft.ControlEvent, food: dict, on_deleted=None):
        page_local = event.page

        def do_delete(_):
            removed = delete_custom_food(food.get("id"))
            page_local.close(confirm_dialog)
            if removed:
                refresh_custom_library()
                if on_deleted:
                    on_deleted()
                page_local.snack_bar = ft.SnackBar(
                    ft.Text(f"{food.get('name', 'Comida')} eliminada")
                )
            else:
                page_local.snack_bar = ft.SnackBar(
                    ft.Text("No se pudo eliminar la comida definida.")
                )
            page_local.snack_bar.open = True
            page_local.update()

        def cancel_delete(_=None):
            page_local.close(confirm_dialog)

        confirm_dialog = ft.AlertDialog(
            modal=True,
            title=ft.Text("Eliminar comida definida"),
            content=ft.Text(f"¿Seguro deseas eliminar {food.get('name', 'esta comida')}?"),
            actions=[
                ft.TextButton("Cancelar", on_click=cancel_delete),
                ft.ElevatedButton(
                    "Eliminar",
                    icon=ft.Icons.DELETE,
                    bgcolor=ALERT_RED,
                    color=ft.Colors.WHITE,
                    on_click=do_delete,
                ),
            ],
            actions_alignment=ft.MainAxisAlignment.END,
        )
        page_local.open(confirm_dialog)

    def open_food_dialog(event: ft.ControlEvent, existing: dict | None = None):
        page = event.page
        entry_snapshot = existing.copy() if existing else None
        editing = entry_snapshot is not None
        current_ref = (existing or {}).get("food") or {}
        entry_id = (existing or {}).get("entry_id")
        current_source = current_ref.get("source")
        current_custom_id = current_ref.get("id") if current_source == "custom" else None
        custom_state = {
            "current": get_custom_food(current_custom_id) if current_custom_id else None
        }

        initial_tab_index = 0
        if editing:
            if current_source == "custom":
                initial_tab_index = 2
            elif current_source in ("local", "usda"):
                initial_tab_index = 0
            else:
                initial_tab_index = 1
        elif custom_state["current"]:
            initial_tab_index = 2

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
        manual_save_checkbox = ft.Checkbox(
            label="Guardar como comida definida" if not custom_state["current"] else "Actualizar comida definida",
            value=bool(custom_state["current"]),
        )

        custom_selected_text = ft.Text(
            "Selecciona una comida definida"
            if not custom_state["current"]
            else f"{custom_state['current']['name']} ({describe_portion(custom_state['current'])})",
            size=12,
            color=TEXT_MUTED if not custom_state["current"] else ft.Colors.PRIMARY,
        )
        custom_default_grams = float(
            (entry_snapshot or {}).get(
                "grams",
                (custom_state["current"] or {}).get("portion", {}).get("grams", 100),
            )
            or 0
        )
        if custom_default_grams <= 0:
            custom_default_grams = 100.0
        custom_grams_field = ft.TextField(
            label="Cantidad (g)",
            value=f"{custom_default_grams:.0f}",
            keyboard_type=ft.KeyboardType.NUMBER,
        )
        custom_foods_column = ft.Column(spacing=4, expand=True, scroll=ft.ScrollMode.AUTO)
        selected_custom = {"food": custom_state["current"]}

        error_text = ft.Text("", color=ALERT_RED, size=12)

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

        def set_custom_foods(foods):
            custom_foods_column.controls.clear()
            if not foods:
                custom_foods_column.controls.append(
                    ft.Text("Todavia no definiste comidas.", size=12, color=TEXT_MUTED)
                )
            else:
                for food in foods:
                    macros_preview = format_macros(food.get("macros", {}))
                    custom_foods_column.controls.append(
                        ft.ListTile(
                            title=ft.Text(food["name"]),
                            subtitle=ft.Text(
                                f"{describe_portion(food)} - {macros_preview}",
                                size=12,
                            ),
                            dense=True,
                            on_click=lambda _, food=food: select_custom_food(food),
                            trailing=ft.Row(
                                [
                                    ft.IconButton(
                                        icon=ft.Icons.EDIT,
                                        icon_color=ft.Colors.PRIMARY,
                                        tooltip="Editar comida definida",
                                        icon_size=18,
                                        on_click=lambda ev, food=food: show_custom_food_form(
                                            ev,
                                            food,
                                            on_saved=lambda target_id: refresh_custom_foods(
                                                select_id=target_id
                                            ),
                                        ),
                                    ),
                                    ft.IconButton(
                                        icon=ft.Icons.DELETE,
                                        icon_color=ALERT_RED,
                                        tooltip="Eliminar comida definida",
                                        icon_size=18,
                                        on_click=lambda ev, food=food: confirm_delete_custom_food(
                                            ev,
                                            food,
                                            on_deleted=lambda: refresh_custom_foods(select_id=None),
                                        ),
                                    ),
                                ],
                                spacing=0,
                                alignment=ft.MainAxisAlignment.END,
                            ),
                        )
                    )
            if custom_foods_column.page:
                custom_foods_column.update()

        def select_custom_food(food: dict | None):
            selected_custom["food"] = food
            if food:
                custom_state["current"] = food
                custom_selected_text.value = f"{food['name']} ({describe_portion(food)})"
                custom_selected_text.color = ft.Colors.PRIMARY
                manual_save_checkbox.label = "Actualizar comida definida"
                manual_save_checkbox.value = True
                grams_reference = None
                if editing and current_custom_id == food.get("id"):
                    grams_reference = (entry_snapshot or {}).get("grams")
                if grams_reference is None:
                    grams_reference = food.get("portion", {}).get("grams", 100)
                try:
                    grams_value = float(grams_reference or 0)
                except (TypeError, ValueError):
                    grams_value = 100.0
                if grams_value <= 0:
                    grams_value = 100.0
                custom_grams_field.value = f"{grams_value:.0f}"
            else:
                custom_state["current"] = None
                custom_selected_text.value = "Selecciona una comida definida"
                custom_selected_text.color = TEXT_MUTED
                manual_save_checkbox.label = "Guardar como comida definida"
                manual_save_checkbox.value = False
            if custom_selected_text.page:
                custom_selected_text.update()
            if custom_grams_field.page:
                custom_grams_field.update()
            if manual_save_checkbox.page:
                manual_save_checkbox.update()

        def refresh_custom_foods(select_id: str | None = None):
            foods = list_custom_foods()
            set_custom_foods(foods)
            if select_id:
                for food in foods:
                    if food.get("id") == select_id:
                        select_custom_food(food)
                        break
            elif selected_custom.get("food"):
                for food in foods:
                    if food.get("id") == selected_custom["food"].get("id"):
                        select_custom_food(food)
                        break
                else:
                    select_custom_food(None)
            refresh_custom_library()


        def on_tab_change(ev):
            page.update()

        def submit(_: ft.ControlEvent):
            meal_value = dialog_meal_dropdown.value or default_meal
            error_text.value = ""

            selected_tab = tabs.selected_index

            if selected_tab == 0:
                food = selected_catalog.get("food")
                grams = parse_float_field(catalog_grams_field, default=None)

                if not food:
                    error_text.value = "Selecciona un alimento del catalogo."
                elif grams is None or grams <= 0:
                    error_text.value = "Ingresa una cantidad valida en gramos."
                else:
                    macros = scale_macros(food, grams)
                    food_ref = {
                        "id": food["id"],
                        "source": food.get("source"),
                        "portion": food.get("portion"),
                        "lookup_name": food["name"],
                    }
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
                            food_ref=food_ref,
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
                            food_ref=food_ref,
                        )
            elif selected_tab == 1:
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
                    save_as_custom = bool(manual_save_checkbox.value)
                    food_ref = None
                    if save_as_custom:
                        target_food = custom_state["current"]
                        if target_food:
                            updated = update_custom_food(
                                target_food["id"],
                                name=name,
                                grams=grams,
                                kcal=kcal or 0.0,
                                p=p_val or 0.0,
                                c=c_val or 0.0,
                                g=g_val or 0.0,
                            )
                            if updated:
                                custom_state["current"] = updated
                                target_food = updated
                        else:
                            target_food = create_custom_food(
                                name=name,
                                grams=grams,
                                kcal=kcal or 0.0,
                                p=p_val or 0.0,
                                c=c_val or 0.0,
                                g=g_val or 0.0,
                            )
                            custom_state["current"] = target_food
                        if target_food:
                            refresh_custom_foods(select_id=target_food["id"])
                            manual_save_checkbox.label = "Actualizar comida definida"
                            manual_save_checkbox.value = True
                            if manual_save_checkbox.page:
                                manual_save_checkbox.update()
                            food_ref = {
                                "id": target_food["id"],
                                "source": "custom",
                                "portion": target_food.get("portion"),
                                "lookup_name": target_food["name"],
                            }
                        else:
                            error_text.value = "No se pudo guardar la comida definida."
                    else:
                        manual_save_checkbox.label = "Guardar como comida definida"
                        manual_save_checkbox.value = False
                        if manual_save_checkbox.page:
                            manual_save_checkbox.update()
                        if current_ref.get("source") == "manual":
                            food_ref = {
                                **current_ref,
                                "lookup_name": name,
                                "portion": {"grams": grams, "description": "ingreso manual"},
                            }
                        else:
                            food_ref = {
                                "id": f"manual-{int(dt.datetime.now().timestamp())}",
                                "source": "manual",
                                "portion": {"grams": grams, "description": "ingreso manual"},
                                "lookup_name": name,
                            }

                    if not error_text.value:
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
            else:
                food = selected_custom.get("food")
                grams = parse_float_field(custom_grams_field, default=None)

                if not food:
                    error_text.value = "Selecciona una comida definida."
                elif grams is None or grams <= 0:
                    error_text.value = "Ingresa una cantidad valida en gramos."
                else:
                    macros = scale_macros(food, grams)
                    food_ref = {
                        "id": food["id"],
                        "source": food.get("source", "custom"),
                        "portion": food.get("portion"),
                        "lookup_name": food["name"],
                    }
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
                            food_ref=food_ref,
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
            page.close(dialog)

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
                manual_save_checkbox,
            ],
            spacing=10,
            tight=True,
        )

        custom_tab_content = ft.Column(
            [
                ft.Row(
                    [
                        ft.Text(
                            "Crea comidas personalizadas para reutilizarlas.",
                            size=12,
                            color=TEXT_MUTED,
                        ),
                        ft.OutlinedButton(
                            "Nueva comida",
                            icon=ft.Icons.ADD,
                            on_click=lambda ev: show_custom_food_form(
                                ev,
                                None,
                                on_saved=lambda target_id: refresh_custom_foods(
                                    select_id=target_id
                                ),
                            ),
                        ),
                    ],
                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                ),
                ft.Text(
                    "Toca una comida para seleccionarla o usa los iconos para editar/eliminar.",
                    size=11,
                    color=TEXT_MUTED,
                ),
                ft.Container(custom_foods_column, height=200),
                custom_selected_text,
                custom_grams_field,
            ],
            spacing=10,
            tight=True,
        )

        tabs = ft.Tabs(
            selected_index=initial_tab_index,
            on_change=on_tab_change,
            tabs=[
                ft.Tab(text="Catalogo", content=catalog_tab_content),
                ft.Tab(text="Manual", content=manual_tab_content),
                ft.Tab(text="Mis comidas", content=custom_tab_content),
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

        page.open(dialog)
        refresh_custom_foods(current_custom_id)

    def confirm_edit(event: ft.ControlEvent, entry_data: dict):
        page_local = event.page

        def proceed_edit(_):
            page_local.close(confirm_dialog)
            open_food_dialog(event, entry_data)

        def cancel_edit(_=None):
            page_local.close(confirm_dialog)

        confirm_dialog = ft.AlertDialog(
            modal=True,
            title=ft.Text("Editar comida"),
            content=ft.Text(
                f"¿Deseas editar {entry_data.get('name', 'esta comida')}?"
            ),
            actions=[
                ft.TextButton("Cancelar", on_click=cancel_edit),
                ft.ElevatedButton("Editar", icon=ft.Icons.EDIT, on_click=proceed_edit),
            ],
            actions_alignment=ft.MainAxisAlignment.END,
        )
        page_local.open(confirm_dialog)

    def confirm_delete(event: ft.ControlEvent, entry_id: str, entry_name: str, meal_key: str):
        page = event.page

        def do_delete(_):
            if entry_id:
                delete_food_entry(entry_id)
            page.close(confirm_dialog)
            page.snack_bar = ft.SnackBar(ft.Text("Comida eliminada"))
            page.snack_bar.open = True
            page.update()
            refresh_entries()

        def cancel(_):
            page.close(confirm_dialog)

        confirm_dialog = ft.AlertDialog(
            modal=True,
            title=ft.Text("Eliminar comida"),
            content=ft.Text(
                f"Estas seguro de eliminar {entry_name} de {_format_meal(meal_key)}?"
            ),
            actions=[
                ft.TextButton("Cancelar", on_click=cancel),
                ft.ElevatedButton("Eliminar", icon=ft.Icons.DELETE, on_click=do_delete, bgcolor=ALERT_RED, color=ft.Colors.WHITE),
            ],
            actions_alignment=ft.MainAxisAlignment.END,
        )
        page.open(confirm_dialog)

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
            ft.Text("Todavía no agregaste comidas hoy.", color=TEXT_MUTED),
        ],
        alignment=ft.MainAxisAlignment.CENTER,
        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
        spacing=8,
    ),
    padding=24,
    border_radius=14,
    bgcolor=ENTRY_GROUP_BG,
    border=ft.border.all(1, "#2C2C2E"),  # ← sólo una línea
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
                                            ft.Text(entry["name"], weight=ft.FontWeight.BOLD, size=13, color=TEXT_PRIMARY),
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
                                                icon_color=PRIMARY_COLOR,
                                                tooltip="Editar",
                                                on_click=lambda ev, data=entry_data: confirm_edit(ev, data),
                                            ),
                                            ft.IconButton(
                                                icon=ft.Icons.DELETE,
                                                icon_color="ALERT_RED",
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
                            border=ft.border.all(1, "#2C2C2E"),
                            content=entry_controls,
                        )
                    )

                entries_column.controls.append(
                    ft.Container(
                        padding=14,
                        border_radius=16,
                        bgcolor=ENTRY_GROUP_BG,
                        border=ft.border.all(1, "#2C2C2E"),
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
                                            color=TEXT_PRIMARY,
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
                border=ft.border.all(1, "#2C2C2E"),
                shadow=ft.BoxShadow(
                    blur_radius=6,
                    spread_radius=0,
                    offset=ft.Offset(0, 2),
                    color="#000000",
                ),
                on_click=lambda e, f=food, g=grams: quick_add(f, g, e.page),
                content=ft.Column(
                    [
                        ft.Text(food["name"], size=13, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                        ft.Text(describe_portion(food), size=11, color=TEXT_MUTED),
                        ft.Text(format_macros(macros_preview), size=11, color=TEXT_PRIMARY),
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

    refresh_custom_library()
    refresh_entries()

    return ft.Column(
        [
            ft.Text(today.strftime("%A %d/%m"), size=18, weight=ft.FontWeight.BOLD, color=TEXT_PRIMARY),
            totals_info_text,
            ft.Text("Resumen diario", size=15, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
            macro_summary_column,
            ft.Text("Comidas frecuentes", size=15, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
            ft.Row(
                [
                    ft.Text("Agregar rapido en:", size=12, color=TEXT_MUTED),
                    quick_meal_dropdown,
                ],
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
            ),
            quick_section_column,
            ft.Row(
                [
                    ft.Text("Tus comidas definidas", size=15, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                    ft.FilledTonalButton(
                        "Crear comida",
                        icon=ft.Icons.ADD,
                        on_click=lambda ev: show_custom_food_form(ev, None),
                    ),
                ],
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
            ),
            ft.Text(
                "Guarda combinaciones listas y agrégalas con un toque.",
                size=11,
                color=TEXT_MUTED,
            ),
            custom_library_column,
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
