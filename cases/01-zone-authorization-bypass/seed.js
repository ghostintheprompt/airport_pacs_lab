// Shared fixture data for both servers in this case.
//
// Models a generic airport PACS (physical access control system): badges
// with a list of zones they're authorized for, and doors that each sit in
// exactly one zone. A real airport layers landside (public), sterile
// (post-screening), ramp, and tarmac zones this way, with badge-reader
// panels gating each door.

function freshState() {
  const badges = {
    badge_alice: { active: true, authorizedZones: ['landside'] },
    badge_bob: { active: true, authorizedZones: ['landside', 'sterile', 'ramp'] },
    badge_revoked: { active: false, authorizedZones: ['landside', 'sterile'] },
  };

  const doors = {
    door_landside_entrance: { zone: 'landside' },
    door_sterile_checkpoint: { zone: 'sterile' },
    door_ramp_gate_7: { zone: 'ramp' },
  };

  return { badges, doors, accessLog: [] };
}

module.exports = { freshState };
