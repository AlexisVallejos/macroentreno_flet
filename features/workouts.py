# features/workouts.py
from __future__ import annotations
import os, json, uuid, datetime as dt
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional
import flet as ft

# ===== Compat de iconos/colores (icons vs Icons, colors vs Colors)
ICONS = getattr(ft, "icons", None) or getattr(ft, "Icons", None)


def _resolve_color_source() -> object:
    return getattr(ft, "colors", None) or getattr(ft, "Colors", None)


class _ColorsCompat:
    def __init__(self, raw):
        if raw is None:
            raise AttributeError("Flet colors API is not available")
        self._raw = raw

    def __getattr__(self, name: str):
        if name == "with_opacity":
            return self.with_opacity
        attr = getattr(self._raw, name)
        return getattr(attr, "value", attr)

    @staticmethod
    def with_opacity(opacity: float, color: object) -> str:
        value = getattr(color, "value", color)
        if isinstance(value, str) and value.startswith("#"):
            hex_color = value.lstrip("#")
            if len(hex_color) == 3:
                hex_color = "".join(ch * 2 for ch in hex_color)
            if len(hex_color) == 6:
                r = int(hex_color[0:2], 16)
                g = int(hex_color[2:4], 16)
                b = int(hex_color[4:6], 16)
                return f"rgba({r},{g},{b},{opacity})"
        return value


COLORS = _ColorsCompat(_resolve_color_source())

# ===== Paleta MacrosGym (modo oscuro)
DARK_BG = "#0B0C0E"          # casi negro
CARD_BG = "#121417"          # panel
STROKE = "#1E2126"           # bordes sutiles
TEXT = "#FFFFFF"             # blanco
MUTED = "#8B929D"            # gris
ACCENT = "#22C55E"           # verde macros gym
ACCENT_SOFT = "#1A2A20"      # verde muy oscuro para fondos
DANGER = "#EF4444"           # rojo
WARNING = "#F59E0B"

# ===== Archivo de almacenamiento
DB_PATH = os.path.join("data", "workouts.json")

# ===== Utilidades de fecha (semana en español)
SPANISH_WEEKDAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
SPANISH_WEEKDAYS_LONG = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


def monday_of(date: dt.date) -> dt.date:
    # lunes = 0
    return date - dt.timedelta(days=date.weekday())


def sunday_of(date: dt.date) -> dt.date:
    return monday_of(date) + dt.timedelta(days=6)


def format_spanish_date(d: dt.date) -> str:
    # 03/11/2025
    return f"{d.day:02d}/{d.month:02d}/{d.year}"


def format_week_span(d: dt.date) -> str:
    m = monday_of(d)
    s = sunday_of(d)
    return f"Semana del {SPANISH_WEEKDAYS_SHORT[0].lower()} {m.day}/{m.month} al {SPANISH_WEEKDAYS_SHORT[6].lower()} {s.day}/{s.month}"


# ===== Modelo
@dataclass
class Exercise:
    id: str
    name: str
    muscle_group: str
    equipment: str
    sets: int
    reps: int
    weight: float
    rpe: Optional[float]
    notes: Optional[str]
    favorite: bool
    date: str  # ISO YYYY-MM-DD


# ===== Persistencia
def _ensure_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    if not os.path.exists(DB_PATH):
        with open(DB_PATH, "w", encoding="utf-8") as f:
            json.dump({"exercises": []}, f, ensure_ascii=False, indent=2)


def load_db() -> Dict[str, List[Dict]]:
    _ensure_db()
    try:
        with open(DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"exercises": []}


def save_db(data: Dict[str, List[Dict]]):
    _ensure_db()
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def list_exercises() -> List[Exercise]:
    db = load_db()
    return [Exercise(**e) for e in db.get("exercises", [])]


def add_exercise(ex: Exercise):
    db = load_db()
    db.setdefault("exercises", []).append(asdict(ex))
    save_db(db)


def update_exercise(ex: Exercise):
    db = load_db()
    arr = db.setdefault("exercises", [])
    for i, it in enumerate(arr):
        if it["id"] == ex.id:
            arr[i] = asdict(ex)
            break
    save_db(db)


