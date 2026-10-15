// FIXED: the controller now consumes the token on first use and rejects
// any later replay of the same token, plus enforces a short freshness
// window from issuance -- the two properties a real rolling-code/nonce
// scheme provides and a bare static cleartext credential doesn't.

const express = require('express');
const { freshState } = require('../seed');

const FRESHNESS_WINDOW_MS = 5000;

function createApp() {
  const state = freshState();
  const app = express();
  app.use(express.json());

  app.post('/access/open', (req, res) => {
    const { token } = req.body || {};
    const record = state.tokens[token];
    if (!record) return res.status(404).json({ error: 'unknown token' });

    if (state.usedTokens.has(token)) {
      return res.status(409).json({ opened: false, reason: 'token already used (replay rejected)' });
    }
    if (Date.now() - record.issuedAt > FRESHNESS_WINDOW_MS) {
      return res.status(403).json({ opened: false, reason: 'token expired' });
    }

    state.usedTokens.add(token);
    state.doors[record.doorId].open = true;
    res.json({ opened: true, door: record.doorId });
  });

  app.get('/access/door-state/:doorId', (req, res) => {
    res.json(state.doors[req.params.doorId] || { open: false });
  });

  return { app, state };
}

module.exports = { createApp };
