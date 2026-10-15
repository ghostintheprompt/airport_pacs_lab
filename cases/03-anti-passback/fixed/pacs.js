// FIXED: closes the race found in ../vulnerable/pacs.js. The check and
// the commit are still separated by the same controller round-trip delay
// -- that part is realistic and stays -- but a badge is now locked
// synchronously, before the delay, the instant it passes its checks. Any
// other concurrent request for that same badge sees the lock and is
// rejected outright, rather than reading the same stale currentZone every
// other concurrent copy also read. This is the standard fix for this
// class of bug: serialize on the resource (the badge's transit state),
// not on time.

const ZONES = ['landside', 'sterile', 'ramp', 'tarmac'];

function zoneIndex(zone) {
  return ZONES.indexOf(zone);
}

function adjacent(zoneA, zoneB) {
  return Math.abs(zoneIndex(zoneA) - zoneIndex(zoneB)) === 1;
}

function createPacs({ controllerDelayMs = 15 } = {}) {
  const badges = {
    badge_alice: { authorizedZones: ['landside', 'sterile', 'ramp', 'tarmac'], currentZone: 'landside', locked: false },
    badge_bob: { authorizedZones: ['landside', 'sterile'], currentZone: 'landside', locked: false },
  };

  const log = [];

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function requestTransit({ badgeId, doorFrom, doorTo }) {
    const badge = badges[badgeId];
    if (!badge) return { ok: false, reason: 'unknown badge' };
    if (!adjacent(doorFrom, doorTo)) return { ok: false, reason: 'not a real door' };

    // --- CHECK phase, fully synchronous, no await before the lock ---
    if (badge.locked) {
      const reason = 'transit already in progress for this badge (possible badge-sharing/replay)';
      log.push({ badgeId, doorFrom, doorTo, ok: false, reason });
      return { ok: false, reason };
    }

    const startZone = badge.currentZone;
    const targetZone = doorTo;

    if (!badge.authorizedZones.includes(targetZone)) {
      log.push({ badgeId, doorFrom, doorTo, ok: false, reason: 'not authorized for target zone' });
      return { ok: false, reason: 'not authorized for target zone' };
    }
    if (startZone !== doorFrom) {
      const reason = `anti-passback: badge is in ${startZone}, not ${doorFrom}`;
      log.push({ badgeId, doorFrom, doorTo, ok: false, reason });
      return { ok: false, reason };
    }

    // Reserve the badge's transit state BEFORE the round-trip, closing
    // the window the vulnerable version left open.
    badge.locked = true;

    // --- controller round-trip, simulated ---
    await sleep(controllerDelayMs);

    // --- COMMIT phase ---
    badge.currentZone = targetZone;
    badge.locked = false;
    log.push({ badgeId, doorFrom, doorTo, ok: true, newZone: targetZone });
    return { ok: true, newZone: targetZone };
  }

  return { badges, log, requestTransit, ZONES };
}

module.exports = { createPacs, ZONES };
