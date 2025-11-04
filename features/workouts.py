import datetime as dt
from collections import defaultdict
from typing import Dict, List, Optional

import flet as ft

from data.storage import create_workout, list_workouts


TEXT_PRIMARY = "#FFFFFF"
TEXT_MUTED = "#8E8E93"
CARD_BG = "#1F2636"
CARD_BORDER = "#2C3345"
ACCENT = "#5AC8FA"


MUSCLE_GROUPS = [
    "Pectoral",
    "Dorsal/Espalda",
    "Deltoides",
    "Piernas/Cuádriceps",
    "Isquios/Femorales",
    "Glúteos",
    "Pantorrillas",
    "Bíceps",
    "Tríceps",
    "Core/Abdomen",
    "Antebrazo",
    "Trapecio",
]

DEFAULT_EXERCISES: Dict[str, List[str]] = {
    "Pectoral": ["Press banca plano", "Press inclinado mancuernas", "Aperturas en polea"],
    "Dorsal/Espalda": ["Dominadas", "Remo con barra", "Jalón al pecho"],
    "Deltoides": ["Press militar", "Elevaciones laterales", "Pájaros"],
    "Piernas/Cuádriceps": ["Sentadilla back", "Prensa", "Extensiones"],
    "Isquios/Femorales": ["Peso muerto rumano", "Curl femoral"],
    "Glúteos": ["Hip thrust", "Zancadas"],
    "Pantorrillas": ["Elevación de talones", "Donkey raises"],
    "Bíceps": ["Curl barra", "Curl mancuernas alterno"],
    "Tríceps": ["Extensión en polea", "Press cerrado"],
    "Core/Abdomen": ["Plancha", "Crunch cable"],
    "Antebrazo": ["Curl muñeca"],
    "Trapecio": ["Encogimientos"],
}

TEMPLATES: Dict[str, Dict[str, List[str]]] = {
    "Push": {
        "Pectoral": ["Press banca plano", "Press inclinado mancuernas"],
        "Deltoides": ["Press militar", "Elevaciones laterales"],
        "Tríceps": ["Extensión en polea"],
    },
    "Pull": {
        "Dorsal/Espalda": ["Dominadas", "Remo con barra"],
        "Bíceps": ["Curl barra"],
        "Trapecio": ["Encogimientos"],
    },
    "Legs": {
        "Piernas/Cuádriceps": ["Sentadilla back", "Prensa"],
        "Isquios/Femorales": ["Peso muerto rumano", "Curl femoral"],
        "Pantorrillas": ["Elevación de talones"],
        "Glúteos": ["Hip thrust"],
    },
    "Upper": {
        "Pectoral": ["Press banca plano"],
        "Dorsal/Espalda": ["Remo con barra"],
        "Deltoides": ["Press militar"],
        "Bíceps": ["Curl barra"],
        "Tríceps": ["Extensión en polea"],
    },
    "Lower": {
        "Piernas/Cuádriceps": ["Sentadilla back"],
        "Isquios/Femorales": ["Peso muerto rumano"],
        "Glúteos": ["Hip thrust"],
        "Pantorrillas": ["Elevación de talones"],
    },
    "Full": {
        "Pectoral": ["Press banca plano"],
        "Dorsal/Espalda": ["Dominadas"],
        "Piernas/Cuádriceps": ["Sentadilla back"],
        "Deltoides": ["Elevaciones laterales"],
        "Core/Abdomen": ["Plancha"],
    },
}

EXERCISE_IMAGES: Dict[str, str] = {
    # Mapear ejercicio -> ruta relativa dentro de assets/.
    # Ejemplo: "Press banca plano": "exercises/press_banca_plano.png",
}


def _today() -> str:
    return dt.date.today().isoformat()


def _parse_date(value: Optional[str]) -> Optional[dt.date]:
    if not value:
        return None
    try:
        return dt.date.fromisoformat(value)
    except ValueError:
        return None


def _calc_e1rm(weight: float, reps: int) -> float:
    if weight <= 0 or reps <= 0:
        return 0.0
    return round(weight * (1 + reps / 30.0), 1)


