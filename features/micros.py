import datetime as dt
from typing import Dict, List

import flet as ft

from data.storage import (
    add_micro_entry,
    delete_micro_entry,
    get_day_entries,
    get_micro_totals,
    list_micro_entries,
    update_micro_entry,
)
from features.micro_presets import MICRO_PRESETS, UNIT_SUGGESTIONS



PRIMARY_GREEN = "#38C544"
CARD_BG = "#1D1F24"
CARD_BORDER = "#2D323C"
TEXT_MUTED = "#A0AEC0"
ACCENT_BG = "#111315"
TEXT_PRIMARY = "#FFFFFF"


def _format_meal_entry_label(entry: Dict) -> str:
    meal = str(entry.get("meal", "")).title() or "Comida"
    name = entry.get("name", "Registro")
    grams = float(entry.get("grams") or 0)
    grams_txt = f" - {grams:.0f} g" if grams else ""
    return f"{meal} - {name}{grams_txt}"


def MicrosView():
    today = dt.date.today()
    selected_date = {"value": today}

    summary_row = ft.ResponsiveRow(run_spacing=12, spacing=12)
    entries_column = ft.Column(spacing=10)
    overview_text = ft.Text("", size=12, color=TEXT_MUTED)

    selected_date_text = ft.Text("", size=13, color=TEXT_MUTED)
    meal_state: Dict[str, Dict] = {"lookup": {}, "options": []}
    editing_entry: Dict[str, Dict | None] = {"entry": None}
    meal_sections_state: Dict[str, Dict[str, List[Dict]]] = {"map": {}}

    def _format_date_label(date_obj: dt.date) -> str:
        return date_obj.strftime("%d/%m/%Y")

    def refresh_summary():
        totals = get_micro_totals(selected_date["value"])
        summary_row.controls.clear()
        for idx, preset in enumerate(MICRO_PRESETS):
            info = totals.get(preset["id"])
            amount = info["amount"] if info else 0.0
            goal = preset.get("goal") or 0.0
            unit = info["unit"] if info else preset["unit"]
            percent = min(amount / goal, 1.0) if goal else 0.0
            summary_row.controls.append(
                _summary_card(
                    label=preset["label"],
                    hint=preset.get("hint", ""),
                    amount=amount,
                    goal=goal,
                    unit=unit,
                    percent=percent,
                )
            )
        if summary_row.page:
            summary_row.update()
        if totals:
            consumed = sum(bucket["amount"] for bucket in totals.values())
            overview_text.value = f"Ingresaste {consumed:.0f} unidades totales el {selected_date_text.value}."
        else:
            overview_text.value = "Todavía no registraste micronutrientes en esta fecha."
        if overview_text.page:
            overview_text.update()

    def refresh_entries():
        entries = list_micro_entries(selected_date["value"])
        entries_column.controls.clear()

        meal_sections: Dict[str, List[Dict]] = {}
        supplements: List[Dict] = []
        for entry in entries:
            if entry.get("kind") == "meal" and entry.get("meal_entry_id"):
                meal_sections.setdefault(entry["meal_entry_id"], []).append(entry)
            else:
                supplements.append(entry)

        meal_sections_state["map"] = meal_sections

        entries_column.controls.append(
            ft.Text("Micros por comida", size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY)
        )
        if meal_sections:
            for meal_id, meal_entries in meal_sections.items():
                entries_column.controls.append(build_meal_section_card(meal_id, meal_entries))
        else:
            entries_column.controls.append(
                ft.Text(
                    "Aun no registraste micronutrientes para tus comidas en esta fecha.",
                    size=12,
                    color=TEXT_MUTED,
                )
            )

        entries_column.controls.append(ft.Divider(color="#2C2C2E"))
        entries_column.controls.append(
            ft.Text("Suplementos", size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY)
        )
        if supplements:
            for entry in supplements:
                entries_column.controls.append(
                    _entry_tile(
                        entry,
                        meal_state["lookup"],
                        on_edit=lambda e, data=entry: open_micro_dialog(data),
                        on_delete=lambda e, entry_id=entry["entry_id"]: remove_entry(entry_id),
                    )
                )
        else:
            entries_column.controls.append(
                ft.Text("No agregaste suplementos en esta fecha.", size=12, color=TEXT_MUTED)
            )

        if entries_column.page:
            entries_column.update()

    def build_meal_section_card(meal_id: str, items: List[Dict]) -> ft.Control:
        meal_entry = meal_state["lookup"].get(meal_id)
        header = _format_meal_entry_label(meal_entry or {})
        total_amount = sum(float(entry.get("amount") or 0.0) for entry in items)
        main_unit = items[0].get("unit") if items else "mg"
        return ft.Container(
            padding=12,
            border_radius=14,
            border=ft.border.all(1, CARD_BORDER),
            bgcolor="#1B1E22",
            content=ft.Column(
                [
                    ft.Text(header, size=13, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                    ft.Text(
                        f"{len(items)} micronutriente(s) - {total_amount:.0f} {main_unit}",
                        size=11,
                        color=TEXT_MUTED,
                    ),
                    ft.Row(
                        [
                            ft.TextButton(
                                "Ver detalle",
                                icon=ft.Icons.REMOVE_RED_EYE_OUTLINED,
                                on_click=lambda _, target_id=meal_id: show_meal_detail(target_id),
                            ),
                            ft.TextButton(
                                "Agregar",
                                icon=ft.Icons.ADD,
                                on_click=lambda _, target_id=meal_id: open_micro_dialog(default_meal_id=target_id),
                            ),
                        ],
                        spacing=6,
                    ),
                ],
                spacing=6,
            ),
        )

    def show_meal_detail(meal_id: str):
        entries = meal_sections_state["map"].get(meal_id, [])
        meal_entry = meal_state["lookup"].get(meal_id)
        header = _format_meal_entry_label(meal_entry or {})
        if not entries:
            _show_toast("Esta comida aun no tiene micronutrientes.")
            return

        def close_detail_dialog():
            page = root.page
            if not page:
                return
            detail_dialog.open = False
            page.update()

        detail_controls: list[ft.Control] = []
        for micro in entries:
            detail_controls.append(
                _entry_tile(
                    micro,
                    meal_state["lookup"],
                    on_edit=lambda e, data=micro: open_micro_dialog(entry=data),
                    on_delete=lambda e, entry_id=micro["entry_id"]: remove_entry(entry_id),
                )
            )

        detail_dialog = ft.AlertDialog(
            modal=True,
            title=ft.Text(header, weight=ft.FontWeight.W_600),
            content=ft.Container(
                width=380,
                height=320,
                content=ft.ListView(controls=detail_controls, spacing=10, padding=0),
            ),
            actions=[
                ft.TextButton("Cerrar", on_click=lambda _: close_detail_dialog()),
                ft.FilledButton(
                    "Agregar micronutriente",
                    icon=ft.Icons.ADD,
                    on_click=lambda _: open_micro_dialog(default_meal_id=meal_id),
                ),
            ],
            actions_alignment=ft.MainAxisAlignment.END,
        )

        page = root.page
        if not page:
            return
        page.dialog = detail_dialog
        detail_dialog.open = True
        page.update()

    def remove_entry(entry_id: str):
        if not delete_micro_entry(entry_id):
            return
        refresh_summary()
        refresh_entries()
        _show_toast("Micronutriente eliminado correctamente.")

    def set_selected_date(date_obj: dt.date):
        selected_date["value"] = date_obj
        selected_date_text.value = _format_date_label(date_obj)
        if selected_date_text.page:
            selected_date_text.update()
        refresh_meal_sources()
        refresh_summary()
        refresh_entries()

    def _show_toast(message: str):
        page = root.page
        if not page:
            return
        page.snack_bar = ft.SnackBar(ft.Text(message))
        page.snack_bar.open = True
        page.update()

    # ----- Date selector menu
    def build_date_menu():
        items = []
        for offset in range(7):
            date_obj = today - dt.timedelta(days=offset)
            label = _format_date_label(date_obj)
            if offset == 0:
                label += " (hoy)"
            elif offset == 1:
                label += " (ayer)"
            items.append(
                ft.PopupMenuItem(
                    text=label,
                    on_click=lambda _, value=date_obj: set_selected_date(value),
                )
            )
        return items

    date_menu = ft.PopupMenuButton(icon=ft.Icons.CALENDAR_MONTH, items=build_date_menu())

    # ----- Add micronutrient dialog controls
    nutrient_field = ft.Dropdown(
        label="Micronutriente",
        options=[ft.dropdown.Option(preset["id"], preset["label"]) for preset in MICRO_PRESETS]
        + [ft.dropdown.Option("custom", "Personalizado")],
        value=MICRO_PRESETS[0]["id"],
        autofocus=True,
        dense=True,
    )
    custom_name_field = ft.TextField(label="Nombre personalizado", visible=False)
    amount_field = ft.TextField(label="Cantidad", hint_text="Ej: 200", keyboard_type=ft.KeyboardType.NUMBER)
    unit_field = ft.TextField(label="Unidad", hint_text="mg / mcg / IU / g / caps")

    def apply_unit_suggestion(value: str):
        unit_field.value = value
        if unit_field.page:
            unit_field.update()

    unit_chips = [
        ft.Chip(label=suggestion, on_click=lambda e, value=suggestion: apply_unit_suggestion(value))
        for suggestion in UNIT_SUGGESTIONS
    ]
    unit_chip_row = ft.Row(unit_chips, spacing=6, wrap=True, run_spacing=6)

    entry_type_group = ft.RadioGroup(
        value="meal",
        content=ft.Row(
            [
                ft.Radio(value="meal", label="Desde comida"),
                ft.Radio(value="supplement", label="Suplemento"),
            ],
            spacing=12,
        ),
    )
    meal_dropdown = ft.Dropdown(
        label="Asociar a comida",
        options=[],
        visible=True,
        dense=True,
    )
    meal_hint_text = ft.Text("", size=11, color=TEXT_MUTED)

    source_field = ft.TextField(label="Fuente", hint_text="Suplemento, comida, etc.")
    notes_field = ft.TextField(label="Notas", multiline=True, min_lines=2, max_lines=3)

    preset_by_id = {preset["id"]: preset for preset in MICRO_PRESETS}

    def ensure_nutrient_option(option_id: str, label: str | None):
        ids = {opt.text for opt in nutrient_field.options}
        if option_id and option_id not in ids:
            nutrient_field.options.append(ft.dropdown.Option(option_id, label or option_id.title()))

    def fill_unit_for_selection(preserve_unit: bool = False):
        value = nutrient_field.value
        preset = preset_by_id.get(value)
        if preset:
            if not preserve_unit:
                unit_field.value = preset["unit"]
            custom_name_field.visible = False
            notes_field.hint_text = preset.get("hint", "")
        else:
            if not preserve_unit:
                unit_field.value = "mg"
            custom_name_field.visible = True
            notes_field.hint_text = ""
        for ctrl in (unit_field, custom_name_field, notes_field):
            if ctrl.page:
                ctrl.update()

    fill_unit_for_selection()

    def on_nutrient_change(_):
        fill_unit_for_selection()

    nutrient_field.on_change = on_nutrient_change

    def apply_entry_kind(kind: str, *, enforce: bool = True):
        allowed = {"meal", "supplement"}
        kind = kind if kind in allowed else "supplement"
        has_meals = bool(meal_state.get("options"))
        if enforce and kind == "meal" and not has_meals:
            kind = "supplement"
        entry_type_group.value = kind
        meal_dropdown.visible = kind == "meal" and has_meals
        if not meal_dropdown.visible:
            meal_dropdown.value = None
        meal_hint_text.value = ("Asocia esta toma a una comida registrada." if meal_dropdown.visible else "Registro independiente (capsulas/pastillas).")
        for ctrl in (entry_type_group, meal_dropdown, meal_hint_text):
            if ctrl.page:
                ctrl.update()

    def refresh_meal_sources():
        meals = get_day_entries(selected_date["value"])
        lookup = {}
        options = []
        for entry in meals:
            entry_id = entry.get("entry_id")
            if not entry_id:
                continue
            lookup[entry_id] = entry
            options.append(ft.dropdown.Option(_format_meal_entry_label(entry), entry_id))
        meal_state["lookup"] = lookup
        meal_state["options"] = options
        meal_dropdown.options = options
        has_options = bool(options)
        if meal_dropdown.value and meal_dropdown.value not in lookup:
            meal_dropdown.value = options[0].key if has_options else None
        meal_dropdown.disabled = not has_options
        if meal_dropdown.page:
            meal_dropdown.update()
        apply_entry_kind(entry_type_group.value, enforce=False)

    entry_type_group.on_change = lambda e: apply_entry_kind(e.control.value)

    def reset_form():
        editing_entry["entry"] = None
        nutrient_field.value = MICRO_PRESETS[0]["id"]
        custom_name_field.value = ""
        custom_name_field.visible = False
        amount_field.value = ""
        unit_field.value = MICRO_PRESETS[0]["unit"]
        source_field.value = ""
        notes_field.value = ""
        meal_dropdown.value = None
        entry_type_group.value = "meal" if meal_state.get("options") else "supplement"
        for ctrl in (
            nutrient_field,
            custom_name_field,
            amount_field,
            unit_field,
            source_field,
            notes_field,
            meal_dropdown,
            entry_type_group,
        ):
            if ctrl.page:
                ctrl.update()
        fill_unit_for_selection()
        apply_entry_kind(entry_type_group.value, enforce=False)

    dialog_title = ft.Text("Registrar micronutriente")
    save_button = ft.FilledButton("Guardar", on_click=lambda _: save_micro_entry())

    micro_dialog = ft.AlertDialog(
        modal=True,
        title=dialog_title,
        content=ft.Container(
            width=380,
            content=ft.Column(
                [
                    nutrient_field,
                    custom_name_field,
                    amount_field,
                    ft.Column([unit_field, unit_chip_row], spacing=6),
                    entry_type_group,
                    meal_dropdown,
                    meal_hint_text,
                    source_field,
                    notes_field,
                    ft.Text(
                        "Las metas diarias son referenciales y pueden variar segun tu plan.",
                        size=11,
                        color=TEXT_MUTED,
                    ),
                ],
                tight=True,
                spacing=10,
            ),
        ),
        actions=[
            ft.TextButton("Cancelar", on_click=lambda _: close_micro_dialog()),
            save_button,
        ],
        actions_alignment=ft.MainAxisAlignment.END,
    )

    def open_micro_dialog(entry: Dict | None = None, default_meal_id: str | None = None):
        refresh_meal_sources()
        if entry:
            editing_entry["entry"] = entry
            dialog_title.value = "Editar micronutriente"
            save_button.text = "Actualizar"
            ensure_nutrient_option(entry.get("nutrient") or "custom", entry.get("label"))
            nutrient_field.value = entry.get("nutrient") or "custom"
            if nutrient_field.value == "custom":
                custom_name_field.value = entry.get("label", "")
            amount_field.value = f"{float(entry.get('amount', 0)):.0f}"
            unit_field.value = entry.get("unit") or "mg"
            source_field.value = entry.get("source") or ""
            notes_field.value = entry.get("notes") or ""
            entry_type_group.value = entry.get("kind") or ("meal" if entry.get("meal_entry_id") else "supplement")
            meal_dropdown.value = entry.get("meal_entry_id")
            if entry_type_group.value == "meal" and meal_dropdown.value:
                option_ids = {opt.key or opt.text for opt in meal_dropdown.options}
                if meal_dropdown.value not in option_ids:
                    meal_entry = meal_state["lookup"].get(meal_dropdown.value)
                    meal_label = _format_meal_entry_label(meal_entry) if meal_entry else "Comida eliminada"
                    meal_dropdown.options.append(ft.dropdown.Option(meal_label, meal_dropdown.value))
            fill_unit_for_selection(preserve_unit=True)
            apply_entry_kind(entry_type_group.value, enforce=False)
        else:
            dialog_title.value = "Registrar micronutriente"
            save_button.text = "Guardar"
            reset_form()
            if default_meal_id:
                entry_type_group.value = "meal"
                meal_dropdown.value = default_meal_id
        apply_entry_kind(entry_type_group.value, enforce=False)
        if dialog_title.page:
            dialog_title.update()
        if save_button.page:
            save_button.update()
        page = root.page
        if not page:
            return
        page.dialog = micro_dialog
        micro_dialog.open = True
        page.update()

    def close_micro_dialog():
        page = root.page
        if not page:
            return
        micro_dialog.open = False
        page.update()

    def save_micro_entry():
        try:
            amount_value = float(amount_field.value or 0)
        except ValueError:
            amount_field.error_text = "Ingresa un numero valido"
            if amount_field.page:
                amount_field.update()
            return
        if amount_value <= 0:
            amount_field.error_text = "La cantidad debe ser mayor a 0"
            if amount_field.page:
                amount_field.update()
            return
        amount_field.error_text = None

        nutrient_value = nutrient_field.value or "custom"
        preset = preset_by_id.get(nutrient_value)
        label = preset["label"] if preset else (custom_name_field.value or "Micronutriente personalizado")
        if not label:
            custom_name_field.error_text = "Ingresa el nombre del micronutriente"
            custom_name_field.update()
            return
        custom_name_field.error_text = None
        unit_value = unit_field.value or (preset["unit"] if preset else "mg")
        entry_kind = entry_type_group.value if meal_dropdown.visible else "supplement"
        meal_entry_id = meal_dropdown.value if entry_kind == "meal" else None
        if entry_kind == "meal" and not meal_entry_id:
            meal_hint_text.value = "Elegi una comida del dia para asociar este registro."
            if meal_hint_text.page:
                meal_hint_text.update()
            return
        meal_hint_text.value = ("Asocia esta toma a una comida registrada." if entry_kind == "meal" else meal_hint_text.value)
        if meal_hint_text.page:
            meal_hint_text.update()

        current = editing_entry["entry"]
        if current:
            update_micro_entry(
                current.get("entry_id"),
                label=label,
                amount=amount_value,
                unit=unit_value,
                nutrient_id=nutrient_value,
                source=source_field.value,
                notes=notes_field.value,
                meal_entry_id=meal_entry_id,
                kind=entry_kind,
            )
            message = "Micronutriente actualizado."
        else:
            add_micro_entry(
                selected_date["value"],
                nutrient_value,
                label,
                amount_value,
                unit_value,
                source_field.value,
                notes_field.value,
                meal_entry_id=meal_entry_id,
                kind=entry_kind,
            )
            message = "Micronutriente guardado."
        close_micro_dialog()
        refresh_summary()
        refresh_entries()
        _show_toast(message)
    action_row = ft.Row(
        [
            ft.Column(
                [
                    ft.Text("Micronutrientes", size=20, weight=ft.FontWeight.W_600),
                    ft.Row(
                        [
                            ft.Text("Día seleccionado:", size=12, color=TEXT_MUTED),
                            selected_date_text,
                        ],
                        spacing=6,
                        vertical_alignment=ft.CrossAxisAlignment.CENTER,
                    ),
                ],
                spacing=2,
                expand=True,
            ),
            date_menu,
            ft.FilledButton("Agregar", icon=ft.Icons.ADD, on_click=lambda _: open_micro_dialog()),
        ],
        alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
        vertical_alignment=ft.CrossAxisAlignment.START,
    )

    root = ft.Container(
        expand=True,
        padding=ft.Padding(18, 18, 18, 26),
        content=ft.Column(
            [
                action_row,
                ft.Text("Seguimiento de vitaminas y minerales diarios.", size=12, color=TEXT_MUTED),
                ft.Container(height=12),
                overview_text,
                ft.Container(height=12),
                summary_row,
                ft.Container(height=18),
                ft.Text("Registros del día", size=16, weight=ft.FontWeight.W_600),
                entries_column,
            ],
            spacing=12,
            expand=True,
            scroll=ft.ScrollMode.AUTO,
        ),
    )

    def _on_mount(_):
        set_selected_date(today)

    root.on_mount = _on_mount
    return root


def _summary_card(*, label: str, hint: str, amount: float, goal: float, unit: str, percent: float):
    percent = max(0.0, min(percent, 1.0))
    goal_text = f"{goal:.0f} {unit}" if goal else "Meta sin definir"
    return ft.Container(
        col={"xs": 6, "sm": 4, "md": 3},
        bgcolor=CARD_BG,
        border=ft.border.all(1, CARD_BORDER),
        border_radius=14,
        padding=12,
        content=ft.Column(
            [
                ft.Text(label, size=13, weight=ft.FontWeight.W_600),
                ft.Text(hint, size=11, color=TEXT_MUTED, max_lines=2, overflow=ft.TextOverflow.ELLIPSIS),
                ft.Text(f"{amount:.0f} {unit}", size=18, weight=ft.FontWeight.W_600, color=PRIMARY_GREEN),
                ft.Text(f"Objetivo: {goal_text}", size=11, color=TEXT_MUTED),
                ft.ProgressBar(
                    value=percent,
                    bgcolor="#2B2F38",
                    color=PRIMARY_GREEN,
                    height=4,
                    width=float("inf"),
                ),
            ],
            spacing=4,
        ),
    )


def _entry_tile(entry: Dict, meal_lookup: Dict[str, Dict], on_edit, on_delete):
    label = entry.get("label", "Micronutriente")
    amount = float(entry.get("amount") or 0.0)
    unit = entry.get("unit") or "mg"
    source = entry.get("source") or "Sin fuente"
    notes = entry.get("notes") or ""
    timestamp = entry.get("updated_at") or entry.get("created_at") or ""
    meal_entry_id = entry.get("meal_entry_id")
    meal_entry = meal_lookup.get(meal_entry_id)
    meal_context = None
    if meal_entry:
        meal_context = _format_meal_entry_label(meal_entry)
    elif meal_entry_id:
        meal_context = "Comida asociada (no encontrada)"
    subtitle_parts = [source]
    if notes:
        subtitle_parts.append(notes)
    subtitle = " | ".join(part for part in subtitle_parts if part)
    kind = (entry.get("kind") or ("meal" if meal_entry_id else "supplement")).lower()
    badge_text = "Suplemento" if kind == "supplement" else "Comida"

    return ft.Container(
        bgcolor=ACCENT_BG,
        border_radius=14,
        border=ft.border.all(1, CARD_BORDER),
        padding=12,
        content=ft.Row(
            [
                ft.Column(
                    [
                        ft.Row(
                            [
                                ft.Text(label, size=14, weight=ft.FontWeight.W_600),
                                ft.Container(
                                    padding=ft.padding.symmetric(horizontal=8, vertical=2),
                                    border_radius=12,
                                    bgcolor="#1F242C",
                                    content=ft.Text(badge_text, size=10, color=TEXT_MUTED),
                                ),
                            ],
                            spacing=8,
                            vertical_alignment=ft.CrossAxisAlignment.CENTER,
                        ),
                        ft.Text(subtitle, size=12, color=TEXT_MUTED),
                        *(
                            [ft.Text(f"Comida: {meal_context}", size=11, color=TEXT_MUTED)]
                            if meal_context
                            else []
                        ),
                        ft.Text(timestamp[:16].replace("T", " "), size=11, color=TEXT_MUTED),
                    ],
                    spacing=4,
                    expand=True,
                ),
                ft.Column(
                    [
                        ft.Text(f"{amount:.0f}", size=20, weight=ft.FontWeight.W_600, color=PRIMARY_GREEN),
                        ft.Text(unit, size=12, color=TEXT_MUTED),
                    ],
                    horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                ),
                ft.Row(
                    [
                        ft.IconButton(icon=ft.Icons.EDIT_OUTLINED, tooltip="Editar", on_click=on_edit),
                        ft.IconButton(icon=ft.Icons.DELETE_OUTLINE, tooltip="Eliminar", on_click=on_delete),
                    ],
                    spacing=4,
                ),
            ],
            alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
            vertical_alignment=ft.CrossAxisAlignment.CENTER,
        ),
    )
