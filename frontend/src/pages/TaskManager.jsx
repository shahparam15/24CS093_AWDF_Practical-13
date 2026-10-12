import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { getTasks, createTask, updateTask, deleteTask, generateAiDescription } from "../api";
import Toast from "../components/Toast";
import ConfirmModal from "../components/ConfirmModal";
import TaskItem from "../components/TaskItem";
import Auth from "./Auth";

// Component-Level Code Splitting: Lazy load TaskAnalytics visualizer on demand
const TaskAnalytics = lazy(() => import("../components/TaskAnalytics"));

function AnalyticsSkeleton() {
  return (
    <div className="analytics-skeleton" role="status" aria-live="polite">
      <div className="skeleton-spinner"></div>
      <span>Loading productivity analytics visualization chunk...</span>
    </div>
  );
}

function TaskManager({ currentUser, onLoginSuccess }) {
  // 1. Core Task State
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // 2. Task Creation Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiNotice, setAiNotice] = useState("");

  // 3. Search & Filter State (optimized with useMemo)
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // 4. Analytics Toggle State (Lazy Loaded component trigger)
  const [showAnalytics, setShowAnalytics] = useState(false);

  // 5. Active Editing Task ID (Inline state isolated within TaskItem)
  const [editingTaskId, setEditingTaskId] = useState(null);

  // 6. Deletion State
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 7. Toast Feedback State
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 4500);
  }, []);

  // Fetch Tasks for the authenticated user from Express + MongoDB
  const loadTasks = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await getTasks();
      setTasks(data);
    } catch (err) {
      setFetchError(err.message);
      showToast("error", err.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, showToast]);

  // Synchronize tasks on user change
  useEffect(() => {
    if (currentUser) {
      loadTasks();
    } else {
      setTasks([]);
    }
  }, [currentUser, loadTasks]);

  // Create Task with Optimistic UI Update
  const handleCreateTask = async (e) => {
    e.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setFormError("Task title is required.");
      return;
    }
    setFormError("");
    setIsSubmitting(true);

    const tempId = `temp-${Date.now()}`;
    const optimisticTask = {
      _id: tempId,
      title: trimmedTitle,
      description: description.trim(),
      priority,
      completed: false,
      user: currentUser ? currentUser.id : null,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    // Optimistically update state
    setTasks((prev) => [optimisticTask, ...prev]);
    setTitle("");
    setDescription("");
    setPriority("medium");
    setAiNotice("");

    try {
      const created = await createTask({
        title: trimmedTitle,
        description: optimisticTask.description,
        priority,
        completed: false,
      });

      // Replace optimistic placeholder with real MongoDB document
      setTasks((prev) =>
        prev.map((t) => (t._id === tempId ? created : t))
      );
      showToast("success", `Task "${created.title}" saved to MongoDB!`);
    } catch (err) {
      // Roll back optimistic task on server failure
      setTasks((prev) => prev.filter((t) => t._id !== tempId));
      setFormError(err.message);
      showToast("error", `Failed to save task: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Practical 13: Generate AI Task Description
  const handleGenerateAiDescription = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError("Please enter a task title first before generating an AI description.");
      return;
    }
    setFormError("");
    setIsGeneratingAi(true);
    setAiNotice("");

    try {
      const res = await generateAiDescription({
        title: trimmedTitle,
        priority,
        category: "General",
      });

      if (res && res.description) {
        setDescription(res.description);
        setAiNotice(
          res.disclaimer ||
            (res.source === "fallback"
              ? "Contextual task description generated. Feel free to review or customize."
              : "AI-generated description generated via LLM. Review and adjust before saving.")
        );
        showToast("success", "Task description generated successfully!");
      } else {
        throw new Error("No description returned from AI service.");
      }
    } catch (err) {
      setFormError(`AI Generation Notice: ${err.message}. You can still type the description manually.`);
      showToast("error", `AI generation notice: ${err.message}`);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Toggle Task Completion (memoized with useCallback)
  const handleToggleComplete = useCallback(
    async (task) => {
      const originalCompleted = task.completed;
      const newCompleted = !originalCompleted;

      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t._id === task._id ? { ...t, completed: newCompleted } : t))
      );

      try {
        const updated = await updateTask(task._id, { completed: newCompleted });
        setTasks((prev) =>
          prev.map((t) => (t._id === task._id ? updated : t))
        );
        showToast(
          "info",
          `Task "${task.title}" marked as ${newCompleted ? "completed" : "pending"}.`
        );
      } catch (err) {
        // Revert on error
        setTasks((prev) =>
          prev.map((t) => (t._id === task._id ? { ...t, completed: originalCompleted } : t))
        );
        showToast("error", `Failed to update status: ${err.message}`);
      }
    },
    [showToast]
  );

  // Edit Handlers (memoized with useCallback to maintain stable references for React.memo)
  const handleStartEdit = useCallback((task) => {
    setEditingTaskId(task._id);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingTaskId(null);
  }, []);

  const handleSaveEdit = useCallback(
    async (taskId, updatedData) => {
      const trimmedTitle = (updatedData.title || "").trim();
      if (!trimmedTitle) {
        showToast("error", "Task title cannot be empty.");
        return;
      }

      try {
        const updated = await updateTask(taskId, {
          title: trimmedTitle,
          description: (updatedData.description || "").trim(),
          priority: updatedData.priority || "medium",
        });

        setTasks((prev) =>
          prev.map((t) => (t._id === taskId ? updated : t))
        );
        setEditingTaskId(null);
        showToast("success", "Task updated successfully in MongoDB!");
      } catch (err) {
        showToast("error", `Failed to update task: ${err.message}`);
      }
    },
    [showToast]
  );

  const handleDeleteRequest = useCallback((task) => {
    setTaskToDelete(task);
  }, []);

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;
    setIsDeleting(true);

    try {
      await deleteTask(taskToDelete._id);
      setTasks((prev) => prev.filter((t) => t._id !== taskToDelete._id));
      showToast("success", `Task "${taskToDelete.title}" deleted from MongoDB.`);
    } catch (err) {
      showToast("error", `Failed to delete task: ${err.message}`);
    } finally {
      setIsDeleting(false);
      setTaskToDelete(null);
    }
  };

  // Performance Optimization: Derived filtered and searched task list memoized with useMemo
  const filteredTasks = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return tasks.filter((task) => {
      const matchesSearch =
        !q ||
        task.title.toLowerCase().includes(q) ||
        (task.description && task.description.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "completed" ? task.completed : !task.completed);

      const matchesPriority =
        priorityFilter === "all" ||
        (task.priority || "medium") === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tasks, searchTerm, statusFilter, priorityFilter]);

  // ALL HOOKS CALLED UNCONDITIONALLY ABOVE ^^^
  // Unauthenticated view rendered cleanly below
  if (!currentUser) {
    return (
      <div className="page-container task-manager-page auth-required-view">
        <section className="portfolio-section">
          <div className="section-container">
            <div className="section-header-block">
              <h2 className="section-heading">Authentication Required</h2>
              <p className="section-subtext">
                Task endpoints are strictly protected by JWT middleware. Please sign in or create an account to manage your private tasks.
              </p>
            </div>
            <Auth onLoginSuccess={onLoginSuccess} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-container task-manager-page">
      {/* Toast Feedback */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(taskToDelete)}
        title="Delete Task"
        message={`Are you sure you want to permanently delete "${taskToDelete?.title}" from MongoDB?`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setTaskToDelete(null)}
        isProcessing={isDeleting}
      />

      <section className="portfolio-section">
        <div className="section-container">
          <div className="section-header-block">
            <h2 className="section-heading">Full Stack Protected Task Manager</h2>
            <p className="section-subtext">
              Real-time CRUD operations connecting React to Express &amp; MongoDB with in-memory <code>node-cache</code> Caching (60s TTL), granular write invalidation, and JWT Authentication.
            </p>

            <div className="auth-user-banner">
              <span className="auth-badge-icon">🔐</span>
              <span className="auth-badge-text">
                Signed in as: <strong>{currentUser.email}</strong>
              </span>
              <span className="auth-badge-tag">Bearer JWT Active</span>
              <span className="auth-badge-tag" style={{ backgroundColor: "#10b981", marginLeft: "6px" }}>⚡ node-cache Active</span>
            </div>

            {/* Performance Feature: On-Demand Lazy Component Splitting */}
            <div className="analytics-toggle-bar">
              <button
                type="button"
                onClick={() => setShowAnalytics((prev) => !prev)}
                className={`analytics-toggle-btn ${showAnalytics ? "active" : ""}`}
                aria-expanded={showAnalytics}
              >
                <span>{showAnalytics ? "Hide Analytics 📊" : "Show Productivity Analytics 📈"}</span>
                <span className="analytics-lazy-hint">(Lazy Loaded Component Chunk)</span>
              </button>
            </div>
          </div>

          {/* Lazy-Loaded Task Analytics Section */}
          {showAnalytics && (
            <div className="analytics-container-wrapper">
              <Suspense fallback={<AnalyticsSkeleton />}>
                <TaskAnalytics tasks={tasks} />
              </Suspense>
            </div>
          )}

          <div className="task-manager-layout">
            {/* Task Creation Form Card */}
            <div className="task-form-card">
              <h3 className="card-title">Add New Task</h3>
              <form onSubmit={handleCreateTask} className="task-form" noValidate>
                {formError && <div className="form-error-banner">{formError}</div>}

                <div className="form-group">
                  <label htmlFor="task-title" className="form-label">
                    Title <span className="required-star">*</span>
                  </label>
                  <input
                    id="task-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter task title..."
                    className="form-input"
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div className="form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <label htmlFor="task-description" className="form-label" style={{ marginBottom: 0 }}>
                      Description (Optional)
                    </label>
                    <button
                      type="button"
                      id="ai-generate-description-btn"
                      onClick={handleGenerateAiDescription}
                      disabled={isGeneratingAi || isSubmitting}
                      className="ai-generate-btn"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 10px",
                        fontSize: "0.82rem",
                        fontWeight: "600",
                        background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "6px",
                        cursor: isGeneratingAi ? "not-allowed" : "pointer",
                        transition: "all 0.2s ease",
                      }}
                      title="Generate automated description based on the entered task title"
                    >
                      {isGeneratingAi ? (
                        <>
                          <span
                            className="ai-spinner"
                            style={{
                              display: "inline-block",
                              width: "12px",
                              height: "12px",
                              border: "2px solid #ffffff",
                              borderTopColor: "transparent",
                              borderRadius: "50%",
                              animation: "spin 0.8s linear infinite",
                            }}
                          ></span>
                          Generating...
                        </>
                      ) : (
                        <>✨ Generate description</>
                      )}
                    </button>
                  </div>
                  <textarea
                    id="task-description"
                    rows="4"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide additional details or notes, or click '✨ Generate description' above..."
                    className="form-input form-textarea"
                    disabled={isSubmitting}
                  />
                  {aiNotice && (
                    <div
                      className="ai-notice-banner"
                      style={{
                        marginTop: "8px",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        backgroundColor: "#f5f3ff",
                        color: "#5b21b6",
                        border: "1px solid #ddd6fe",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span>🤖</span>
                      <span>{aiNotice}</span>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="task-priority" className="form-label">
                    Priority
                  </label>
                  <select
                    id="task-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="form-input form-select"
                    disabled={isSubmitting}
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="submit-task-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving to MongoDB..." : "➕ Create Task"}
                </button>
              </form>
            </div>

            {/* Task List Showcase Area */}
            <div className="task-list-card">
              <div className="task-list-header">
                <h3 className="card-title">
                  Your Tasks ({filteredTasks.length}{tasks.length !== filteredTasks.length ? ` of ${tasks.length}` : ""})
                </h3>
                <button
                  type="button"
                  onClick={loadTasks}
                  className="refresh-btn"
                  disabled={isLoading}
                  title="Reload from MongoDB"
                >
                  🔄 Refresh
                </button>
              </div>

              {/* Filtering Controls (Demonstrates useMemo derived computations) */}
              <div className="task-filters-bar">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter tasks by text..."
                  className="task-search-input"
                  aria-label="Filter tasks by text"
                />
                <div className="filter-selects-row">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="task-filter-select"
                    aria-label="Filter by completion status"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending Only</option>
                    <option value="completed">Completed Only</option>
                  </select>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="task-filter-select"
                    aria-label="Filter by priority"
                  >
                    <option value="all">All Priorities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              {isLoading ? (
                <div className="task-loading-state">
                  <div className="loading-spinner"></div>
                  <p>Fetching authenticated tasks from MongoDB...</p>
                </div>
              ) : fetchError ? (
                <div className="task-error-state">
                  <p className="error-text">⚠️ {fetchError}</p>
                  <button type="button" onClick={loadTasks} className="retry-fetch-btn">
                    🔄 Retry Fetch
                  </button>
                </div>
              ) : tasks.length === 0 ? (
                <div className="task-empty-state">
                  <p>You have no saved tasks yet. Create one on the left to test your private pipeline!</p>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="task-empty-state">
                  <p>No tasks match the active filter criteria.</p>
                </div>
              ) : (
                <div className="tasks-container">
                  {filteredTasks.map((task) => (
                    <TaskItem
                      key={task._id}
                      task={task}
                      isEditing={editingTaskId === task._id}
                      onSaveEdit={handleSaveEdit}
                      onCancelEdit={handleCancelEdit}
                      onToggleComplete={handleToggleComplete}
                      onStartEdit={handleStartEdit}
                      onDeleteRequest={handleDeleteRequest}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default TaskManager;
