import { useMemo } from "react";

function TaskAnalytics({ tasks = [] }) {
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    const pending = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const high = tasks.filter((t) => (t.priority || "medium") === "high").length;
    const medium = tasks.filter((t) => (t.priority || "medium") === "medium").length;
    const low = tasks.filter((t) => (t.priority || "medium") === "low").length;

    return { total, completed, pending, completionRate, high, medium, low };
  }, [tasks]);

  return (
    <div className="task-analytics-card" role="region" aria-label="Task Analytics and Statistics">
      <div className="analytics-header">
        <div className="analytics-title-group">
          <span className="analytics-icon" aria-hidden="true">📈</span>
          <h3 className="card-title">Task Productivity Analytics</h3>
        </div>
        <span className="analytics-badge">Lazy-Loaded Visualizer</span>
      </div>

      <div className="analytics-metrics-grid">
        <div className="metric-box">
          <span className="metric-number">{stats.total}</span>
          <span className="metric-label">Total Tasks</span>
        </div>
        <div className="metric-box completion-box">
          <span className="metric-number">{stats.completionRate}%</span>
          <span className="metric-label">Completed ({stats.completed}/{stats.total})</span>
        </div>
        <div className="metric-box pending-box">
          <span className="metric-number">{stats.pending}</span>
          <span className="metric-label">Pending</span>
        </div>
      </div>

      {/* Visual Completion Progress Bar */}
      <div className="analytics-progress-section">
        <div className="progress-labels">
          <span>Overall Completion</span>
          <span className="progress-percentage">{stats.completionRate}%</span>
        </div>
        <div className="progress-track" role="progressbar" aria-valuenow={stats.completionRate} aria-valuemin="0" aria-valuemax="100">
          <div
            className="progress-fill"
            style={{ width: `${stats.completionRate}%` }}
          ></div>
        </div>
      </div>

      {/* Priority Distribution Breakdown */}
      <div className="priority-breakdown">
        <h4 className="breakdown-title">Priority Breakdown</h4>
        <div className="priority-bars-container">
          <div className="priority-bar-row">
            <span className="priority-label high-label">High ({stats.high})</span>
            <div className="bar-track">
              <div
                className="bar-fill high-fill"
                style={{ width: stats.total > 0 ? `${(stats.high / stats.total) * 100}%` : "0%" }}
              ></div>
            </div>
          </div>

          <div className="priority-bar-row">
            <span className="priority-label medium-label">Medium ({stats.medium})</span>
            <div className="bar-track">
              <div
                className="bar-fill medium-fill"
                style={{ width: stats.total > 0 ? `${(stats.medium / stats.total) * 100}%` : "0%" }}
              ></div>
            </div>
          </div>

          <div className="priority-bar-row">
            <span className="priority-label low-label">Low ({stats.low})</span>
            <div className="bar-track">
              <div
                className="bar-fill low-fill"
                style={{ width: stats.total > 0 ? `${(stats.low / stats.total) * 100}%` : "0%" }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaskAnalytics;
