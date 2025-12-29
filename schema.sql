CREATE TABLE IF NOT EXISTS workout_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_date TEXT NOT NULL,
  workout_type TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  active_calories INTEGER NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS activity_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL UNIQUE,
  distance_miles REAL,
  calories_segment INTEGER,
  FOREIGN KEY (workout_id) REFERENCES workout_sessions(id) ON DELETE CASCADE
);
