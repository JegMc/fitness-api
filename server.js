/*
POSTMAN QUICK TEST CHEAT SHEET (when I forgot everything)

1) Server check
   GET http://localhost:3000/health

2) Create a workout (strength example)
   POST http://localhost:3000/workouts
   Body:
   {
     "workout_date": "2025-01-10",
     "workout_type": "strength training",
     "duration_minutes": 75,
     "active_calories": 320,
     "notes": "Upper body lift"
   }

3) Create a workout (cardio example)
   POST http://localhost:3000/workouts
   Body:
   {
     "workout_date": "2025-01-10",
     "workout_type": "running",
     "duration_minutes": 45,
     "active_calories": 410,
     "notes": "Morning run",
     "distance_miles": 3.1,
     "calories_segment": 390
   }

4) Read data
   GET  http://localhost:3000/workouts
   GET  http://localhost:3000/workouts/latest
   GET  http://localhost:3000/workouts/:id

5) Update fields (partial update)
   PUT http://localhost:3000/workouts/:id
   Body example:
   { "notes": "Updated note", "duration_minutes": 60 }

6) Delete mistake
   DELETE http://localhost:3000/workouts/:id
*/


/***********************
 *  FITNESS API SERVER
 *  Tech: Node + Express + SQLite (better-sqlite3)
 *
 *  FLOW (big picture):
 *  Postman sends HTTP request
 *    -> Express route runs
 *    -> SQL runs against fitness.db
 *    -> Express sends JSON response back to Postman
 ***********************/

const db = require("./db"); // SQLite database connection (better-sqlite3 instance)

const express = require("express");
const app = express();

/***********************
 *  MIDDLEWARE
 ***********************/

// Allows Express to automatically parse JSON request bodies
// Example: Postman JSON becomes available as req.body
app.use(express.json());

/***********************
 *  HEALTH CHECK
 *  Purpose: quick “is server alive?” test
 ***********************/

app.get("/health", (req, res) => {
  res.json({ ok: true, message: "Server is running" });
});

/***********************
 *  GET /workouts
 *  Purpose: return ALL workouts, joined with optional activity details
 *
 *  KEY IDEA: LEFT JOIN
 *  - Every workout shows up
 *  - If no matching activity_details row exists, those fields return null
 ***********************/

app.get("/workouts", (req, res) => {
  const rows = db.prepare(`
    SELECT
      ws.id,
      ws.workout_date,
      ws.workout_type,
      ws.duration_minutes,
      ws.active_calories,
      ws.notes,
      ad.distance_miles,
      ad.calories_segment
    FROM workout_sessions ws
    LEFT JOIN activity_details ad
      ON ws.id = ad.workout_id
    ORDER BY ws.workout_date DESC
  `).all();

  res.json(rows);
});

/***********************
 *  GET /workouts/:id
 *  Purpose: return ONE workout by id (also includes optional details)
 *
 *  Notes:
 *  - req.params.id is a string, so we convert to Number
 *  - we validate to avoid nonsense inputs (negative, NaN, etc.)
 ***********************/

app.get("/workouts/:id", (req, res) => {
  const workoutId = Number(req.params.id);

  // Validate id is a positive integer
  if (!Number.isInteger(workoutId) || workoutId <= 0) {
    return res.status(400).json({ error: "Invalid workout id" });
  }

  const row = db.prepare(`
    SELECT
      ws.id,
      ws.workout_date,
      ws.workout_type,
      ws.duration_minutes,
      ws.active_calories,
      ws.notes,
      ad.distance_miles,
      ad.calories_segment
    FROM workout_sessions ws
    LEFT JOIN activity_details ad ON ws.id = ad.workout_id
    WHERE ws.id = ?
  `).get(workoutId);

  if (!row) return res.status(404).json({ error: "Workout not found" });

  res.json(row);
});

/***********************
 *  GET /workouts/latest
 *  Purpose: return the most recently created workout
 *
 *  KEY IDEA: "latest" here means highest ws.id
 *  (because id autoincrements each insert)
 ***********************/

app.get("/workouts/latest", (req, res) => {
  const row = db.prepare(`
    SELECT
      ws.id,
      ws.workout_date,
      ws.workout_type,
      ws.duration_minutes,
      ws.active_calories,
      ws.notes,
      ad.distance_miles,
      ad.calories_segment
    FROM workout_sessions ws
    LEFT JOIN activity_details ad ON ws.id = ad.workout_id
    ORDER BY ws.id DESC
    LIMIT 1
  `).get();

  if (!row) return res.status(404).json({ error: "No workouts found" });

  res.json(row);
});

/***********************
 *  POST /workouts
 *  Purpose: create a workout entry
 *
 *  KEY IDEA:
 *  - Always insert into workout_sessions
 *  - Only insert into activity_details if:
 *      a) workout_type is cardio
 *      b) at least one metric was provided (distance/calories_segment)
 *
 *  INPUT SOURCE:
 *  - Postman JSON becomes req.body because of express.json middleware
 ***********************/

