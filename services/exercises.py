EXERCISE_LIBRARY = [
    # Pecho
    {
        "id": "bench_press_bar",
        "name": "Press de banca con barra",
        "muscle": "Pecho",
        "image": "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=60",
    },
    {
        "id": "incline_dumbbell_press",
        "name": "Press inclinado con mancuernas",
        "muscle": "Pecho",
        "image": "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=900&q=60",
    },
    {
        "id": "pec_dec",
        "name": "Contractor de pecho (Pec Deck)",
        "muscle": "Pecho",
        "image": "https://images.unsplash.com/photo-1589829037393-f9c75f6b4c1d?auto=format&fit=crop&w=900&q=60",
    },
    # Espalda
    {
        "id": "lat_pulldown",
        "name": "Jalon al pecho",
        "muscle": "Espalda",
        "image": "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=60",
    },
    {
        "id": "barbell_row",
        "name": "Remo con barra",
        "muscle": "Espalda",
        "image": "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=900&q=60",
    },
    {
        "id": "seated_row",
        "name": "Remo sentado en polea",
        "muscle": "Espalda",
        "image": "https://images.unsplash.com/photo-1540760028073-4f8ce74300c4?auto=format&fit=crop&w=900&q=60",
    },
    # Piernas
    {
        "id": "back_squat",
        "name": "Sentadilla espalda",
        "muscle": "Piernas",
        "image": "https://images.unsplash.com/photo-1526402466350-043f1b0a4c54?auto=format&fit=crop&w=900&q=60",
    },
    {
        "id": "leg_press",
        "name": "Prensa inclinada",
        "muscle": "Piernas",
        "image": "https://images.unsplash.com/photo-1571907485990-6e40b1620690?auto=format&fit=crop&w=900&q=60",
    },
    {
        "id": "romanian_deadlift",
        "name": "Peso muerto rumano",
        "muscle": "Piernas",
        "image": "https://images.unsplash.com/photo-1534367610401-9f85a215bd1d?auto=format&fit=crop&w=900&q=60",
    },
    # Hombros
    {
        "id": "shoulder_press",
        "name": "Press militar con mancuernas",
        "muscle": "Hombros",
        "image": "https://images.unsplash.com/photo-1530825894095-9c184b068fcb?auto=format&fit=crop&w=900&q=60",
    },
    {
        "id": "lateral_raise",
        "name": "Elevaciones laterales",
        "muscle": "Hombros",
        "image": "https://images.unsplash.com/photo-1617364852220-0f9d47095fac?auto=format&fit=crop&w=900&q=60",
    },
    {
        "id": "face_pull",
        "name": "Face pull en polea",
        "muscle": "Hombros",
        "image": "https://images.unsplash.com/photo-1528642474498-1af0c17fd8c4?auto=format&fit=crop&w=900&q=60",
    },
    # Biceps
    {
        "id": "barbell_curl",
        "name": "Curl de biceps con barra",
        "muscle": "Biceps",
        "image": "https://images.unsplash.com/photo-1593079831251-35e6c88da23c?auto=format&fit=crop&w=900&q=60",
    },
    {
        "id": "incline_db_curl",
        "name": "Curl inclinado con mancuernas",
        "muscle": "Biceps",
        "image": "https://images.unsplash.com/photo-1574680034394-7d2c24e1d9c0?auto=format&fit=crop&w=900&q=60",
    },
    {
        "id": "hammer_curl",
        "name": "Curl martillo",
        "muscle": "Biceps",
        "image": "https://images.unsplash.com/photo-1517963628607-235ccdd5476c?auto=format&fit=crop&w=900&q=60",
    },
    # Triceps
    {
        "id": "tricep_pushdown",
        "name": "Extension de triceps en polea",
        "muscle": "Triceps",
        "image": "https://images.unsplash.com/photo-1517502166878-35c93a0072bb?auto=format&fit=crop&w=900&q=60",
    },
    {
        "id": "skullcrusher",
        "name": "Press frances (skull crusher)",
        "muscle": "Triceps",
        "image": "https://images.unsplash.com/photo-1559741803-1f3e79a1b2c8?auto=format&fit=crop&w=900&q=60",
    },
    {
        "id": "bench_dips",
        "name": "Fondos entre bancos",
        "muscle": "Triceps",
        "image": "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=900&q=60",
    },
    # Core
    {
        "id": "plank",
        "name": "Plancha",
        "muscle": "Core",
        "image": "https://images.unsplash.com/photo-1554344057-99829f17a602?auto=format&fit=crop&w=900&q=60",
    },
    {
        "id": "hanging_leg_raise",
        "name": "Elevaciones de piernas",
        "muscle": "Core",
        "image": "https://images.unsplash.com/photo-1517832207067-4db24a2ae47c?auto=format&fit=crop&w=900&q=60",
    },
    {
        "id": "cable_crunch",
        "name": "Crunch en polea",
        "muscle": "Core",
        "image": "https://images.unsplash.com/photo-1584865288649-299164c46eb3?auto=format&fit=crop&w=900&q=60",
    },
]

_EXERCISE_MAP = {item["id"]: item for item in EXERCISE_LIBRARY}


def get_exercises_by_muscles(muscles: list[str]) -> list[dict]:
    if not muscles:
        return EXERCISE_LIBRARY[:]
    muscles_l = {m.lower() for m in muscles}
    return [item for item in EXERCISE_LIBRARY if item["muscle"].lower() in muscles_l]


def get_exercise_info(exercise_id: str) -> dict | None:
    return _EXERCISE_MAP.get(exercise_id)
