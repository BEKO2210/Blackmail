/**
 * AEGIS Main Module
 * Navigation, shared utilities, initialization
 */
(function () {
  'use strict';

  // ── Init ──
  document.addEventListener('DOMContentLoaded', async function () {
    await AegisLang.init();
    initNav();
    highlightActiveNav();
    document.dispatchEvent(new CustomEvent('aegis-ready'));
  });

  // ── Hamburger Navigation ──
  function initNav() {
    var toggle = document.getElementById('navToggle');
    var nav = document.getElementById('aegisNav');
    if (!toggle || !nav) return;

    var backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    document.body.appendChild(backdrop);

    function openNav() {
      nav.classList.add('open');
      toggle.classList.add('open');
      backdrop.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function closeNav() {
      nav.classList.remove('open');
      toggle.classList.remove('open');
      backdrop.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    toggle.addEventListener('click', function () {
      if (nav.classList.contains('open')) {
        closeNav();
      } else {
        openNav();
      }
    });

    backdrop.addEventListener('click', closeNav);

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        closeNav();
      }
    });

    // Language toggle buttons
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        AegisLang.switchLanguage(btn.dataset.lang);
      });
    });
  }

  // ── Active Link ──
  function highlightActiveNav() {
    var page = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      if (a.getAttribute('href') === page) {
        a.classList.add('active');
      }
    });
  }

  // ── Shared Utilities (global) ──
  window.escapeHtml = function (str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  window.formatSize = function (bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  window.getFileIcon = function (type) {
    if (!type) return AegisIcons.file;
    if (type.startsWith('image/')) return AegisIcons.image;
    if (type.startsWith('video/')) return AegisIcons.video;
    if (type.startsWith('audio/')) return AegisIcons.music;
    if (type.includes('pdf')) return AegisIcons.fileText;
    if (type.includes('text')) return AegisIcons.fileText;
    return AegisIcons.file;
  };

  window.downloadFile = function (content, filename, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
})();
