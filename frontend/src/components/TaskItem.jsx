import { useState, memo } from "react";

function TaskEditForm({ task, onSaveEdit, onCancelEdit }) {
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftDescription, setDraftDescription] = useState(task.description || "");
  const [draftPriority, setDraftPriority] = useState(task.priority || "medium");

  const handleSave = () => {
    onSaveEdit(task._id, {
      title: draftTitle,
      description: draftDescription,
      priority: draftPriority,
    });
  };

  return (
    <div className="task-edit-mode">
      <input
        type="text"
        value={draftTitle}
        onChange={(e) => setDraftTitle(e.target.value)}
        className="edit-input"
        placeholder="Task title..."
      />
      <textarea
        value={draftDescription}
        onChange={(e) => setDraftDescription(e.target.value)}
        className="edit-textarea"
        placeholder="Description..."
        rows="2"
      />
      <div className="edit-controls-row">
        <select
          value={draftPriority}
          onChange={(e) => setDraftPriority(e.target.value)}
          className="edit-select"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <div className="edit-buttons">
          <button
            type="button"
            onClick={handleSave}
            className="save-edit-btn"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancelEdit}
            className="cancel-edit-btn"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const TaskItem = memo(function TaskItem({
  task,
  isEditing,
  onSaveEdit,
  onCancelEdit,
  onToggleComplete,
  onStartEdit,
  onDeleteRequest,
}) {
  return (
    <div
      className={`task-item ${task.completed ? "task-completed" : ""} ${
        task.isOptimistic ? "task-optimistic" : ""
      }`}
    >
      {isEditing ? (
        <TaskEditForm
          task={task}
          onSaveEdit={onSaveEdit}
          onCancelEdit={onCancelEdit}
        />
      ) : (
        // Standard View Mode
        <div className="task-view-mode">
          <div className="task-main-info">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => onToggleComplete(task)}
                aria-label={`Mark ${task.title} as ${
                  task.completed ? "incomplete" : "complete"
                }`}
              />
              <span className="checkmark"></span>
            </label>

            <div className="task-texts">
              <div className="task-title-row">
                <h4 className="task-title">{task.title}</h4>
                <span className={`priority-badge priority-${task.priority || "medium"}`}>
                  {task.priority || "medium"}
                </span>
                {task.isOptimistic && (
                  <span className="optimistic-tag">Syncing...</span>
                )}
              </div>
              {task.description && (
                <p className="task-description">{task.description}</p>
              )}
              <span className="task-date">
                Added {new Date(task.createdAt).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="task-actions">
            <button
              type="button"
              onClick={() => onStartEdit(task)}
              className="edit-action-btn"
              title="Edit Task"
              aria-label={`Edit ${task.title}`}
            >
              ✏️ Edit
            </button>
            <button
              type="button"
              onClick={() => onDeleteRequest(task)}
              className="delete-action-btn"
              title="Delete Task"
              aria-label={`Delete ${task.title}`}
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default TaskItem;
