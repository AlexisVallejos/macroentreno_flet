-- =====================================================================
-- MacroEntreno · Esquema MySQL 8
-- Cada índice indica qué consulta de la API lo usa.
-- Ver docs/BASE_DE_DATOS.md para el diagrama y la explicación completa.
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS workout_sets;
DROP TABLE IF EXISTS workout_exercises;
DROP TABLE IF EXISTS workouts;
DROP TABLE IF EXISTS exercises;
DROP TABLE IF EXISTS diary_entries;
DROP TABLE IF EXISTS foods;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS social_accounts;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- Usuarios y roles (admin, coach, athlete)
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name           VARCHAR(100) NOT NULL,
  email          VARCHAR(190) NULL,               -- NULL si la red social no compartió el email
  password_hash  VARCHAR(100) NULL,               -- NULL si solo usa inicio de sesión social
  role           ENUM('admin', 'coach', 'athlete') NOT NULL DEFAULT 'athlete',
  coach_id       INT UNSIGNED NULL,               -- entrenador asignado (solo atletas)
  avatar_url     VARCHAR(500) NULL,
  kcal_goal      SMALLINT UNSIGNED NOT NULL DEFAULT 2000,
  protein_goal   SMALLINT UNSIGNED NOT NULL DEFAULT 150,
  carbs_goal     SMALLINT UNSIGNED NOT NULL DEFAULT 200,
  fat_goal       SMALLINT UNSIGNED NOT NULL DEFAULT 65,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  pro_until      DATETIME NULL,                   -- MacroEntreno Pro (micronutrientes) activo hasta esta fecha
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),               -- login y registro buscan por email
  KEY idx_users_role_name (role, name),            -- GET /users?role=... ordenado por nombre
  KEY idx_users_coach (coach_id),                  -- "mis atletas" del entrenador
  CONSTRAINT fk_users_coach FOREIGN KEY (coach_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cuentas de redes sociales vinculadas (Google, Facebook, GitHub)
CREATE TABLE social_accounts (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id           INT UNSIGNED NOT NULL,
  provider          ENUM('google', 'facebook', 'github') NOT NULL,
  provider_user_id  VARCHAR(191) NOT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_social_provider_user (provider, provider_user_id), -- búsqueda al iniciar sesión
  KEY idx_social_user (user_id),
  CONSTRAINT fk_social_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tokens de renovación: se guarda solo el hash SHA-256 para poder rotarlos y revocarlos
CREATE TABLE refresh_tokens (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  token_hash  CHAR(64) NOT NULL,
  expires_at  DATETIME NOT NULL,
  revoked_at  DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_hash (token_hash),          -- POST /auth/refresh busca por hash
  KEY idx_refresh_user (user_id, revoked_at),       -- revocar todas las sesiones de un usuario
  KEY idx_refresh_expires (expires_at),             -- limpieza de tokens vencidos
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- MacroEntreno Pro: suscripciones mensuales con Mercado Pago
-- ---------------------------------------------------------------------
CREATE TABLE subscriptions (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id          INT UNSIGNED NOT NULL,
  provider         ENUM('mercadopago') NOT NULL DEFAULT 'mercadopago',
  provider_id      VARCHAR(80) NOT NULL,                -- id del preapproval de Mercado Pago
  status           ENUM('pending', 'authorized', 'paused', 'cancelled') NOT NULL DEFAULT 'pending',
  amount           DECIMAL(10,2) NOT NULL,
  currency         CHAR(3) NOT NULL DEFAULT 'ARS',
  next_payment_at  DATETIME NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subscriptions_provider (provider, provider_id), -- los webhooks buscan por el id de Mercado Pago
  KEY idx_subscriptions_user (user_id, created_at),             -- la suscripción más reciente del usuario
  CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Nutrición
-- ---------------------------------------------------------------------
-- owner_id NULL = alimento del catálogo global (lo administran coach/admin)
-- owner_id = X  = alimento personalizado del usuario X
CREATE TABLE foods (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_id             INT UNSIGNED NULL,
  name                 VARCHAR(150) NOT NULL,
  category             VARCHAR(60) NOT NULL DEFAULT 'General',
  brand                VARCHAR(80) NULL,
  portion_grams        DECIMAL(7,2) NOT NULL DEFAULT 100,
  portion_description  VARCHAR(120) NULL,
  kcal                 DECIMAL(7,2) NOT NULL DEFAULT 0,  -- valores por porción
  protein              DECIMAL(6,2) NOT NULL DEFAULT 0,
  carbs                DECIMAL(6,2) NOT NULL DEFAULT 0,
  fat                  DECIMAL(6,2) NOT NULL DEFAULT 0,
  -- Micronutrientes por porción. NULL = dato desconocido (no es lo mismo que 0).
  fiber                DECIMAL(6,2) NULL,                -- g
  sugar                DECIMAL(6,2) NULL,                -- g
  saturated_fat        DECIMAL(6,2) NULL,                -- g
  cholesterol          DECIMAL(7,2) NULL,                -- mg
  sodium               DECIMAL(8,2) NULL,                -- mg
  potassium            DECIMAL(8,2) NULL,                -- mg
  calcium              DECIMAL(8,2) NULL,                -- mg
  iron                 DECIMAL(6,2) NULL,                -- mg
  vitamin_a            DECIMAL(8,2) NULL,                -- µg
  vitamin_c            DECIMAL(7,2) NULL,                -- mg
  vitamin_d            DECIMAL(6,2) NULL,                -- µg
  external_source      ENUM('fatsecret') NULL,           -- de dónde se importó
  external_id          VARCHAR(40) NULL,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_foods_owner_name (owner_id, name),        -- listado global/propio ordenado por nombre
  KEY idx_foods_category (category),                -- filtro por categoría
  FULLTEXT KEY ft_foods_search (name, brand),       -- buscador de alimentos (?search=)
  UNIQUE KEY uq_foods_external (external_source, external_id), -- importar dos veces el mismo de FatSecret lo actualiza
  CONSTRAINT fk_foods_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Diario: copia los macros al momento de registrar (si después se edita el alimento,
-- el historial no cambia).
CREATE TABLE diary_entries (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  food_id     INT UNSIGNED NULL,
  entry_date  DATE NOT NULL,
  meal        ENUM('desayuno', 'almuerzo', 'merienda', 'cena', 'snack') NOT NULL,
  name        VARCHAR(150) NOT NULL,
  grams       DECIMAL(7,2) NOT NULL,
  kcal        DECIMAL(7,2) NOT NULL DEFAULT 0,
  protein     DECIMAL(6,2) NOT NULL DEFAULT 0,
  carbs       DECIMAL(6,2) NOT NULL DEFAULT 0,
  fat         DECIMAL(6,2) NOT NULL DEFAULT 0,
  -- Copia de los micronutrientes del alimento escalados a los gramos (NULL si no se conocen).
  fiber       DECIMAL(6,2) NULL,
  sugar       DECIMAL(6,2) NULL,
  saturated_fat DECIMAL(6,2) NULL,
  cholesterol DECIMAL(7,2) NULL,
  sodium      DECIMAL(8,2) NULL,
  potassium   DECIMAL(8,2) NULL,
  calcium     DECIMAL(8,2) NULL,
  iron        DECIMAL(6,2) NULL,
  vitamin_a   DECIMAL(8,2) NULL,
  vitamin_c   DECIMAL(7,2) NULL,
  vitamin_d   DECIMAL(6,2) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_diary_user_date (user_id, entry_date),    -- día puntual y rangos de /progress
  KEY idx_diary_food (food_id),
  CONSTRAINT fk_diary_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_diary_food FOREIGN KEY (food_id) REFERENCES foods (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Entrenamiento
-- ---------------------------------------------------------------------
CREATE TABLE exercises (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120) NOT NULL,
  muscle_group  VARCHAR(40) NOT NULL,
  equipment     VARCHAR(60) NULL,
  image_url     VARCHAR(500) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_exercises_name (name),
  KEY idx_exercises_muscle (muscle_group, name)     -- filtro por grupo muscular
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE workouts (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED NOT NULL,              -- atleta dueño de la sesión
  created_by    INT UNSIGNED NULL,                  -- quien la cargó (el propio atleta o su coach)
  workout_date  DATE NOT NULL,
  title         VARCHAR(120) NOT NULL,
  notes         VARCHAR(1000) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_workouts_user_date (user_id, workout_date), -- listado por semana y /progress
  KEY idx_workouts_created_by (created_by),
  CONSTRAINT fk_workouts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_workouts_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE workout_exercises (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  workout_id     INT UNSIGNED NOT NULL,
  exercise_id    INT UNSIGNED NULL,
  exercise_name  VARCHAR(120) NOT NULL,             -- se conserva aunque se borre del catálogo
  position       TINYINT UNSIGNED NOT NULL DEFAULT 1,
  notes          VARCHAR(500) NULL,
  PRIMARY KEY (id),
  KEY idx_wex_workout (workout_id, position),       -- cargar los ejercicios de una sesión en orden
  KEY idx_wex_exercise (exercise_id),               -- historial de un ejercicio para /progress
  CONSTRAINT fk_wex_workout FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE,
  CONSTRAINT fk_wex_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE workout_sets (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  workout_exercise_id  INT UNSIGNED NOT NULL,
  set_number           TINYINT UNSIGNED NOT NULL,
  reps                 SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  weight               DECIMAL(6,2) NOT NULL DEFAULT 0, -- kg
  rpe                  TINYINT UNSIGNED NULL,           -- esfuerzo percibido 1-10
  PRIMARY KEY (id),
  UNIQUE KEY uq_sets_order (workout_exercise_id, set_number),
  CONSTRAINT fk_sets_wex FOREIGN KEY (workout_exercise_id) REFERENCES workout_exercises (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
