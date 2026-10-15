// VULNERABLE: this is the implementation as originally built straight,
// the way a real controller would be -- not written backward from a known
// bug. It was then explored (see ../explore.js) rather than audited line
// by line, and that's how the race below was actually found: every
// concurrent copy of a request reads the same stale badge.currentZone
// before any of them commits, so N simultaneous presentations of one
// shared/cloned badge all succeed. Sequential re-entry (no concurrency)
// is correctly rejected -- this is specifically a TOCTOU gap between the
// check and the commit, opened by the controller round-trip delay a real
// system has.
//
// Zone chain (airport-standard linear progression):
//   landside -> sterile -> ramp -> tarmac
// Each door sits between exactly two adjacent zones and is read in both
// directions (entering the inner zone, or exiting back to the outer one).
// Anti-passback rule: a badge's recorded currentZone must match the zone
// it's transiting FROM, or the transit is refused -- this is what's
// supposed to stop a shared/tailgated badge from producing two "in"
// events without an "out" in between.
//
// One deliberate piece of realism: committing a transit isn't instant.
// A real door controller round-trips to a central access-control server
// to check and record the badge's new zone -- modeled here as a small
// async delay between reading the badge's current state and writing the
// new one, exactly where a TOCTOU gap would live if one exists.

const ZONES = ['landside', 'sterile', 'ramp', 'tarmac'];

function zoneIndex(zone) {
  return ZONES.indexOf(zone);
}

function adjacent(zoneA, zoneB) {
  return Math.abs(zoneIndex(zoneA) - zoneIndex(zoneB)) === 1;
}

function createPacs({ controllerDelayMs = 15 } = {}) {
  const badges = {
    badge_alice: { authorizedZones: ['landside', 'sterile', 'ramp', 'tarmac'], currentZone: 'landside' },
    badge_bob: { authorizedZones: ['landside', 'sterile'], currentZone: 'landside' },
  };

  const log = [];

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // doorFrom/doorTo are the two zones the door sits between; direction
  // 'in' moves the badge from the outer zone to the inner one, 'out' the
  // reverse. The door itself doesn't care which zone is "outer" beyond
  // what's passed in -- same as a real reader, which just reports a
  // read event and lets the controller apply the policy.
  async function requestTransit({ badgeId, doorFrom, doorTo }) {
    const badge = badges[badgeId];
    if (!badge) return { ok: false, reason: 'unknown badge' };
    if (!adjacent(doorFrom, doorTo)) return { ok: false, reason: 'not a real door' };

    // --- CHECK phase: read current state ---
    const startZone = badge.currentZone;
    const targetZone = doorTo;

    if (!badge.authorizedZones.includes(targetZone)) {
      log.push({ badgeId, doorFrom, doorTo, ok: false, reason: 'not authorized for target zone' });
      return { ok: false, reason: 'not authorized for target zone' };
    }
    if (startZone !== doorFrom) {
      log.push({ badgeId, doorFrom, doorTo, ok: false, reason: `anti-passback: badge is in ${startZone}, not ${doorFrom}` });
      return { ok: false, reason: `anti-passback: badge is in ${startZone}, not ${doorFrom}` };
    }

    // --- controller round-trip, simulated ---
    await sleep(controllerDelayMs);

    // --- COMMIT phase: write new state ---
    badge.currentZone = targetZone;
    log.push({ badgeId, doorFrom, doorTo, ok: true, newZone: targetZone });
    return { ok: true, newZone: targetZone };
  }

  return { badges, log, requestTransit, ZONES };
}

module.exports = { createPacs, ZONES };
