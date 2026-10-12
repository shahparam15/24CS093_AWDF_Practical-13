// In-memory event log for inspection, verification, and tests
export const eventExecutionLogs = [];

/**
 * Requirement 2: Dedicated listener module registered once on server initialization
 */
export function registerEventListeners(emitter) {
  // Listener for 'task-created'
  emitter.on("task-created", (payload) => {
    try {
      const handlerStartTime = new Date().toISOString();
      const { task, user, apiResponseTime } = payload;

      const startLog = {
        event: "task-created",
        phase: "START",
        taskTitle: task.title,
        taskId: task._id ? task._id.toString() : "unknown",
        owner: user ? user.email || user.id : "Anonymous",
        apiResponseTime: apiResponseTime || new Date().toISOString(),
        handlerStartTime,
      };
      eventExecutionLogs.push(startLog);

      console.log(
        `\n[EVENT: task-created] Handler STARTED at ${handlerStartTime}\n` +
        `  -> Task Title: "${task.title}"\n` +
        `  -> Owner/User: ${user ? user.email || user.id : "Unknown"}\n` +
        `  -> API Response Sent At: ${apiResponseTime || "N/A"}\n` +
        `  -> Asynchronous 2000ms simulation timer initiated...`
      );

      // Requirement 5: Controlled asynchronous demonstration delay of 2000ms
      // (Using non-blocking timer rather than CPU-blocking loop)
      setTimeout(() => {
        try {
          const handlerFinishTime = new Date().toISOString();
          const finishLog = {
            event: "task-created",
            phase: "FINISH",
            taskTitle: task.title,
            taskId: task._id ? task._id.toString() : "unknown",
            owner: user ? user.email || user.id : "Anonymous",
            handlerFinishTime,
            delayDurationMs: 2000,
          };
          eventExecutionLogs.push(finishLog);

          console.log(
            `\n[EVENT: task-created] Notification Processed at ${handlerFinishTime}\n` +
            `  -> Status: Email/Webhook Notification Dispatched\n` +
            `  -> Finished 2000ms after HTTP 201 response was already returned to client!`
          );
        } catch (innerErr) {
          console.error(`[task-created async handler error]: ${innerErr.message}`);
        }
      }, 2000);
    } catch (err) {
      console.error(`[task-created listener error]: ${err.message}`);
    }
  });

  // Listener for 'task-deleted'
  emitter.on("task-deleted", (payload) => {
    try {
      const { task, user, deletedAt } = payload;
      const logEntry = {
        event: "task-deleted",
        taskId: task._id ? task._id.toString() : "unknown",
        taskTitle: task.title,
        owner: user ? user.email || user.id : "Anonymous",
        deletedAt: deletedAt || new Date().toISOString(),
      };
      eventExecutionLogs.push(logEntry);

      console.log(
        `\n[EVENT: task-deleted] Deletion Notification Logged at ${logEntry.deletedAt}\n` +
        `  -> Deleted Task Title: "${task.title}"\n` +
        `  -> Task ID: ${logEntry.taskId}\n` +
        `  -> Deleted By: ${logEntry.owner}`
      );
    } catch (err) {
      console.error(`[task-deleted listener error]: ${err.message}`);
    }
  });
}

export function clearEventExecutionLogs() {
  eventExecutionLogs.length = 0;
}
