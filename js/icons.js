/**
 * AEGIS Icon System — Clean SVG Icons (Lucide-inspired)
 * Replaces all emoji usage with consistent, premium SVG icons
 */
window.AegisIcons = (function () {
  'use strict';

  var a = ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
  var z = '</svg>';

  function i(paths, cls) {
    return '<svg class="aegis-icon' + (cls ? ' ' + cls : '') + '"' + a + paths + z;
  }

  return {
    shield: i('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
    lock: i('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>'),
    unlock: i('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/>'),
    share: i('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/>'),
    clock: i('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
    alertTriangle: i('<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4m0 4h.01"/>'),
    info: i('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/>'),
    check: i('<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>'),
    checkSmall: i('<path d="M20 6L9 17l-5-5"/>'),
    xCircle: i('<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6m0-6l6 6"/>'),
    bell: i('<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>'),
    upload: i('<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>'),
    zap: i('<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>'),
    package: i('<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/>'),
    folder: i('<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>'),
    clipboard: i('<path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>'),
    download: i('<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>'),
    loader: i('<path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>'),
    file: i('<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>'),
    fileText: i('<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8m8 4H8"/>'),
    image: i('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'),
    video: i('<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>'),
    music: i('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
    arrowRight: i('<path d="M5 12h14m-7-7l7 7-7 7"/>'),
    arrowLeft: i('<path d="M19 12H5m7 7l-7-7 7-7"/>'),

    // Status dots for escalation levels
    dot: function (color) {
      return '<span class="aegis-dot" style="background:' + (color || 'currentColor') + '"></span>';
    }
  };
})();
