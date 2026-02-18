/**
 * AEGIS i18n Module
 * Bilingual support: English (default) + German
 */
const AegisLang = (() => {
  'use strict';

  const SUPPORTED = ['en', 'de'];
  const DEFAULT = 'en';
  const STORAGE_KEY = 'aegis_lang';
  let current = DEFAULT;
  let strings = {};

  async function init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    current = (saved && SUPPORTED.includes(saved)) ? saved : DEFAULT;
    await load(current);
    apply();
    updateToggle();
  }

  async function load(lang) {
    try {
      const r = await fetch('i18n/' + lang + '.json');
      if (!r.ok) throw new Error(r.status);
      strings = await r.json();
    } catch (e) {
      console.error('Failed to load language: ' + lang, e);
    }
  }

  function apply() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (strings[key] !== undefined) {
        if (el.tagName === 'OPTION') {
          el.textContent = strings[key];
        } else {
          el.innerHTML = strings[key];
        }
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (strings[key] !== undefined) el.placeholder = strings[key];
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-title');
      if (strings[key] !== undefined) el.title = strings[key];
    });
    document.documentElement.lang = current;
  }

  async function switchLanguage(lang) {
    if (!SUPPORTED.includes(lang)) return;
    current = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    await load(lang);
    apply();
    updateToggle();
    document.dispatchEvent(new CustomEvent('aegis-lang-change', { detail: { lang: lang } }));
  }

  function updateToggle() {
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.lang === current);
    });
  }

  function t(key) {
    return strings[key] || key;
  }

  function getLang() {
    return current;
  }

  function getLocale() {
    return current === 'de' ? 'de-DE' : 'en-US';
  }

  return { init: init, switchLanguage: switchLanguage, t: t, getLang: getLang, getLocale: getLocale, apply: apply };
})();
