const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");

let serverProcess;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let i = 0; i < 30; i += 1) {
    try {
      const response = await fetch("http://127.0.0.1:3000/health");
      if (response.ok) return;
    } catch (error) {
      // keep retrying
    }
    await sleep(500);
  }
  throw new Error("Server did not start in time.");
}

test.before(async () => {
  serverProcess = spawn(process.execPath, ["server.js"], {
    stdio: "inherit"
  });

  await waitForServer();
});

test.after(() => {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
  }
});

test("GET /health returns ok", async () => {
  const response = await fetch("http://127.0.0.1:3000/health");
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.message, "Server is running");
});

test("POST /workouts creates a workout", async () => {
  const payload = {
    workout_date: "2026-04-06",
    workout_type: "running",
    duration_minutes: 30,
    active_calories: 250,
    notes: "CI test workout",
    distance_miles: 2.5,
    calories_segment: 200
  };

  const response = await fetch("http://127.0.0.1:3000/workouts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  assert.equal(response.status, 201);

  const body = await response.json();
  assert.ok(body.id);
  assert.equal(body.message, "Workout saved");
});