def delete_exercise(ex_id: str):
    db = load_db()
    arr = db.setdefault("exercises", [])
    arr = [e for e in arr if e["id"] != ex_id]
    db["exercises"] = arr
    save_db(db)


def toggle_favorite(ex_id: str, value: Optional[bool] = None):
    db = load_db()
    arr = db.setdefault("exercises", [])
    for it in arr:
        if it["id"] == ex_id:
            it["favorite"] = (not it.get("favorite", False)) if value is None else bool(value)
            break
    save_db(db)


# ===== UI principal
def WorkoutsView() -> ft.Control:
    # Estado local
    today = dt.date.today()
    state = {
        "current_date": today,                 # fecha "cursor" para la semana
        "selected_week_monday": monday_of(today),
        "selected_day_index": today.weekday(),  # 0..6 (lunes..domingo)
    }

    # ---- Cabecera (título + botón Agregar arriba, estilo móvil)
    def _dialog_layout(page: ft.Page, *, max_width: float = 420, max_height: float = 640):
        win_width = getattr(page, "window_width", 0) or 0
        if win_width:
            width = min(max_width, win_width * 0.92)
            if win_width > 40:
                width = min(width, win_width - 32)
        else:
            width = max_width

        win_height = getattr(page, "window_height", 0) or 0
        height = None
        if max_height is not None:
            if win_height:
                height = min(max_height, win_height * 0.85)
            else:
                height = max_height

        inset = ft.padding.only(left=16, right=16, top=16, bottom=32)
        compact = win_width <= 520 if win_width else True
        return width, height if height is not None else max_height, inset, compact

    title = ft.Text("Mis ejercicios", size=20, weight=ft.FontWeight.W_700, color=TEXT)

    def _btn_filled(text: str, icon=None):
        return ft.FilledButton(
            text=text,
            icon=icon,
            style=ft.ButtonStyle(
                bgcolor=COLORS.with_opacity(1, ACCENT),
                color=COLORS.BLACK,
                padding=12,
                shape=ft.RoundedRectangleBorder(radius=12),
            ),
        )

    def _btn_tonal(text: str, icon=None):
        return ft.FilledTonalButton(
            text=text,
            icon=icon,
            style=ft.ButtonStyle(
                bgcolor=COLORS.with_opacity(1, ACCENT_SOFT),
                color=COLORS.WHITE,
                padding=12,
                shape=ft.RoundedRectangleBorder(radius=12),
            ),
        )

    def _chip(text: str, selected: bool, on_click):
        # Chip con TextButton estilizado (compat)
        return ft.TextButton(
            text=text,
            on_click=on_click,
            style=ft.ButtonStyle(
                bgcolor=COLORS.with_opacity(1, ACCENT if selected else CARD_BG),
                color=COLORS.BLACK if selected else COLORS.WHITE,
                padding=ft.Padding(10, 6, 10, 6),
                shape=ft.RoundedRectangleBorder(radius=16),
                side=ft.BorderSide(1, ACCENT if selected else STROKE),
            ),
        )

    # Contenedores
    favorites_column = ft.Column(spacing=8)
    day_list_column = ft.Column(spacing=8)
    empty_week_text = ft.Text("", size=12, color=MUTED)
    week_label = ft.Text(format_week_span(state["current_date"]), size=13, color=MUTED)

    # ===== Helpers de filtrado
    def _week_bounds() -> tuple[dt.date, dt.date]:
        m = monday_of(state["current_date"])
        return m, m + dt.timedelta(days=6)

    def _ex_date(ex: Exercise) -> dt.date:
        try:
            y, m, d = map(int, ex.date.split("-"))
            return dt.date(y, m, d)
        except Exception:
            return today

    def _exercises_for_week() -> List[Exercise]:
        m, s = _week_bounds()
        return [e for e in list_exercises() if m <= _ex_date(e) <= s]

    def _exercises_for_day(day_index: int) -> List[Exercise]:
        m, _ = _week_bounds()
        target = m + dt.timedelta(days=day_index)
        return [e for e in _exercises_for_week() if _ex_date(e) == target]

    def _favorites_for_week() -> List[Exercise]:
        return [e for e in _exercises_for_week() if e.favorite]

    # ===== Render secciones
    def render_week_header():
        week_label.value = format_week_span(state["current_date"])
        if week_label.page:
            week_label.update()

    def render_favorites():
        favorites_column.controls.clear()
        favs = _favorites_for_week()
        if not favs:
            favorites_column.controls.append(
                ft.Container(
                    padding=12,
                    border_radius=12,
                    border=ft.border.all(1, STROKE),
                    bgcolor=CARD_BG,
                    content=ft.Text("No tenés favoritos esta semana.", size=12, color=MUTED),
                )
            )
        else:
            for ex in favs:
                favorites_column.controls.append(_exercise_card(ex, compact=True))
        if favorites_column.page:
            favorites_column.update()

    def render_day_list():
        day_list_column.controls.clear()
        items = _exercises_for_day(state["selected_day_index"])
        if not items:
            day_list_column.controls.append(
                ft.Container(
                    padding=16,
                    border_radius=14,
                    border=ft.border.all(1, STROKE),
                    bgcolor=CARD_BG,
                    content=ft.Column(
                        [
                            ft.Icon(ICONS.FITNESS_CENTER, color=MUTED, size=36),
                            ft.Text(
                                "No hay ejercicios cargados para este día.",
                                size=12,
                                color=MUTED,
                                text_align=ft.TextAlign.CENTER,
                            ),
                        ],
                        alignment=ft.MainAxisAlignment.CENTER,
                        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                        spacing=8,
                    ),
                )
            )
        else:
            for ex in items:
                day_list_column.controls.append(_exercise_card(ex))
        if day_list_column.page:
            day_list_column.update()

    def render_empty_week_hint():
        # Muestra u oculta un hint si la semana está vacía
        has_any = len(_exercises_for_week()) > 0
        empty_week_text.value = "" if has_any else "Tip: creá tu plan semanal tocando “Agregar” y asignando cada día."
        if empty_week_text.page:
            empty_week_text.update()

    # ===== CRUD UI
    def _exercise_card(ex: Exercise, compact: bool = False) -> ft.Control:
        # Botones de acción
        fav_btn = ft.IconButton(
            icon=ICONS.STAR if ex.favorite else ICONS.STAR_BORDER,
            icon_color=ACCENT if ex.favorite else MUTED,
            tooltip="Favorito",
            on_click=lambda e, ex_id=ex.id: on_toggle_favorite(e, ex_id),
        )
        edit_btn = ft.IconButton(
            icon=ICONS.EDIT,
            icon_color=COLORS.PRIMARY,
            tooltip="Editar",
            on_click=lambda e, data=ex: open_edit(e, data),
        )
        del_btn = ft.IconButton(
            icon=ICONS.DELETE,
            icon_color=DANGER,
            tooltip="Eliminar",
            on_click=lambda e, ex_id=ex.id: open_delete(e, ex_id),
        )

        top = ft.Row(
            [
                ft.Text(ex.name, size=14, weight=ft.FontWeight.W_600, color=TEXT, expand=True),
                fav_btn,
                edit_btn,
                del_btn,
            ],
            alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
        )

        sub1 = ft.Text(
            f"{ex.muscle_group} · {ex.equipment}",
            size=11,
            color=MUTED,
        )
        sub2 = ft.Text(
            f"{ex.sets}×{ex.reps}  ·  {ex.weight:g} kg  ·  RPE {ex.rpe if ex.rpe is not None else '-'}",
            size=11,
            color=TEXT,
        )
        dia_dt = _ex_date(ex)
        sub3 = ft.Text(
            f"{SPANISH_WEEKDAYS_LONG[dia_dt.weekday()]} {format_spanish_date(dia_dt)}",
            size=11,
            color=MUTED,
        )

        notes_block = []
        if ex.notes:
            notes_block.append(ft.Text(ex.notes, size=11, color=TEXT))

        content = [top, sub1, sub2, sub3]
        if notes_block:
            content.append(ft.Divider(color=STROKE))
            content.extend(notes_block)

        return ft.Container(
            bgcolor=CARD_BG,
            padding=12,
            border_radius=14,
            border=ft.border.all(1, STROKE),
            content=ft.Column(content, spacing=6),
        )

    def on_toggle_favorite(e: ft.ControlEvent, ex_id: str):
        toggle_favorite(ex_id)
        refresh_all(e.page, toast="Favorito actualizado")

    # ===== Formularios
    MUSCLE_GROUPS = [
        "Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps",
        "Piernas", "Glúteos", "Core/Abdomen", "Full Body", "Cardio"
    ]
    EQUIPMENT = ["Barra", "Mancuernas", "Máquina", "Polea", "Peso corporal", "Kettlebell", "Banda", "Otro"]

    def open_add(e: ft.ControlEvent):
        _exercise_form_dialog(e.page, initial=None, on_submit=submit_new)

    def open_edit(e: ft.ControlEvent, data: Exercise):
        _exercise_form_dialog(e.page, initial=data, on_submit=submit_edit)

    def open_delete(e: ft.ControlEvent, ex_id: str):
        page = e.page

        def do_delete(_):
            delete_exercise(ex_id)
            page.close(dlg)
            refresh_all(page, toast="Ejercicio eliminado")

        def cancel(_):
            page.close(dlg)

        dlg = ft.AlertDialog(
            modal=True,
            title=ft.Text("Eliminar ejercicio"),
            content=ft.Text("¿Confirmás eliminar este ejercicio?", size=12),
            actions=[
                ft.TextButton("Cancelar", on_click=cancel),
                ft.ElevatedButton("Eliminar", icon=ICONS.DELETE, on_click=do_delete, style=ft.ButtonStyle(color=COLORS.WHITE, bgcolor=DANGER)),
            ],
            actions_alignment=ft.MainAxisAlignment.END,
        )
        page.open(dlg)

    def submit_new(values: Dict):
        ex = Exercise(
            id=str(uuid.uuid4()),
            name=values["name"],
            muscle_group=values["muscle_group"],
            equipment=values["equipment"],
            sets=int(values["sets"]),
            reps=int(values["reps"]),
            weight=float(values["weight"]),
            rpe=float(values["rpe"]) if values["rpe"] not in ("", None) else None,
            notes=(values["notes"] or "").strip() or None,
            favorite=bool(values["favorite"]),
            date=values["date_iso"],
        )
        add_exercise(ex)

    def submit_edit(values: Dict):
        ex = Exercise(
            id=values["id"],
            name=values["name"],
            muscle_group=values["muscle_group"],
            equipment=values["equipment"],
            sets=int(values["sets"]),
            reps=int(values["reps"]),
            weight=float(values["weight"]),
            rpe=float(values["rpe"]) if values["rpe"] not in ("", None) else None,
            notes=(values["notes"] or "").strip() or None,
            favorite=bool(values["favorite"]),
            date=values["date_iso"],
        )
        update_exercise(ex)

    def _exercise_form_dialog(page: ft.Page, initial: Optional[Exercise], on_submit):
        # Fecha preseleccionada = día actualmente elegido en la semana
        pre_monday = monday_of(state["current_date"])
        pre_date = pre_monday + dt.timedelta(days=state["selected_day_index"])
        if initial:
            try:
                y, m, d = map(int, initial.date.split("-"))
                pre_date = dt.date(y, m, d)
            except Exception:
                pass

        # Campos
        name_tf = ft.TextField(label="Ejercicio", value=initial.name if initial else "", autofocus=True)
        mg_dd = ft.Dropdown(label="Grupo muscular", options=[ft.dropdown.Option(x) for x in MUSCLE_GROUPS],
                            value=initial.muscle_group if initial else MUSCLE_GROUPS[0])
        eq_dd = ft.Dropdown(label="Equipo", options=[ft.dropdown.Option(x) for x in EQUIPMENT],
                            value=initial.equipment if initial else EQUIPMENT[0])
        sets_tf = ft.TextField(label="Series", value=str(initial.sets) if initial else "3", keyboard_type=ft.KeyboardType.NUMBER)
        reps_tf = ft.TextField(label="Reps", value=str(initial.reps) if initial else "10", keyboard_type=ft.KeyboardType.NUMBER)
        weight_tf = ft.TextField(label="Peso (kg)", value=f"{initial.weight:g}" if initial else "0", keyboard_type=ft.KeyboardType.NUMBER)
        rpe_tf = ft.TextField(label="RPE (opcional)", value="" if (not initial or initial.rpe is None) else f"{initial.rpe:g}",
                              keyboard_type=ft.KeyboardType.NUMBER)
        notes_tf = ft.TextField(label="Notas (opcional)", value=initial.notes or "" if initial else "", multiline=True, min_lines=2, max_lines=4)
        fav_cb = ft.Checkbox(label="Marcar como favorito", value=initial.favorite if initial else False)

        dialog_width, dialog_height, inset_padding, compact_layout = _dialog_layout(page)

        def adaptive_row(controls: list[ft.Control], spacing: int = 8) -> ft.Control:
            if compact_layout:
                return ft.Column(controls, spacing=spacing, tight=True)
            return ft.Row(controls, spacing=spacing)

        # Selector de día (chips)
        day_idx = pre_date.weekday()
        day_row = ft.Row(spacing=6, wrap=True)
        selected_day_index_box = {"value": day_idx}

        def pick_day(idx: int):
            selected_day_index_box["value"] = idx
            # repaint chips
            build_day_chips()

        def build_day_chips():
            day_row.controls.clear()
            for i, short_name in enumerate(SPANISH_WEEKDAYS_SHORT):
                selected = (i == selected_day_index_box["value"])
                day_row.controls.append(
                    _chip(short_name, selected, on_click=lambda _, ii=i: pick_day(ii))
                )
            if day_row.page:
                day_row.update()

        build_day_chips()

        error_text = ft.Text("", size=12, color=DANGER)

        def do_submit(_):
            # Validaciones simples
            if not (name_tf.value or "").strip():
                error_text.value = "Ingresá el nombre del ejercicio."
                if error_text.page:
                    error_text.update()
                return

            # Construir fecha ISO con la semana actual del formulario
            week_monday = monday_of(state["current_date"])
            chosen_date = week_monday + dt.timedelta(days=selected_day_index_box["value"])
            payload = {
                "id": (initial.id if initial else None),
                "name": name_tf.value.strip(),
                "muscle_group": mg_dd.value,
                "equipment": eq_dd.value,
                "sets": (sets_tf.value or "0"),
                "reps": (reps_tf.value or "0"),
                "weight": (weight_tf.value or "0"),
                "rpe": (rpe_tf.value or ""),
                "notes": notes_tf.value,
                "favorite": bool(fav_cb.value),
                "date_iso": chosen_date.isoformat(),
            }

            on_submit(payload)
            page.close(dlg)
            refresh_all(page, toast=("Ejercicio actualizado" if initial else "Ejercicio agregado"))

        def do_cancel(_):
            page.close(dlg)

        dialog_body = ft.Column(
            [
                name_tf,
                adaptive_row([mg_dd, eq_dd]),
                adaptive_row([sets_tf, reps_tf, weight_tf]),
                adaptive_row([rpe_tf]),
                notes_tf,
                ft.Text("Asignar dia", size=12, color=MUTED),
                day_row,
                error_text,
            ],
            spacing=10,
            tight=True,
            expand=True,
            scroll=ft.ScrollMode.AUTO,
        )

        dlg = ft.AlertDialog(
            modal=True,
            inset_padding=inset_padding,
            title=ft.Text("Editar ejercicio" if initial else "Agregar ejercicio"),
            content=ft.Container(
                width=dialog_width,
                height=dialog_height,
                bgcolor=CARD_BG,
                border=ft.border.all(1, STROKE),
                border_radius=12,
                padding=12,
                content=dialog_body,
            ),
            actions=[
                ft.TextButton("Cancelar", on_click=do_cancel),
                ft.ElevatedButton("Guardar", icon=ICONS.CHECK, on_click=do_submit),
            ],
            actions_alignment=ft.MainAxisAlignment.END,
        )

        page.open(dlg)

    # ===== Navegación por semana y días
    def go_prev_week(_):
        state["current_date"] = monday_of(state["current_date"]) - dt.timedelta(days=7)
        render_week_header()
        render_favorites()
        render_day_list()
        render_empty_week_hint()

    def go_next_week(_):
        state["current_date"] = monday_of(state["current_date"]) + dt.timedelta(days=7)
        render_week_header()
        render_favorites()
        render_day_list()
        render_empty_week_hint()

    day_chips_row = ft.Row(spacing=6, wrap=True)

    def select_day(idx: int):
        state["selected_day_index"] = idx
        # repintar chips
        build_week_day_chips()
        render_day_list()

    def build_week_day_chips():
        day_chips_row.controls.clear()
        for i, short_name in enumerate(SPANISH_WEEKDAYS_SHORT):
            selected = (i == state["selected_day_index"])
            day_chips_row.controls.append(
                _chip(short_name, selected, on_click=lambda _, ii=i: select_day(ii))
            )
        if day_chips_row.page:
            day_chips_row.update()

    # ===== Refresh general
    def refresh_all(page: ft.Page, toast: Optional[str] = None):
        render_week_header()
        build_week_day_chips()
        render_favorites()
        render_day_list()
        render_empty_week_hint()
        if toast:
            page.snack_bar = ft.SnackBar(ft.Text(toast))
            page.snack_bar.open = True
            page.update()

    # ===== Header con botón Agregar arriba (mobile-friendly)
    add_button = _btn_filled("Agregar", icon=ICONS.ADD)
    add_button.on_click = open_add  # set handler

    header = ft.Row(
        [
            ft.Column(
                [
                    title,
                    ft.Text("Plan semanal y favoritos", size=12, color=MUTED),
                ],
                spacing=2,
                expand=True,
            ),
            add_button,
        ],
        alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
    )

    # ===== Controles de semana
    week_controls = ft.Row(
        [
            ft.IconButton(icon=ICONS.CHEVRON_LEFT, tooltip="Semana anterior", on_click=go_prev_week),
            week_label,
            ft.IconButton(icon=ICONS.CHEVRON_RIGHT, tooltip="Semana siguiente", on_click=go_next_week),
        ],
        alignment=ft.MainAxisAlignment.CENTER,
    )

    # ===== Secciones
    favorites_section = ft.Column(
        [
            ft.Text("Favoritos", size=15, weight=ft.FontWeight.W_600, color=TEXT),
            favorites_column,
        ],
        spacing=8,
    )

    today_label = ft.Text(
        f"Día: {SPANISH_WEEKDAYS_LONG[state['selected_day_index']]}",
        size=13,
        color=MUTED,
    )
    day_section = ft.Column(
        [
            ft.Row([ft.Text("Plan del día", size=15, weight=ft.FontWeight.W_600, color=TEXT), today_label],
                   alignment=ft.MainAxisAlignment.SPACE_BETWEEN),
            day_chips_row,
            day_list_column,
        ],
        spacing=8,
    )

    # ===== Root layout (scrollable)
    root = ft.Container(
        bgcolor=DARK_BG,
        padding=ft.Padding(16, 14, 16, 18),
        content=ft.Column(
            [
                header,
                ft.Container(height=8),
                week_controls,
                empty_week_text,
                ft.Divider(color=STROKE),
                favorites_section,
                ft.Divider(color=STROKE),
                day_section,
                ft.Container(height=24),
            ],
            spacing=10,
            expand=True,
            scroll=ft.ScrollMode.AUTO,  # scroll principal
        ),
    )

    # Primer render (cuando el control ya se agregue a la página, update funciona)
    def _post_mount(_):
        refresh_all(root.page)

    # Hook cuando se adjunta a página
    root.on_mount = _post_mount
    return root
