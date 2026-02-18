/**
 * AEGIS Shamir's Secret Sharing Module
 * Split a secret into N shares, requiring M to reconstruct
 * Operates over GF(256) for byte-level splitting
 */

const AegisShamir = (() => {
  'use strict';

  // GF(256) with irreducible polynomial x^8 + x^4 + x^3 + x + 1 (0x11b)
  const EXP_TABLE = new Uint8Array(512);
  const LOG_TABLE = new Uint8Array(256);

  // Initialize lookup tables
  (function initTables() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP_TABLE[i] = x;
      LOG_TABLE[x] = i;
      x = x ^ (x << 1);
      if (x >= 256) x ^= 0x11b;
    }
    for (let i = 255; i < 512; i++) {
      EXP_TABLE[i] = EXP_TABLE[i - 255];
    }
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
  }

  function gfDiv(a, b) {
    if (b === 0) throw new Error('Division by zero');
    if (a === 0) return 0;
    return EXP_TABLE[(LOG_TABLE[a] - LOG_TABLE[b] + 255) % 255];
  }

  /**
   * Evaluate polynomial at x in GF(256)
   */
  function evaluatePolynomial(coeffs, x) {
    let result = 0;
    for (let i = coeffs.length - 1; i >= 0; i--) {
      result = gfMul(result, x) ^ coeffs[i];
    }
    return result;
  }

  /**
   * Lagrange interpolation at x=0 in GF(256)
   */
  function lagrangeInterpolate(points) {
    let result = 0;
    for (let i = 0; i < points.length; i++) {
      let num = 1;
      let den = 1;
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue;
        num = gfMul(num, points[j][0]);
        den = gfMul(den, points[i][0] ^ points[j][0]);
      }
      result ^= gfMul(gfMul(num, gfDiv(1, den)), points[i][1]);
    }
    return result;
  }

  /**
   * Split a secret (Uint8Array) into N shares, threshold M
   * @param {Uint8Array} secret - The secret to split
   * @param {number} numShares - Total number of shares (N)
   * @param {number} threshold - Minimum shares to reconstruct (M)
   * @returns {Array} Array of share objects { id, data }
   */
  function split(secret, numShares, threshold) {
    if (threshold > numShares) {
      throw new Error('Threshold cannot exceed number of shares');
    }
    if (threshold < 2) {
      throw new Error('Threshold must be at least 2');
    }
    if (numShares > 254) {
      throw new Error('Maximum 254 shares supported');
    }

    const shares = [];
    for (let i = 0; i < numShares; i++) {
      shares.push({
        id: i + 1,
        threshold: threshold,
        totalShares: numShares,
        data: new Uint8Array(secret.length)
      });
    }

    // For each byte of the secret
    for (let byteIdx = 0; byteIdx < secret.length; byteIdx++) {
      // Create random polynomial with secret as constant term
      const coeffs = new Uint8Array(threshold);
      coeffs[0] = secret[byteIdx];

      // Random coefficients for higher terms
      crypto.getRandomValues(coeffs.subarray(1));

      // Evaluate polynomial at each share point
      for (let shareIdx = 0; shareIdx < numShares; shareIdx++) {
        shares[shareIdx].data[byteIdx] = evaluatePolynomial(
          coeffs,
          shareIdx + 1 // x values: 1, 2, 3, ...
        );
      }
    }

    return shares;
  }

  /**
   * Combine shares to reconstruct the secret
   * @param {Array} shares - Array of share objects { id, data }
   * @returns {Uint8Array} Reconstructed secret
   */
  function combine(shares) {
    if (shares.length < 2) {
      throw new Error('Need at least 2 shares');
    }

    const secretLength = shares[0].data.length;
    const secret = new Uint8Array(secretLength);

    for (let byteIdx = 0; byteIdx < secretLength; byteIdx++) {
      const points = shares.map(s => [s.id, s.data[byteIdx]]);
      secret[byteIdx] = lagrangeInterpolate(points);
    }

    return secret;
  }

  /**
   * Export a share as a portable JSON string
   */
  function exportShare(share) {
    return {
      aegis_share: true,
      version: '1.0.0',
      id: share.id,
      threshold: share.threshold,
      totalShares: share.totalShares,
      data: AegisCrypto.bufferToBase64(share.data),
      created: new Date().toISOString()
    };
  }

  /**
   * Import a share from JSON
   */
  function importShare(shareJson) {
    const parsed = typeof shareJson === 'string' ? JSON.parse(shareJson) : shareJson;
    if (!parsed.aegis_share) {
      throw new Error('Invalid AEGIS share format');
    }
    return {
      id: parsed.id,
      threshold: parsed.threshold,
      totalShares: parsed.totalShares,
      data: new Uint8Array(AegisCrypto.base64ToBuffer(parsed.data))
    };
  }

  /**
   * Create guardian kits from shares
   * Each kit contains: the share, instructions, and verification info
   */
  function createGuardianKits(shares, packageId, checkinInterval) {
    return shares.map((share, index) => {
      const exported = exportShare(share);
      return {
        aegis_guardian_kit: true,
        version: '1.0.0',
        guardianNumber: index + 1,
        totalGuardians: share.totalShares,
        requiredGuardians: share.threshold,
        packageId: packageId,
        checkinIntervalHours: checkinInterval,
        share: exported,
        instructions: generateGuardianInstructions(
          index + 1,
          share.threshold,
          share.totalShares,
          checkinInterval
        ),
        created: new Date().toISOString()
      };
    });
  }

  /**
   * Generate human-readable instructions for a guardian
   */
  function generateGuardianInstructions(guardianNum, threshold, total, intervalHours) {
    return {
      de: `
AEGIS GUARDIAN KIT — Guardian #${guardianNum}
============================================

Du wurdest als Vertrauensperson ausgewählt, um verschlüsselte 
Informationen zu schützen. Bitte lies diese Anleitung sorgfältig.

WAS DU HAST:
- Ein verschlüsseltes Fragment (1 von ${total})
- Es werden mindestens ${threshold} von ${total} Fragmenten benötigt

WAS DU TUN MUSST:
1. Bewahre dieses Kit sicher auf (USB-Stick, ausgedruckt, etc.)
2. Du wirst regelmäßig (alle ${intervalHours}h) ein Check-in-Token erhalten
3. Prüfe das Token auf der AEGIS Guardian-Seite
4. Wenn Check-ins ausbleiben, folge dem Eskalationsplan

ESKALATIONSPLAN:
- 1x verpasst: Versuche die Person zu kontaktieren
- 2x verpasst: Kontaktiere andere Guardians (falls bekannt)
- 3x verpasst: Führe dein Fragment mit anderen zusammen
- 4x verpasst: Veröffentliche gemäß dem vereinbarten Plan

WICHTIG:
[!] Wenn das Token den Status "DURESS" zeigt, ist die Person 
   möglicherweise in Gefahr und wird gezwungen sich zu melden.
   → Sofort Eskalationsstufe 3 einleiten!

[!] Wenn jemand versucht, dich unter Druck zu setzen, dein 
   Fragment herauszugeben → Das alleine ist Grund für Eskalation.

[!] Gib dein Fragment NIEMALS an Einzelpersonen weiter.
   Nur gemeinsam mit anderen Guardians rekonstruieren.
      `.trim(),

      en: `
AEGIS GUARDIAN KIT — Guardian #${guardianNum}
============================================

You have been chosen as a trusted person to protect encrypted 
information. Please read these instructions carefully.

WHAT YOU HAVE:
- An encrypted fragment (1 of ${total})
- At least ${threshold} of ${total} fragments are needed to decrypt

WHAT YOU MUST DO:
1. Store this kit safely (USB drive, printed, etc.)
2. You will regularly (every ${intervalHours}h) receive a check-in token
3. Verify the token on the AEGIS Guardian page
4. If check-ins stop, follow the escalation plan

ESCALATION PLAN:
- 1x missed: Try to contact the person
- 2x missed: Contact other guardians (if known)
- 3x missed: Combine your fragment with others
- 4x missed: Publish according to the agreed plan

IMPORTANT:
[!] If the token shows "DURESS" status, the person may be in 
   danger and forced to check in.
   → Immediately initiate escalation level 3!

[!] If someone tries to pressure you into giving up your 
   fragment → This alone is grounds for escalation.

[!] NEVER give your fragment to individuals.
   Only reconstruct together with other guardians.
      `.trim()
    };
  }

  return {
    split,
    combine,
    exportShare,
    importShare,
    createGuardianKits
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AegisShamir;
}
