
import datetime as dt
import uuid
from typing import Dict, List

import flet as ft

from data.storage import create_workout, list_workouts

BG_SURFACE = "#26324A"
TEXT_PRIMARY = "#FFFFFF"
TEXT_MUTED = "#A0A8C2"
ACCENT = "#5AC8FA"
BORDER_COLOR = "#33415C"

DAY_OPTIONS = [
    ("lunes", "Lunes"),
    ("martes", "Martes"),
    ("miercoles", "Miercoles"),
    ("jueves", "Jueves"),
    ("viernes", "Viernes"),
    ("sabado", "Sabado"),
    ("domingo", "Domingo"),
]

MUSCLE_GROUPS = [
    "Pecho",
    "Espalda",
    "Piernas",
    "Hombros",
    "Biceps",
    "Triceps",
    "Core",
]


def _surface(content: ft.Control, *, padding: int = 16) -> ft.Container:
    return ft.Container(
        padding=padding,
        border_radius=16,
        bgcolor=BG_SURFACE,
        border=ft.border.all(1, BORDER_COLOR),
        content=content,
    )


def _new_entry() -> Dict:
    return {"id": str(uuid.uuid4()), "name": "", "muscle": None}


def _start_of_week(reference: dt.date) -> dt.date:
    weekday = reference.weekday()
    return reference - dt.timedelta(days=weekday)


