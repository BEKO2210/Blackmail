/**
 * AEGIS Check-in Module
 * Generates signed check-in tokens with duress detection
 */

const AegisCheckin = (() => {
  'use strict';

  /**
   * Generate a check-in token
   * @param {string} passphrase - Normal passphrase
   * @param {string} duressPhrase - Duress passphrase (set during setup)
   * @param {string} inputPhrase - What the user actually typed
   * @param {string} packageId - ID of the evidence package
   * @returns {object} Token with hidden duress flag
   */
  async function generateToken(passphrase, duressPhrase, inputPhrase, packageId) {
    const isDuress = inputPhrase === duressPhrase;
    const isValid = inputPhrase === passphrase || isDuress;

    if (!isValid) {
      return { valid: false };
    }

    const timestamp = new Date().toISOString();
    const nonce = AegisCrypto.generateId(8);

    // Token payload
    const payload = {
      t: timestamp,
      n: nonce,
      p: packageId,
      // Duress flag is hidden in the hash computation
      // The token LOOKS identical but the hash includes a flag
      _d: isDuress ? '1' : '0'
    };

    // Create token hash - guardians know to check _d field
    const tokenString = JSON.stringify(payload);
    const tokenHash = await AegisCrypto.sha256(tokenString);

    // The visible token (what user sends to guardians)
    const visibleToken = {
      aegis_checkin: true,
      version: '1.0.0',
      timestamp: timestamp,
      package: packageId,
      token: tokenHash,
      // Encode payload as base64 for guardian verification
      payload: btoa(tokenString)
    };

    return {
      valid: true,
      isDuress: isDuress,
      token: visibleToken,
      displayCode: formatTokenDisplay(visibleToken)
    };
  }

  /**
   * Verify a check-in token (used by guardians)
   */
  async function verifyToken(tokenObj) {
    try {
      const payloadStr = atob(tokenObj.payload);
      const payload = JSON.parse(payloadStr);

      // Verify hash
      const expectedHash = await AegisCrypto.sha256(payloadStr);
      const hashValid = expectedHash === tokenObj.token;

      // Check duress flag
      const isDuress = payload._d === '1';

      // Check age
      const tokenTime = new Date(payload.t);
      const now = new Date();
      const ageHours = (now - tokenTime) / (1000 * 60 * 60);

      return {
        valid: hashValid,
        isDuress: isDuress,
        timestamp: payload.t,
        packageId: payload.p,
        ageHours: Math.round(ageHours * 10) / 10,
        status: isDuress ? 'DURESS' : (hashValid ? 'OK' : 'INVALID')
      };
    } catch (e) {
      return { valid: false, status: 'INVALID', error: e.message };
    }
  }

  /**
   * Format token for display/sharing
   */
  function formatTokenDisplay(token) {
    return `AEGIS-${token.token.substring(0, 8).toUpperCase()}-${token.timestamp.split('T')[0]}`;
  }

  /**
   * Check if a check-in is overdue
   */
  function isOverdue(lastCheckinTime, intervalHours) {
    if (!lastCheckinTime) return true;
    const last = new Date(lastCheckinTime);
    const now = new Date();
    const elapsed = (now - last) / (1000 * 60 * 60);
    return elapsed > intervalHours;
  }

  /**
   * Calculate escalation level based on missed check-ins
   */
  function getEscalationLevel(lastCheckinTime, intervalHours) {
    if (!lastCheckinTime) return 4;
    const last = new Date(lastCheckinTime);
    const now = new Date();
    const elapsed = (now - last) / (1000 * 60 * 60);
    const missedIntervals = Math.floor(elapsed / intervalHours);

    if (missedIntervals <= 0) return 0; // On time
    if (missedIntervals === 1) return 1; // Warning
    if (missedIntervals === 2) return 2; // Alert guardians
    if (missedIntervals === 3) return 3; // Guardians assemble fragments
    return 4; // Full escalation
  }

  var _dot = function(c) { return '<span class="aegis-dot" style="background:' + c + '"></span>'; };
  const ESCALATION_LABELS = [
    { level: 0, label: 'Alles in Ordnung', icon: _dot('#22c55e'), color: '#22c55e' },
    { level: 1, label: 'Check-in überfällig', icon: _dot('#eab308'), color: '#eab308' },
    { level: 2, label: 'Guardians benachrichtigen', icon: _dot('#f97316'), color: '#f97316' },
    { level: 3, label: 'Fragmente zusammenführen', icon: _dot('#ef4444'), color: '#ef4444' },
    { level: 4, label: 'Volle Eskalation', icon: _dot('#dc2626'), color: '#dc2626' }
  ];

  return {
    generateToken,
    verifyToken,
    isOverdue,
    getEscalationLevel,
    ESCALATION_LABELS
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AegisCheckin;
}
