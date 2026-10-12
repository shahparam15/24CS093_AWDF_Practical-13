import { EventEmitter } from "node:events";

// Requirement 1: Shared EventEmitter instance using Node.js built-in events module
class TaskEventEmitter extends EventEmitter {
  constructor() {
    super();
    // Configure default max listeners if needed
    this.setMaxListeners(20);
  }
}

export const taskEvents = new TaskEventEmitter();

// Requirement 6: Global error listener to prevent unhandled 'error' events from crashing the process
taskEvents.on("error", (err) => {
  console.error(`[TaskEvents Global Error] Caught asynchronous event failure: ${err.message}`);
});

export default taskEvents;
