// Exploration, not a pre-written vulnerability test. Each scenario just
// prints what actually happened -- the goal is to see where real
// behavior diverges from the intended policy, not to confirm something
// decided in advance.

const { createPacs } = require('./vulnerable/pacs');

function print(label, results) {
  console.log(`\n-- ${label} --`);
  for (const r of results) console.log(' ', JSON.stringify(r));
}

async function scenario1_normalSequence() {
  const pacs = createPacs();
  const r1 = await pacs.requestTransit({ badgeId: 'badge_alice', doorFrom: 'landside', doorTo: 'sterile' });
  const r2 = await pacs.requestTransit({ badgeId: 'badge_alice', doorFrom: 'sterile', doorTo: 'ramp' });
  print('scenario 1: normal sequential transit (expect both ok)', [r1, r2]);
}

async function scenario2_doubleEntryNoExit() {
  const pacs = createPacs();
  const r1 = await pacs.requestTransit({ badgeId: 'badge_alice', doorFrom: 'landside', doorTo: 'sterile' });
  // Same badge tries the SAME door again without having exited first --
  // this is the baseline anti-passback case this system is supposed to
  // catch sequentially.
  const r2 = await pacs.requestTransit({ badgeId: 'badge_alice', doorFrom: 'landside', doorTo: 'sterile' });
  print('scenario 2: re-entry at same door, no exit between (expect second to fail)', [r1, r2]);
}

async function scenario3_concurrentSameBadgeSameDoor() {
  // This is the interesting one: fire the SAME request twice at the
  // same instant, modeling a shared/cloned badge used at the same
  // reader (or two readers on the same door) by two people at once.
  const pacs = createPacs({ controllerDelayMs: 20 });
  const [r1, r2] = await Promise.all([
    pacs.requestTransit({ badgeId: 'badge_alice', doorFrom: 'landside', doorTo: 'sterile' }),
    pacs.requestTransit({ badgeId: 'badge_alice', doorFrom: 'landside', doorTo: 'sterile' }),
  ]);
  print('scenario 3: two concurrent identical transit requests (expect only ONE to succeed)', [r1, r2]);
  console.log('  final badge state:', JSON.stringify(pacs.badges.badge_alice));
}

async function scenario4_concurrentDifferentDoorsSameBadge() {
  // Same badge, two DIFFERENT doors fired at once -- e.g. someone
  // tailgates through a second checkpoint while the first is still
  // mid-round-trip.
  const pacs = createPacs({ controllerDelayMs: 20 });
  const [r1, r2] = await Promise.all([
    pacs.requestTransit({ badgeId: 'badge_alice', doorFrom: 'landside', doorTo: 'sterile' }),
    pacs.requestTransit({ badgeId: 'badge_alice', doorFrom: 'sterile', doorTo: 'ramp' }),
  ]);
  print('scenario 4: concurrent transit through two DIFFERENT doors, same badge (badge is in landside, not sterile, at start)', [r1, r2]);
  console.log('  final badge state:', JSON.stringify(pacs.badges.badge_alice));
}

async function scenario5_unauthorizedZone() {
  const pacs = createPacs();
  const r1 = await pacs.requestTransit({ badgeId: 'badge_bob', doorFrom: 'landside', doorTo: 'sterile' });
  const r2 = await pacs.requestTransit({ badgeId: 'badge_bob', doorFrom: 'sterile', doorTo: 'ramp' });
  print('scenario 5: bob is only authorized through sterile, tries ramp next (expect second to fail)', [r1, r2]);
}

async function scenario6_manyConcurrentCopies() {
  // Push it further than two: five simultaneous copies of the same
  // request. If the race in scenario 3 is real, how many of these get
  // through?
  const pacs = createPacs({ controllerDelayMs: 20 });
  const requests = Array.from({ length: 5 }, () =>
    pacs.requestTransit({ badgeId: 'badge_alice', doorFrom: 'landside', doorTo: 'sterile' })
  );
  const results = await Promise.all(requests);
  print('scenario 6: FIVE concurrent identical transit requests', results);
  const successes = results.filter((r) => r.ok).length;
  console.log(`  ${successes} of 5 succeeded. final badge state:`, JSON.stringify(pacs.badges.badge_alice));
}

async function run() {
  await scenario1_normalSequence();
  await scenario2_doubleEntryNoExit();
  await scenario3_concurrentSameBadgeSameDoor();
  await scenario4_concurrentDifferentDoorsSameBadge();
  await scenario5_unauthorizedZone();
  await scenario6_manyConcurrentCopies();
}

run();
