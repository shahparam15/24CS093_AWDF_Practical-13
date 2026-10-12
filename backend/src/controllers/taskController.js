import Task from "../models/Task.js";
import {
  getTasksCacheKey,
  getSingleTaskCacheKey,
  getFromCache,
  setToCache,
  invalidateUserTasks,
  invalidateUserTaskAndList,
  getCacheStatistics,
  resetCacheStatistics,
} from "../config/cache.js";
import { taskEvents } from "../events/events.js";
import { eventExecutionLogs } from "../events/listeners.js";

// GET /tasks - Get all tasks for the authenticated user (Cached with node-cache)
export async function getTasks(req, res, next) {
  try {
    const { completed, priority, search, sort } = req.query;

    const cacheKey = getTasksCacheKey(req.user.id, {
      completed,
      priority,
      search,
      sort,
    });

    const cachedResult = getFromCache(cacheKey);
    if (cachedResult.hit) {
      res.setHeader("X-Cache", "HIT");
      return res.status(200).json({
        success: true,
        count: cachedResult.data.length,
        data: cachedResult.data,
        cached: true,
      });
    }

    res.setHeader("X-Cache", "MISS");
    const query = { user: req.user.id };

    if (completed !== undefined) {
      query.completed = completed === "true";
    }

    if (priority) {
      query.priority = priority.toLowerCase().trim();
    }

    if (search && search.trim()) {
      query.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
      ];
    }

    let sortOption = { createdAt: -1 };
    if (sort === "oldest") {
      sortOption = { createdAt: 1 };
    } else if (sort === "title") {
      sortOption = { title: 1 };
    } else if (sort === "priority") {
      sortOption = { priority: 1 };
    }

    const tasks = await Task.find(query).sort(sortOption).lean();

    setToCache(cacheKey, tasks);

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
      cached: false,
    });
  } catch (err) {
    next(err);
  }
}

// GET /tasks/:id - Get a single task by ID for authenticated user
export async function getTaskById(req, res, next) {
  try {
    const singleCacheKey = getSingleTaskCacheKey(req.user.id, req.params.id);

    const cachedResult = getFromCache(singleCacheKey);
    if (cachedResult.hit) {
      res.setHeader("X-Cache", "HIT");
      return res.status(200).json({
        success: true,
        data: cachedResult.data,
        cached: true,
      });
    }

    res.setHeader("X-Cache", "MISS");
    const task = await Task.findOne({
      _id: req.params.id,
      user: req.user.id,
    }).lean();

    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: `Task with ID '${req.params.id}' was not found.`,
      });
    }

    setToCache(singleCacheKey, task);

    res.status(200).json({
      success: true,
      data: task,
      cached: false,
    });
  } catch (err) {
    next(err);
  }
}

// POST /tasks - Create a new task and emit 'task-created' event asynchronously
export async function createTask(req, res, next) {
  try {
    const { title, description, priority, completed } = req.body;

    // Server-side validation
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: "Validation Error",
        message: "Task title is required and cannot be empty or whitespace only.",
      });
    }

    const validPriorities = ["low", "medium", "high"];
    if (priority && !validPriorities.includes(priority.toLowerCase().trim())) {
      return res.status(400).json({
        success: false,
        error: "Validation Error",
        message: `Invalid priority '${priority}'. Allowed values are: 'low', 'medium', 'high'.`,
      });
    }

    const newTask = new Task({
      title: title.trim(),
      description: description ? description.trim() : "",
      priority: priority ? priority.toLowerCase().trim() : "medium",
      completed: completed === true,
      user: req.user.id,
    });

    // 1. Database write
    const savedTask = await newTask.save();

    // 2. Invalidate user's all-tasks cache
    invalidateUserTasks(req.user.id);

    // 3. Requirement 3: Emit 'task-created' event AFTER DB write succeeds
    const apiResponseTime = new Date().toISOString();
    taskEvents.emit("task-created", {
      task: savedTask,
      user: req.user,
      apiResponseTime,
    });

    // 4. Return HTTP 201 immediately without waiting for slow notifications
    res.status(201).json({
      success: true,
      message: "Task created successfully.",
      data: savedTask,
      apiResponseTime,
    });
  } catch (err) {
    // If DB write fails, event is NOT emitted
    next(err);
  }
}

// PUT /tasks/:id - Update an existing task owned by the authenticated user
export async function updateTask(req, res, next) {
  try {
    const { title, description, priority, completed } = req.body;

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({
          success: false,
          error: "Validation Error",
          message: "Task title cannot be empty or whitespace only.",
        });
      }
    }

    const validPriorities = ["low", "medium", "high"];
    if (priority !== undefined && !validPriorities.includes(priority.toLowerCase().trim())) {
      return res.status(400).json({
        success: false,
        error: "Validation Error",
        message: `Invalid priority '${priority}'. Allowed values are: 'low', 'medium', 'high'.`,
      });
    }

    const task = await Task.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: `Task with ID '${req.params.id}' was not found.`,
      });
    }

    if (title !== undefined) task.title = title.trim();
    if (description !== undefined) task.description = description.trim();
    if (priority !== undefined) task.priority = priority.toLowerCase().trim();
    if (completed !== undefined) task.completed = Boolean(completed);

    const updatedTask = await task.save();

    invalidateUserTaskAndList(req.user.id, req.params.id);

    res.status(200).json({
      success: true,
      message: "Task updated successfully.",
      data: updatedTask,
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /tasks/:id - Delete a task and emit 'task-deleted' event asynchronously
export async function deleteTask(req, res, next) {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: `Task with ID '${req.params.id}' was not found.`,
      });
    }

    invalidateUserTaskAndList(req.user.id, req.params.id);

    // Requirement 4: Emit 'task-deleted' event with task info
    const deletedAt = new Date().toISOString();
    taskEvents.emit("task-deleted", {
      task,
      user: req.user,
      deletedAt,
    });

    res.status(200).json({
      success: true,
      message: "Task deleted successfully.",
      data: task,
      deletedAt,
    });
  } catch (err) {
    next(err);
  }
}

// GET /tasks/cache/stats - Debug endpoint for cache hit/miss statistics
export function getCacheStatsHandler(req, res) {
  const stats = getCacheStatistics();
  res.status(200).json({
    success: true,
    user: req.user.email,
    stats,
  });
}

// Reset cache statistics
export function resetCacheStatsHandler(req, res) {
  resetCacheStatistics();
  res.status(200).json({
    success: true,
    message: "Cache statistics reset successfully.",
  });
}

// Practical 10 Debug: GET /tasks/events/logs - Returns logged event execution history
export function getEventLogsHandler(req, res) {
  res.status(200).json({
    success: true,
    count: eventExecutionLogs.length,
    logs: eventExecutionLogs,
  });
}
