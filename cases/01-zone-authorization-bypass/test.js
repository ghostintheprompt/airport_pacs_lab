// Two-part verification against both servers. Non-destructive: every
// request is a normal access-request call against this lab's own fixture
// badges and doors, nothing resembling real badge-signal capture or
// cloning is attempted anywhere here.

const { createApp: createVulnerable } = require('./vulnerable/server');
const { createApp: createFixed } = require('./fixed/server');

async function withServer(createApp, fn) {
  const { app } = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  try {
    await fn(base);
  } finally {
    server.close();
  }
}

async function requestAccess(base, badgeId, doorId) {
  return fetch(`${base}/access/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ badgeId, doorId }),
  });
}

async function run() {
  let passed = 0;
  let failed = 0;

  function report(name, ok, detail) {
    if (ok) {
      passed++;
      console.log(`  PASS  ${name}`);
    } else {
      failed++;
      console.log(`  FAIL  ${name} — ${detail}`);
    }
  }

  console.log('== vulnerable controller ==');
  await withServer(createVulnerable, async (base) => {
    const own = await requestAccess(base, 'badge_alice', 'door_landside_entrance');
    report('functionality: alice (landside badge) opens the landside door',
      own.status === 200, `expected 200, got ${own.status}`);

    const crossZone = await requestAccess(base, 'badge_alice', 'door_ramp_gate_7');
    const body = await crossZone.json().catch(() => ({}));
    report(
      'vulnerability: alice\'s landside-only badge CAN open the ramp door (confirms the gap is real)',
      crossZone.status === 200 && body.granted === true,
      `expected 200/granted, got ${crossZone.status} ${JSON.stringify(body)}`
    );
  });

  console.log('== fixed controller ==');
  await withServer(createFixed, async (base) => {
    const own = await requestAccess(base, 'badge_alice', 'door_landside_entrance');
    report('functionality: alice still opens the landside door',
      own.status === 200, `expected 200, got ${own.status}`);

    const crossZone = await requestAccess(base, 'badge_alice', 'door_ramp_gate_7');
    report(
      'vulnerability: the ramp door now rejects alice\'s landside-only badge',
      crossZone.status === 403,
      `expected 403, got ${crossZone.status}`
    );

    const stillWorks = await requestAccess(base, 'badge_bob', 'door_ramp_gate_7');
    report('functionality: bob, who IS authorized for ramp, still gets in',
      stillWorks.status === 200, `expected 200, got ${stillWorks.status}`);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
