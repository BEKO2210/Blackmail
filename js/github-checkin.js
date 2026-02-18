/**
 * AEGIS GitHub Check-in Module
 * Automated heartbeat updates via GitHub API
 * PAT stored in localStorage, sent only to api.github.com
 */
var AegisGitHub = (function() {
  'use strict';

  var API_BASE = 'https://api.github.com';
  var STORAGE_KEY = 'aegis_github_config';

  /* ── Config management ── */

  function getConfig() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try { return JSON.parse(stored); } catch (e) { return null; }
  }

  function saveConfig(config) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  function clearConfig() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function isConfigured() {
    var c = getConfig();
    return !!(c && c.pat && c.owner && c.repo);
  }

  /* ── API helpers ── */

  function apiHeaders(pat) {
    return {
      'Authorization': 'Bearer ' + pat,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  /**
   * Test PAT validity and repo write access
   * @returns {{ valid: boolean, error?: string, user?: string }}
   */
  async function testConnection(pat, owner, repo) {
    try {
      var userResp = await fetch(API_BASE + '/user', { headers: apiHeaders(pat) });
      if (!userResp.ok) {
        return { valid: false, error: 'Invalid Personal Access Token (HTTP ' + userResp.status + ')' };
      }
      var userData = await userResp.json();

      var repoResp = await fetch(API_BASE + '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo), {
        headers: apiHeaders(pat)
      });
      if (!repoResp.ok) {
        return { valid: false, error: 'Cannot access repository ' + owner + '/' + repo + ' (HTTP ' + repoResp.status + ')' };
      }
      var repoData = await repoResp.json();
      if (!repoData.permissions || !repoData.permissions.push) {
        return { valid: false, error: 'PAT does not have write access to this repository.' };
      }

      return { valid: true, user: userData.login };
    } catch (e) {
      return { valid: false, error: 'Network error: ' + e.message };
    }
  }

  /**
   * Read current heartbeat.json from repo
   * @returns {{ content: object, sha: string } | null}
   */
  async function getHeartbeat(pat, owner, repo) {
    try {
      var resp = await fetch(
        API_BASE + '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/contents/heartbeat.json',
        { headers: apiHeaders(pat) }
      );
      if (resp.status === 404) return null;
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var data = await resp.json();
      var decoded = atob(data.content.replace(/\n/g, ''));
      return { content: JSON.parse(decoded), sha: data.sha };
    } catch (e) {
      console.error('[AegisGitHub] Failed to read heartbeat:', e);
      return null;
    }
  }

  /**
   * Write heartbeat.json to repo (creates a commit)
   */
  async function updateHeartbeat(pat, owner, repo, heartbeatData, existingSha) {
    var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(heartbeatData, null, 2) + '\n')));
    var body = {
      message: 'AEGIS check-in: ' + new Date().toISOString(),
      content: encoded
    };
    if (existingSha) body.sha = existingSha;

    var resp = await fetch(
      API_BASE + '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/contents/heartbeat.json',
      {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, apiHeaders(pat)),
        body: JSON.stringify(body)
      }
    );

    if (!resp.ok) {
      var errData = {};
      try { errData = await resp.json(); } catch (e) { /* ignore */ }
      throw new Error('GitHub API error (HTTP ' + resp.status + '): ' + (errData.message || 'Unknown'));
    }
    return await resp.json();
  }

  /**
   * Perform full heartbeat check-in:
   * Read config → get existing heartbeat → update timestamp → commit
   * @returns {{ success: boolean, timestamp?: string, error?: string }}
   */
  async function performHeartbeat() {
    var config = getConfig();
    if (!config || !config.pat || !config.owner || !config.repo) {
      return { success: false, error: 'GitHub not configured' };
    }

    try {
      var existing = await getHeartbeat(config.pat, config.owner, config.repo);
      var aegisConfig = {};
      try { aegisConfig = JSON.parse(localStorage.getItem('aegis_config') || '{}'); } catch (e) { /* ignore */ }
      var now = new Date().toISOString();
      var heartbeatData;

      if (existing && existing.content && existing.content.aegis_heartbeat) {
        heartbeatData = existing.content;
        heartbeatData.last_checkin = now;
        heartbeatData.escalation_state = 'OK';
        if (aegisConfig.interval) heartbeatData.interval_hours = aegisConfig.interval;
      } else {
        heartbeatData = {
          aegis_heartbeat: true,
          version: '1.0.0',
          last_checkin: now,
          interval_hours: aegisConfig.interval || 48,
          guardians: config.guardians || [],
          package_id_short: (aegisConfig.packageId || '').substring(0, 8),
          escalation_state: 'OK',
          site_url: config.siteUrl || ''
        };
      }

      await updateHeartbeat(config.pat, config.owner, config.repo, heartbeatData, existing ? existing.sha : null);
      return { success: true, timestamp: now };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  return {
    getConfig: getConfig,
    saveConfig: saveConfig,
    clearConfig: clearConfig,
    isConfigured: isConfigured,
    testConnection: testConnection,
    getHeartbeat: getHeartbeat,
    updateHeartbeat: updateHeartbeat,
    performHeartbeat: performHeartbeat
  };
})();