def _card(title: str, controls: List[ft.Control]) -> ft.Container:
    return ft.Container(
        bgcolor=CARD_BG,
        border_radius=18,
        border=ft.border.all(1, CARD_BORDER),
        padding=18,
        content=ft.Column(
            [
                ft.Row(
                    [ft.Text(title, size=16, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY)],
                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                ),
                ft.Column(controls, spacing=12),
            ],
            spacing=16,
        ),
    )


def WorkoutsView() -> ft.Control:
    state: Dict[str, object] = {
        "workouts": list_workouts(),
        "log_rows": [],
    }

    # ---------- Helpers ----------

    def refresh_workouts():
        state["workouts"] = list_workouts()
        rebuild_exercise_options()

    def all_exercise_names() -> List[str]:
        names = set()
        for group, values in DEFAULT_EXERCISES.items():
            names.update(values)
        for workout in state["workouts"]:
            for exercise in workout.get("exercises", []):
                name = exercise.get("name")
                if name:
                    names.add(name)
        return sorted(names)

    # ---------- Status ----------

    status_text = ft.Text("", size=12, color=ft.Colors.GREEN, visible=False)

    def show_status(message: str, color: str = ft.Colors.GREEN):
        status_text.value = message
        status_text.color = color
        status_text.visible = bool(message)
        if status_text.page:
            status_text.update()

    # ---------- LOG TAB ----------

    log_date = ft.TextField(label="Fecha", value=_today(), width=180)
    log_template = ft.Dropdown(
        label="Plantilla (opcional)",
        options=[ft.dropdown.Option(name) for name in TEMPLATES.keys()],
        width=220,
    )
    log_notes = ft.TextField(label="Notas", width=350, expand=True)
    log_sets_container = ft.Column(spacing=10)
    state["log_rows"] = []

    def clear_log_rows():
        state["log_rows"].clear()
        log_sets_container.controls.clear()

    def remove_row(row_data: Dict[str, ft.Control]):
        try:
            state["log_rows"].remove(row_data)
            log_sets_container.controls.remove(row_data["container"])
        except ValueError:
            pass
        if log_sets_container.page:
            log_sets_container.update()

    def build_group_options() -> List[ft.dropdown.Option]:
        return [ft.dropdown.Option(group) for group in MUSCLE_GROUPS]

    def update_exercise_options(dropdown: ft.Dropdown, group: Optional[str], preset: Optional[str] = None):
        dropdown.options = []
        if group:
            candidates = DEFAULT_EXERCISES.get(group, [])
            dropdown.options = [ft.dropdown.Option(ex) for ex in candidates]
        if preset and preset not in [opt.key for opt in dropdown.options]:
            dropdown.options.append(ft.dropdown.Option(preset))
        if dropdown.page:
            dropdown.update()

    def add_log_row(preset_group: Optional[str] = None, preset_exercise: Optional[str] = None):
        group_dropdown = ft.Dropdown(label="Grupo muscular", width=200, options=build_group_options())
        exercise_dropdown = ft.Dropdown(label="Ejercicio", width=240)
        weight_field = ft.TextField(label="Peso (kg)", width=120, keyboard_type=ft.KeyboardType.NUMBER, text_align=ft.TextAlign.RIGHT)
        reps_field = ft.TextField(label="Reps", width=100, keyboard_type=ft.KeyboardType.NUMBER, text_align=ft.TextAlign.RIGHT)
        rir_field = ft.TextField(label="RIR", width=100, keyboard_type=ft.KeyboardType.NUMBER, text_align=ft.TextAlign.RIGHT)
        notes_field = ft.TextField(label="Notas set", width=220)
        e1rm_text = ft.Text("e1RM: -", color=TEXT_MUTED, size=11)
        image_preview = ft.Container(
            width=72,
            height=72,
            border_radius=12,
            bgcolor="#242D3D",
            alignment=ft.alignment.center,
        )

        def recalc(_=None):
            try:
                weight = float(weight_field.value or 0)
                reps = int(reps_field.value or 0)
            except ValueError:
                weight = 0
                reps = 0
            e1rm = _calc_e1rm(weight, reps)
            e1rm_text.value = f"e1RM: {e1rm:.1f} kg" if e1rm else "e1RM: -"
            if e1rm_text.page:
                e1rm_text.update()

        weight_field.on_change = recalc
        reps_field.on_change = recalc

        def render_image(src: Optional[str]):
            if src:
                image_preview.content = ft.Image(src=src, width=72, height=72, fit=ft.ImageFit.COVER)
            else:
                image_preview.content = ft.Icon(ft.Icons.FITNESS_CENTER, size=32, color=TEXT_MUTED)
            if image_preview.page:
                image_preview.update()

        def on_group_change(_=None):
            update_exercise_options(exercise_dropdown, group_dropdown.value, preset_exercise)
            on_exercise_change()

        group_dropdown.on_change = on_group_change
        group_dropdown.value = preset_group or (MUSCLE_GROUPS[0] if MUSCLE_GROUPS else None)
        on_group_change()
        if preset_exercise:
            exercise_dropdown.value = preset_exercise

        def on_exercise_change(_=None):
            render_image(EXERCISE_IMAGES.get(exercise_dropdown.value or ""))

        exercise_dropdown.on_change = on_exercise_change
        render_image(EXERCISE_IMAGES.get(preset_exercise or exercise_dropdown.value or ""))

        remove_button = ft.IconButton(
            icon=ft.Icons.DELETE_OUTLINE,
            tooltip="Eliminar fila",
            icon_color=ft.Colors.RED,
        )

        row_controls = ft.Row(
            [
                group_dropdown,
                exercise_dropdown,
                weight_field,
                reps_field,
                rir_field,
                notes_field,
                e1rm_text,
                image_preview,
                remove_button,
            ],
            wrap=True,
            spacing=8,
        )
        container = ft.Container(
            bgcolor="#FFFFFF0D",
            padding=12,
            border_radius=12,
            content=row_controls,
        )

        row_data = {
            "container": container,
            "group": group_dropdown,
            "exercise": exercise_dropdown,
            "weight": weight_field,
            "reps": reps_field,
            "rir": rir_field,
            "notes": notes_field,
        }
        remove_button.on_click = lambda _: remove_row(row_data)

        state["log_rows"].append(row_data)
        log_sets_container.controls.append(container)
        if log_sets_container.page:
            log_sets_container.update()

    def load_template_into_log(template_name: str):
        clear_log_rows()
        mapping = TEMPLATES.get(template_name, {})
        for group, exercises in mapping.items():
            for exercise in exercises:
                add_log_row(group, exercise)
        if not mapping:
            add_log_row()
        if log_sets_container.page:
            log_sets_container.update()

    def handle_template_change(_):
        tpl = log_template.value
        if tpl:
            load_template_into_log(tpl)
        else:
            # keep existing rows
            pass

    log_template.on_change = handle_template_change
    add_log_row()

    def handle_save_workout(_):
        date_value = (log_date.value or _today()).strip()
        if not _parse_date(date_value):
            show_status("Fecha inválida. Usa YYYY-MM-DD.", ft.Colors.RED)
            return

        entries = []
        for row in state["log_rows"]:
            group = row["group"].value
            exercise = (row["exercise"].value or "").strip()
            weight_val = row["weight"].value or ""
            reps_val = row["reps"].value or ""
            rir_val = row["rir"].value or ""
            notes_val = (row["notes"].value or "").strip()
            if not exercise:
                continue
            try:
                weight = float(weight_val)
                reps = int(reps_val)
            except ValueError:
                show_status("Peso y reps deben ser números válidos.", ft.Colors.RED)
                return
            if weight <= 0 or reps <= 0:
                show_status("Peso y reps deben ser mayores a cero.", ft.Colors.RED)
                return
            try:
                rir = int(rir_val) if rir_val else None
            except ValueError:
                show_status("RIR debe ser un número entero.", ft.Colors.RED)
                return
            entries.append(
                {
                    "group": group,
                    "exercise": exercise,
                    "weight": weight,
                    "reps": reps,
                    "rir": rir,
                    "notes": notes_val,
                }
            )

        if not entries:
            show_status("Agrega al menos un ejercicio con peso y reps.", ft.Colors.RED)
            return

        exercises_map: Dict[str, Dict[str, object]] = {}
        for entry in entries:
            data = exercises_map.setdefault(
                entry["exercise"],
                {
                    "name": entry["exercise"],
                    "muscle": entry["group"],
                    "notes": entry["notes"],
                    "sets": [],
                },
            )
            data["sets"].append(
                {
                    "weight": entry["weight"],
                    "reps": entry["reps"],
                    "effort": entry["rir"],
                }
            )
            if entry["notes"] and not data.get("notes"):
                data["notes"] = entry["notes"]

        workout_title = f"{log_template.value} {_parse_date(date_value) or date_value}" if log_template.value else f"Sesión {date_value}"
        muscle_groups = [entry["group"] for entry in entries if entry["group"]]

        create_workout(
            date=date_value,
            title=workout_title,
            muscle_groups=muscle_groups,
            exercises=[dict(value) for value in exercises_map.values()],
            notes=log_notes.value or "",
        )

        show_status("Entrenamiento guardado. Think less. Lift more.")
        refresh_workouts()
        clear_log_rows()
        add_log_row()
        log_notes.value = ""
        if log_notes.page:
            log_notes.update()
        refresh_history()
        refresh_progress()

    log_actions = ft.Row(
        [
            ft.ElevatedButton("Agregar fila", icon=ft.Icons.ADD, on_click=lambda _: add_log_row()),
            ft.FilledButton("Guardar entrenamiento", icon=ft.Icons.SAVE, on_click=handle_save_workout),
        ],
        spacing=12,
    )

    log_view = ft.Column(
        [
            ft.Text("LOG RÁPIDO", size=18, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
            ft.Row([log_date, log_template, log_notes], wrap=True, spacing=12),
            ft.Text(
                "Completa sets con peso × reps, RIR y notas. Usa una plantilla para pre-cargar tus movimientos.",
                size=12,
                color=TEXT_MUTED,
            ),
            log_actions,
            ft.Divider(color="#30384C"),
            log_sets_container,
        ],
        spacing=14,
        expand=True,
    )

    # ---------- HISTORY TAB ----------

    filter_exercise = ft.Dropdown(label="Ejercicio", width=260)
    filter_from = ft.TextField(label="Desde (YYYY-MM-DD)", width=160)
    filter_to = ft.TextField(label="Hasta (YYYY-MM-DD)", width=160)
    history_column = ft.Column(spacing=10)

    def rebuild_exercise_options():
        options = [ft.dropdown.Option("")] + [ft.dropdown.Option(name) for name in all_exercise_names()]
        filter_exercise.options = options
        if filter_exercise.page:
            filter_exercise.update()
        progress_exercise.options = [ft.dropdown.Option(name) for name in all_exercise_names()]
        if progress_exercise.page:
            progress_exercise.update()

    def workout_matches_filters(workout: Dict) -> bool:
        exercise_filter = filter_exercise.value or ""
        start_date = _parse_date(filter_from.value)
        end_date = _parse_date(filter_to.value)
        workout_date = _parse_date(workout.get("date"))
        if start_date and (not workout_date or workout_date < start_date):
            return False
        if end_date and (not workout_date or workout_date > end_date):
            return False
        if exercise_filter:
            for exercise in workout.get("exercises", []):
                if exercise.get("name") == exercise_filter:
                    return True
            return False
        return True

    def refresh_history(_=None):
        history_column.controls.clear()
        workouts = [w for w in state["workouts"] if workout_matches_filters(w)]
        if not workouts:
            history_column.controls.append(
                ft.Text("No hay registros que coincidan con el filtro actual.", color=TEXT_MUTED)
            )
        else:
            for workout in workouts:
                chips = []
                for exercise in workout.get("exercises", []):
                    name = exercise.get("name", "Ejercicio")
                    for s in exercise.get("sets", []):
                        rep_text = f"{s.get('weight', 0):.1f}×{int(s.get('reps', 0))}"
                        if s.get("effort") is not None:
                            rep_text += f" · RIR {s.get('effort')}"
                        chips.append(ft.Chip(label=f"{name} · {rep_text}"))
                history_column.controls.append(
                    ft.Container(
                        bgcolor="#FFFFFF0A",
                        border_radius=14,
                        padding=14,
                        content=ft.Column(
                            [
                                ft.Row(
                                    [
                                        ft.Text(
                                            f"{workout.get('date', '')} · {workout.get('title', 'Sesión')}",
                                            weight=ft.FontWeight.W_600,
                                            color=TEXT_PRIMARY,
                                        ),
                                        ft.Container(expand=1),
                                        ft.Text(f"{len(chips)} sets", color=TEXT_MUTED, size=12),
                                    ]
                                ),
                                ft.Wrap(spacing=6, run_spacing=6, controls=chips),
                                ft.Text(workout.get("notes") or "", size=11, color=TEXT_MUTED),
                            ],
                            spacing=10,
                        ),
                    )
                )
        if history_column.page:
            history_column.update()

    history_filters = ft.Row(
        [filter_exercise, filter_from, filter_to, ft.TextButton("Aplicar", on_click=refresh_history)],
        wrap=True,
        spacing=10,
    )
    history_view = ft.Column(
        [
            ft.Text("HISTORIAL", size=18, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
            history_filters,
            ft.Divider(color="#30384C"),
            history_column,
        ],
        spacing=14,
        expand=True,
    )

    # ---------- PROGRESS TAB ----------

    progress_exercise = ft.Dropdown(label="Ejercicio", width=260)
    progress_stats = ft.Column(spacing=10)
    weekly_volume_column = ft.Column(spacing=6)

    def refresh_progress(_=None):
        progress_stats.controls.clear()
        exercise_name = progress_exercise.value
        best_entry = None
        for workout in state["workouts"]:
            workout_date = workout.get("date")
            for exercise in workout.get("exercises", []):
                if exercise_name and exercise.get("name") != exercise_name:
                    continue
                for s in exercise.get("sets", []):
                    weight = float(s.get("weight") or 0)
                    reps = int(s.get("reps") or 0)
                    est = _calc_e1rm(weight, reps)
                    if est <= 0:
                        continue
                    if not best_entry or est > best_entry["e1rm"]:
                        best_entry = {
                            "exercise": exercise.get("name"),
                            "weight": weight,
                            "reps": reps,
                            "e1rm": est,
                            "date": workout_date,
                        }
        if exercise_name:
            if best_entry:
                progress_stats.controls.append(
                    ft.Text(
                        f"Mejor e1RM en {exercise_name}: {best_entry['e1rm']:.1f} kg "
                        f"({best_entry['weight']:.1f}×{best_entry['reps']} el {best_entry['date']})",
                        color=TEXT_PRIMARY,
                    )
                )
            else:
                progress_stats.controls.append(
                    ft.Text("Aún no hay datos para este ejercicio.", color=TEXT_MUTED)
                )
        else:
            progress_stats.controls.append(
                ft.Text("Selecciona un ejercicio para ver tu mejor set (e1RM).", color=TEXT_MUTED)
            )

        weekly_volume_column.controls.clear()
        today = dt.date.today()
        monday = today - dt.timedelta(days=today.weekday())
        sunday = monday + dt.timedelta(days=6)

        volume_by_group: Dict[str, int] = defaultdict(int)
        for workout in state["workouts"]:
            workout_date = _parse_date(workout.get("date"))
            if not workout_date or not (monday <= workout_date <= sunday):
                continue
            for exercise in workout.get("exercises", []):
                group = exercise.get("muscle") or "Otros"
                for s in exercise.get("sets", []):
                    volume_by_group[group] += int(s.get("reps") or 0)
        if not volume_by_group:
            weekly_volume_column.controls.append(
                ft.Text("Aún no registraste volumen esta semana.", color=TEXT_MUTED)
            )
        else:
            for group, reps in sorted(volume_by_group.items(), key=lambda item: item[1], reverse=True):
                weekly_volume_column.controls.append(
                    ft.Row(
                        [
                            ft.Text(group, color=TEXT_PRIMARY),
                            ft.Container(expand=1),
                            ft.Text(f"{reps} reps", color=TEXT_MUTED),
                        ]
                    )
                )
        if progress_stats.page:
            progress_stats.update()
        if weekly_volume_column.page:
            weekly_volume_column.update()

    progress_exercise.on_change = refresh_progress

    progress_view = ft.Column(
        [
            ft.Text("PROGRESO", size=18, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
            ft.Text(
                "Consulta tu mejor set por ejercicio y el volumen semanal por grupo muscular.",
                size=12,
                color=TEXT_MUTED,
            ),
            progress_exercise,
            ft.Divider(color="#30384C"),
            progress_stats,
            ft.Divider(color="#30384C"),
            ft.Text("Volumen semanal (repeticiones)", weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
            weekly_volume_column,
        ],
        spacing=14,
        expand=True,
    )

    # ---------- TEMPLATES TAB ----------

    def use_template(name: str):
        log_template.value = name
        if log_template.page:
            log_template.update()
        load_template_into_log(name)

    templates_column = ft.Column(spacing=12)
    for name, mapping in TEMPLATES.items():
        exercises_summary = " · ".join(f"{group}: {', '.join(exercises)}" for group, exercises in mapping.items())
        templates_column.controls.append(
            _card(
                name,
                [
                    ft.Text(exercises_summary, size=12, color=TEXT_MUTED),
                    ft.FilledTonalButton("Usar en log", icon=ft.Icons.PLAYLIST_ADD, on_click=lambda _, n=name: use_template(n)),
                ],
            )
        )
    if not templates_column.controls:
        templates_column.controls.append(ft.Text("No hay plantillas configuradas.", color=TEXT_MUTED))

    templates_view = ft.Column(
        [
            ft.Text("PLANTILLAS", size=18, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
            ft.Text("Think less. Lift more: carga una plantilla y adapta los números.", size=12, color=TEXT_MUTED),
            templates_column,
        ],
        spacing=14,
        expand=True,
    )

    # ---------- Tabs / layout ----------

    tabs = ft.Tabs(
        tabs=[
            ft.Tab(text="Log"),
            ft.Tab(text="Historial"),
            ft.Tab(text="Progreso"),
            ft.Tab(text="Plantillas"),
        ],
        selected_index=0,
        expand=1,
    )

    # Containers to toggle visibility
    log_container = ft.Container(log_view, data="log", visible=True, expand=True)
    history_container = ft.Container(history_view, data="history", visible=False, expand=True)
    progress_container = ft.Container(progress_view, data="progress", visible=False, expand=True)
    templates_container = ft.Container(templates_view, data="templates", visible=False, expand=True)

    def on_tab_change(e: ft.ControlEvent):
        target = ["log", "history", "progress", "templates"][tabs.selected_index]
        for container in [log_container, history_container, progress_container, templates_container]:
            container.visible = container.data == target
        container_column.update()

    container_column = ft.Column(
        [
            tabs,
            ft.Container(height=8),
            log_container,
            history_container,
            progress_container,
            templates_container,
        ],
        expand=True,
    )

    tabs.on_change = on_tab_change

    root = ft.Column(
        [
            ft.Text("Mis ejercicios · Think less. Lift more.", size=20, weight=ft.FontWeight.W_700, color=TEXT_PRIMARY),
            ft.Text(
                "Registro minimalista con plantillas, historial y progreso.",
                size=12,
                color=TEXT_MUTED,
            ),
            status_text,
            container_column,
        ],
        spacing=14,
        expand=True,
        scroll=ft.ScrollMode.AUTO,
    )

    # Initial data loads
    rebuild_exercise_options()
    refresh_history()
    refresh_progress()

    return root
