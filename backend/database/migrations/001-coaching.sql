CREATE TABLE IF NOT EXISTS coach_assignments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  athlete_id INT UNSIGNED NOT NULL,
  coach_id INT UNSIGNED NOT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME NULL,
  is_baseline TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_assignments_coach_dates (coach_id, started_at, ended_at),
  KEY idx_assignments_athlete (athlete_id, started_at),
  FOREIGN KEY (athlete_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS meal_plans (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  athlete_id INT UNSIGNED NOT NULL,
  coach_id INT UNSIGNED NULL,
  title VARCHAR(120) NOT NULL,
  notes VARCHAR(3000) NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  archived_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_plans_athlete_dates (athlete_id, start_date, end_date),
  FOREIGN KEY (athlete_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS meal_plan_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  plan_id INT UNSIGNED NOT NULL,
  food_id INT UNSIGNED NULL,
  day_of_week TINYINT UNSIGNED NOT NULL DEFAULT 0,
  meal ENUM('desayuno','almuerzo','merienda','cena','snack') NOT NULL,
  name VARCHAR(150) NOT NULL,
  grams DECIMAL(7,2) NOT NULL,
  kcal DECIMAL(7,2) NOT NULL,
  protein DECIMAL(6,2) NOT NULL,
  carbs DECIMAL(6,2) NOT NULL,
  fat DECIMAL(6,2) NOT NULL,
  micros JSON NOT NULL,
  KEY idx_plan_items (plan_id, day_of_week),
  FOREIGN KEY (plan_id) REFERENCES meal_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS meal_plan_applications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  plan_id INT UNSIGNED NOT NULL,
  athlete_id INT UNSIGNED NOT NULL,
  entry_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_plan_application (plan_id, athlete_id, entry_date),
  FOREIGN KEY (plan_id) REFERENCES meal_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (athlete_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS weekly_reports (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  athlete_id INT UNSIGNED NOT NULL,
  week_start DATE NOT NULL,
  snapshot JSON NOT NULL,
  pdf LONGBLOB NOT NULL,
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_weekly_report (athlete_id, week_start),
  FOREIGN KEY (athlete_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