def WorkoutsView() -> ft.Control:
    today = dt.date.today()
    week_start = {"value": _start_of_week(today)}
    day_entries: Dict[str, List[Dict]] = {day: [] for day, _ in DAY_OPTIONS}

    status_text = ft.Text("", size=12, color=ft.Colors.RED)
    history_column = ft.Column(spacing=10)

    week_start_field = ft.TextField(label="Semana (YYYY-MM-DD)", value=str(week_start["value"]), width=180)
    notes_field = ft.TextField(label="Notas generales", multiline=True, min_lines=2, expand=True)

    day_cards: Dict[str, ft.Column] = {}
    day_headers: Dict[str, ft.Text] = {}

    def show_status(message: str, color: str = ft.Colors.RED):
        status_text.value = message
        status_text.color = color
        if status_text.page:
            status_text.update()

    def parse_week_start() -> bool:
        raw = (week_start_field.value or "").strip()
        try:
            week_start["value"] = dt.date.fromisoformat(raw)
            return True
        except ValueError:
            show_status("Fecha invalida. Usa YYYY-MM-DD.")
            return False

    def day_date(day_index: int) -> dt.date:
        return week_start["value"] + dt.timedelta(days=day_index)

    def refresh_day_headers():
        for index, (day_key, label) in enumerate(DAY_OPTIONS):
            header = day_headers.get(day_key)
            if header is not None:
                header.value = f"{label} · {day_date(index).strftime('%d/%m')}"
                if header.page:
                    header.update()

    def update_entry(day_key: str, entry_id: str, field: str, value: str | None):
        for entry in day_entries.get(day_key, []):
            if entry["id"] == entry_id:
                entry[field] = value
                break

    def remove_entry(day_key: str, entry_id: str):
        entries = day_entries.get(day_key, [])
        day_entries[day_key] = [entry for entry in entries if entry["id"] != entry_id]
        render_day(day_key)

    def render_day(day_key: str):
        column = day_cards[day_key]
        column.controls.clear()
        entries = day_entries.get(day_key, [])
        if not entries:
            column.controls.append(
                ft.Text("Sin ejercicios para este dia.", size=12, color=TEXT_MUTED)
            )
        else:
            for entry in entries:
                name_field = ft.TextField(
                    label="Ejercicio",
                    value=entry.get("name", ""),
                    expand=True,
                    on_change=lambda e, dk=day_key, eid=entry["id"]: update_entry(dk, eid, "name", e.control.value),
                )
                muscle_dropdown = ft.Dropdown(
                    label="Grupo muscular",
                    width=180,
                    value=entry.get("muscle"),
                    options=[ft.dropdown.Option(m) for m in MUSCLE_GROUPS],
                    on_change=lambda e, dk=day_key, eid=entry["id"]: update_entry(dk, eid, "muscle", e.control.value),
                )
                remove_button = ft.IconButton(
                    icon=ft.Icons.DELETE_OUTLINED,
                    icon_color=ft.Colors.RED,
                    tooltip="Eliminar",
                    on_click=lambda e, dk=day_key, eid=entry["id"]: remove_entry(dk, eid),
                )
                column.controls.append(ft.Row([name_field, muscle_dropdown, remove_button], spacing=10))
        add_button = ft.TextButton(
            "Agregar ejercicio",
            icon=ft.Icons.ADD,
            on_click=lambda e, dk=day_key: add_entry(dk),
        )
        column.controls.append(add_button)
        if column.page:
            column.update()

    def add_entry(day_key: str):
        day_entries[day_key].append(_new_entry())
        render_day(day_key)

    def refresh_history():
        history_column.controls.clear()
        workouts = list_workouts(limit=7)
        if not workouts:
            history_column.controls.append(
                _surface(ft.Text("Aun no registraste sesiones.", size=12, color=TEXT_MUTED))
            )
        else:
            for workout in workouts:
                date_txt = dt.date.fromisoformat(workout.get("date")).strftime("%d/%m/%Y")
                exercises = workout.get("exercises", [])
                history_column.controls.append(
                    _surface(
                        ft.Column(
                            [
                                ft.Text(workout.get("title", "Sesion"), size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                                ft.Text(date_txt, size=11, color=TEXT_MUTED),
                                ft.Text(f"{len(exercises)} ejercicios", size=11, color=TEXT_MUTED),
                            ],
                            spacing=6,
                        )
                    )
                )
        if history_column.page:
            history_column.update()

    def clear_entries():
        for day_key in day_entries:
            day_entries[day_key] = []
            render_day(day_key)

    def handle_save(_):
        if not parse_week_start():
            return
        saved_any = False
        for index, (day_key, label) in enumerate(DAY_OPTIONS):
            entries = [entry for entry in day_entries[day_key] if entry.get("name")] 
            if not entries:
                continue
            payload = []
            for entry in entries:
                payload.append(
                    {
                        "name": entry["name"],
                        "muscle": entry.get("muscle"),
                        "sets": [],
                    }
                )
            workout_date = day_date(index)
            create_workout(
                date=workout_date,
                title=f"{label} {workout_date.strftime('%d/%m')}",
                muscle_groups=[entry.get("muscle") for entry in entries if entry.get("muscle")],
                exercises=payload,
                notes=notes_field.value,
            )
            saved_any = True
        if saved_any:
            show_status("Plan semanal guardado.", ft.Colors.GREEN)
            clear_entries()
            refresh_history()
            notes_field.value = ""
            if notes_field.page:
                notes_field.update()
        else:
            show_status("Agrega ejercicios antes de guardar.")

    week_start_field.on_change = lambda e: (parse_week_start(), refresh_day_headers())

    header_card = ft.Container(
        padding=20,
        border_radius=18,
        gradient=ft.LinearGradient(
            begin=ft.Alignment(-1, -1),
            end=ft.Alignment(1, 1),
            colors=["#2F3E5B", "#1F2C45"],
        ),
        shadow=ft.BoxShadow(blur_radius=18, color="#00000066", offset=ft.Offset(0, 6)),
        content=ft.Column(
            [
                ft.Text("Planificador semanal", size=20, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                ft.Text(
                    "Define para cada dia los ejercicios y el grupo muscular que trabajas.",
                    size=13,
                    color=TEXT_MUTED,
                ),
            ],
            spacing=6,
        ),
    )

    day_cards_container = []
    for index, (day_key, label) in enumerate(DAY_OPTIONS):
        header = ft.Text(label, size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY)
        day_headers[day_key] = header
        column = ft.Column(spacing=8)
        day_cards[day_key] = column
        day_cards_container.append(
            _surface(
                ft.Column(
                    [
                        header,
                        column,
                    ],
                    spacing=12,
                ),
                padding=18,
            )
        )
        render_day(day_key)

    parse_week_start()
    refresh_day_headers()
    refresh_history()

    return ft.Column(
        controls=[
            header_card,
            status_text,
            _surface(ft.Row([week_start_field, notes_field], spacing=12, wrap=True)),
            ft.Text("Ejercicios por dia", size=15, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
            ft.Column(day_cards_container, spacing=12),
            ft.FilledButton("Guardar plan semanal", icon=ft.Icons.SAVE, on_click=handle_save),
            ft.Text("Historial de sesiones", size=15, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
            history_column,
        ],
        spacing=16,
        expand=True,
        scroll=ft.ScrollMode.AUTO,
    )
