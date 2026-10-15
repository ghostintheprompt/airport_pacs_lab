// VULNERABLE: the door controller accepts any token it recognizes as
// having been issued, with no check for whether it's already been
// consumed and no expiry window. The same token opens the door every
// time it's replayed.

const express = require('express');
const { freshState } = require('../seed');

function createApp() {
  const state = freshState();
  const app = express();
  app.use(express.json());

  app.post('/access/open', (req, res) => {
    const { token } = req.body || {};
    const record = state.tokens[token];
    if (!record) return res.status(404).json({ error: 'unknown token' });

    // BUG: no check that this token was already used, no expiry window.
    state.doors[record.doorId].open = true;
    res.json({ opened: true, door: record.doorId });
  });

  app.get('/access/door-state/:doorId', (req, res) => {
    res.json(state.doors[req.params.doorId] || { open: false });
  });

  return { app, state };
}

module.exports = { createApp };
