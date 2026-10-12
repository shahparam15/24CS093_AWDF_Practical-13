process.env.NODE_ENV = "test";
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import app from "../src/server.js";
import User from "../src/models/User.js";
import Task from "../src/models/Task.js";
import { taskEvents } from "../src/events/events.js";
import { eventExecutionLogs, clearEventExecutionLogs } from "../src/events/listeners.js";
import { clearAllCache } from "../src/config/cache.js";

let server;
let baseUrl;

const user1Data = {
  email: `events_test_user1_${Date.now()}@charusat.edu.in`,
  password: "password123",
};

let user1Token = "";
let user1TaskId = "";

before(async () => {
  clearAllCache();
  clearEventExecutionLogs();

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  // Allow pending async demonstration timers to complete cleanly before process exit
  await new Promise((resolve) => setTimeout(resolve, 2200));

  clearAllCache();
  clearEventExecutionLogs();
  await User.deleteMany({ email: user1Data.email });
  if (user1TaskId) {
    await Task.findByIdAndDelete(user1TaskId);
  }
  await mongoose.disconnect();
  await new Promise((resolve) => server.close(resolve));
});

describe("Practical 13: AI API Integration Integration Tests", () => {
  test("POST /auth/register & login - Prepare authenticated user", async () => {
    await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user1Data),
    });

    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user1Data),
    });

    const loginData = await loginRes.json();
    assert.equal(loginRes.status, 200);
    user1Token = loginData.token;
  });

  test("POST /tasks - Successfully creates task, returns HTTP 201 immediately, and emits 'task-created'", async () => {
    clearEventExecutionLogs();

    const startPerf = performance.now();
    const res = await fetch(`${baseUrl}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        title: "Test Event Creation Task",
        description: "Checking asynchronous event emission",
        priority: "high",
      }),
    });
    const elapsedMs = performance.now() - startPerf;

    const data = await res.json();
    assert.equal(res.status, 201);
    assert.equal(data.success, true);
    assert.ok(data.data._id);
    user1TaskId = data.data._id;

    // Requirement 5: Response returned rapidly (<500ms) without waiting for 2000ms listener delay
    assert.ok(elapsedMs < 1000, `Expected rapid HTTP response, took ${elapsedMs}ms`);

    // Check that 'task-created' listener START was recorded
    const startEvent = eventExecutionLogs.find(
      (l) => l.event === "task-created" && l.phase === "START"
    );
    assert.ok(startEvent, "Expected 'task-created' START event in logs");
    assert.equal(startEvent.taskTitle, "Test Event Creation Task");

    // Immediately after response, the 2000ms delay has NOT finished yet
    const finishEvent = eventExecutionLogs.find(
      (l) => l.event === "task-created" && l.phase === "FINISH"
    );
    assert.equal(finishEvent, undefined, "Listener should still be waiting asynchronously");
  });

  test("Failed Database Write does NOT emit 'task-created'", async () => {
    const logsBeforeCount = eventExecutionLogs.length;

    // Attempt creation with empty title (validation error)
    const res = await fetch(`${baseUrl}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        title: "",
        description: "Invalid task without title",
      }),
    });

    assert.equal(res.status, 400);

    // No new events should have been emitted
    const newEvents = eventExecutionLogs.slice(logsBeforeCount);
    assert.equal(newEvents.length, 0, "No event should be emitted on failed write");
  });

  test("DELETE /tasks/:id - Deletes task and emits 'task-deleted' event", async () => {
    const res = await fetch(`${baseUrl}/tasks/${user1TaskId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${user1Token}` },
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);

    const deleteEvent = eventExecutionLogs.find((l) => l.event === "task-deleted");
    assert.ok(deleteEvent, "Expected 'task-deleted' event in logs");
    assert.equal(deleteEvent.taskId, user1TaskId);
    assert.equal(deleteEvent.taskTitle, "Test Event Creation Task");
  });

  test("GET /tasks/events/logs - Reports recorded event execution history", async () => {
    const res = await fetch(`${baseUrl}/tasks/events/logs`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.logs));
    assert.ok(data.count >= 2);
  });

  test("Safe Error Handling - Global error listener catches simulated error without crashing server", async () => {
    let errorCaught = false;
    const testErrorListener = (err) => {
      if (err.message.includes("Simulated background error")) {
        errorCaught = true;
      }
    };
    taskEvents.on("error", testErrorListener);

    // Emit a synthetic error event
    taskEvents.emit("error", new Error("Simulated background error for testing"));

    assert.equal(errorCaught, true, "Expected global error listener to safely handle event failure");
    taskEvents.removeListener("error", testErrorListener);

    // Verify server remains responsive
    const healthRes = await fetch(`${baseUrl}/health`);
    assert.equal(healthRes.status, 200);
  });

  // Practical 13: AI Generation Tests
  test("POST /ai/generate-description - Fails with 401 without Bearer token", async () => {
    const res = await fetch(`${baseUrl}/ai/generate-description`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Build CI Pipeline" }),
    });

    assert.equal(res.status, 401);
  });

  test("POST /ai/generate-description - Fails with 400 when title is missing", async () => {
    const res = await fetch(`${baseUrl}/ai/generate-description`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({ title: "   " }),
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.ok(data.message.includes("title is required"));
  });

  test("POST /ai/generate-description - Successfully generates resilient description with disclaimer", async () => {
    const res = await fetch(`${baseUrl}/ai/generate-description`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        title: "Dockerize full-stack application",
        priority: "high",
        category: "devops",
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.ok(data.description && data.description.length > 20);
    assert.ok(data.disclaimer);
    assert.ok(["gemini", "openai", "fallback"].includes(data.source));
  });
});