app.post("/workouts", (req, res) => {
  const {
    workout_date,
    workout_type,
    duration_minutes,
    active_calories,
    notes,
    distance_miles,
    calories_segment
  } = req.body;

  // Validate required workout fields
  if (!workout_date || !workout_type || duration_minutes == null || active_calories == null) {
    return res.status(400).json({
      error: "workout_date, workout_type, duration_minutes, and active_calories are required"
    });
  }

  // Define which workout types count as "cardio" for activity_details
  const CARDIO_TYPES = new Set(["running", "walking", "elliptical", "pickleball"]);
  const isCardio = CARDIO_TYPES.has(workout_type);

  // Insert workout row (always)
  const workoutStmt = db.prepare(`
    INSERT INTO workout_sessions (workout_date, workout_type, duration_minutes, active_calories, notes)
    VALUES (?, ?, ?, ?, ?)
  `);

  const info = workoutStmt.run(
    workout_date,
    workout_type,
    duration_minutes,
    active_calories,
    notes ?? null
  );

  // SQLite gives us the autogenerated id for the inserted row
  const newWorkoutId = info.lastInsertRowid;

  // Conditionally insert details row (only for cardio + metrics provided)
  if (isCardio && (distance_miles != null || calories_segment != null)) {
    const detailsStmt = db.prepare(`
      INSERT INTO activity_details (workout_id, distance_miles, calories_segment)
      VALUES (?, ?, ?)
    `);

    detailsStmt.run(
      newWorkoutId,
      distance_miles ?? null,
      calories_segment ?? null
    );
  }

  // Response sent back to Postman
  res.status(201).json({
    message: "Workout saved",
    id: newWorkoutId,
    details_created: isCardio && (distance_miles != null || calories_segment != null)
  });
});

/***********************
 *  PUT /workouts/:id
 *  Purpose: update any subset of workout fields (partial update)
 *
 *  KEY IDEA: COALESCE
 *  - If client sends a field -> update it
 *  - If client omits field -> keep existing value
 ***********************/

app.put("/workouts/:id", (req, res) => {
  const workoutId = Number(req.params.id);

  if (!Number.isInteger(workoutId) || workoutId <= 0) {
    return res.status(400).json({ error: "Invalid workout id" });
  }

  const {
    workout_date,
    workout_type,
    duration_minutes,
    active_calories,
    notes
  } = req.body;

  // If nothing was sent, there is nothing to update
  if (
    workout_date == null &&
    workout_type == null &&
    duration_minutes == null &&
    active_calories == null &&
    notes == null
  ) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

  /*
    COALESCE(a, b) returns:
      - a if a is NOT null
      - b if a IS null

    So:
      workout_date = COALESCE(?, workout_date)

    means:
      - if client sends workout_date -> update it
      - if client does NOT send workout_date -> keep existing value
  */
  const stmt = db.prepare(`
    UPDATE workout_sessions
    SET
      workout_date      = COALESCE(?, workout_date),
      workout_type      = COALESCE(?, workout_type),
      duration_minutes  = COALESCE(?, duration_minutes),
      active_calories   = COALESCE(?, active_calories),
      notes             = COALESCE(?, notes)
    WHERE id = ?
  `);

  const info = stmt.run(
    workout_date ?? null,
    workout_type ?? null,
    duration_minutes ?? null,
    active_calories ?? null,
    notes ?? null,
    workoutId
  );

  if (info.changes === 0) {
    return res.status(404).json({ error: "Workout not found" });
  }

  res.json({
    message: "Workout updated",
    id: workoutId
  });
});

/***********************
 *  DELETE /workouts/:id
 *  Purpose: delete a workout by id
 *
 *  NOTE:
 *  Your schema uses ON DELETE CASCADE, so if activity_details exists,
 *  it will be automatically deleted too.
 ***********************/

app.delete("/workouts/:id", (req, res) => {
  const workoutId = Number(req.params.id);

  if (!Number.isInteger(workoutId) || workoutId <= 0) {
    return res.status(400).json({ error: "Invalid workout id" });
  }

  const info = db.prepare(`DELETE FROM workout_sessions WHERE id = ?`).run(workoutId);

  if (info.changes === 0) return res.status(404).json({ error: "Workout not found" });

  res.json({ message: "Workout deleted", id: workoutId });
});

/***********************
 *  SERVER START
 ***********************/

app.listen(3000, () => {
  console.log("✅ Server running on http://localhost:3000");
});

/***********************
 *  ERROR HANDLER (last)
 *  Purpose: if something throws, return JSON instead of HTML
 ***********************/

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error", detail: err.message });
});
