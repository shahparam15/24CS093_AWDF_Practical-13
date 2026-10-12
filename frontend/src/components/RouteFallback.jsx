function RouteFallback({ message = "Loading page content..." }) {
  return (
    <div
      className="route-suspense-fallback"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="fallback-inner-card">
        <div className="loading-spinner" aria-hidden="true"></div>
        <p className="fallback-message">{message}</p>
        <span className="fallback-tag">Optimized via Dynamic Code Splitting</span>
      </div>
    </div>
  );
}

export default RouteFallback;
