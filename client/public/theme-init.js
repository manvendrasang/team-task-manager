/*
 * Applies the saved theme before first paint to avoid a flash of the wrong
 * theme. Lives in an external file rather than inline in index.html so the
 * production Content-Security-Policy (script-src 'self') doesn't block it.
 */
(function () {
  try {
    var stored = localStorage.getItem('taskflow:theme');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  } catch (e) {
    /* localStorage unavailable (private mode) — the default attribute stands */
  }
})();