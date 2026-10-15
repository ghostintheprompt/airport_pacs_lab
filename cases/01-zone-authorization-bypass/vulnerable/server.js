// VULNERABLE: the door controller checks that a badge exists and is
// active, but never checks whether that badge is actually authorized for
// the specific door's zone. Any active badge opens any door.
//
// This models a real, well-documented PACS failure class: panel/controller
// configurations where "is this a known, enabled credential" is treated as
// equivalent to "is this credential cleared for this door," instead of
// checking the credential's zone-level access list per door. The result in
// a real airport: a landside-only badge (a vendor, a contractor, a landside
// staffer) opening a ramp or sterile-area door it was never cleared for.

const express = require('express');
const { freshState } = require('../seed');

function createApp() {
  const state = freshState();
  const app = express();
  app.use(express.json());

  app.post('/access/request', (req, res) => {
    const { badgeId, doorId } = req.body || {};
    const badge = state.badges[badgeId];
    const door = state.doors[doorId];

    if (!badge || !door) return res.status(404).json({ error: 'unknown badge or door' });
    if (!badge.active) return res.status(403).json({ granted: false, reason: 'badge inactive' });

    // BUG: no check that door.zone is in badge.authorizedZones.
    state.accessLog.push({ badgeId, doorId, granted: true });
    res.json({ granted: true, door: doorId, zone: door.zone });
  });

  app.get('/access/log', (req, res) => res.json(state.accessLog));

  return { app, state };
}

module.exports = { createApp };
