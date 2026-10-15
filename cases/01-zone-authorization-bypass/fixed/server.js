// FIXED: identical to ../vulnerable/server.js except for the one check
// that matters: the controller verifies the door's zone is actually in the
// requesting badge's authorized-zone list before granting access.

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
    if (!badge.authorizedZones.includes(door.zone)) {
      state.accessLog.push({ badgeId, doorId, granted: false, reason: 'zone not authorized' });
      return res.status(403).json({ granted: false, reason: 'zone not authorized' });
    }

    state.accessLog.push({ badgeId, doorId, granted: true });
    res.json({ granted: true, door: doorId, zone: door.zone });
  });

  app.get('/access/log', (req, res) => res.json(state.accessLog));

  return { app, state };
}

module.exports = { createApp };
