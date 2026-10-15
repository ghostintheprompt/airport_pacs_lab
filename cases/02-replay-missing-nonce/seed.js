// Models the reader-to-controller leg of a badge read: a reader panel
// reads a badge and sends a short-lived access token to the door
// controller, which is what actually unlocks the strike. The real-world
// failure class this reproduces is decades old and extensively public
// (Wiegand-protocol cleartext/replay weaknesses, badge-cloning talks at
// DEF CON and elsewhere): a controller that accepts a token as valid
// forever, rather than treating it as a one-time, time-boxed event, lets
// anyone who ever captured one earlier legitimate open re-trigger the door
// at will, with no badge present at all.

const crypto = require('crypto');

function freshState() {
  // A single legitimate read event already happened at setup time, the
  // same way a captured signal would already exist by the time an
  // attacker has it. Nothing in this test suite performs the capture --
  // it starts from "a token exists," which is the realistic assumption
  // for this failure class.
  const issuedToken = crypto.randomBytes(8).toString('hex');
  const tokens = {
    [issuedToken]: { doorId: 'door_ramp_gate_7', issuedAt: Date.now() },
  };

  return { tokens, usedTokens: new Set(), doors: { door_ramp_gate_7: { open: false } } };
}

module.exports = { freshState };
