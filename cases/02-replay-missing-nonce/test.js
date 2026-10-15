// Two-part verification. The "attacker" step here is just re-sending the
// exact same already-issued token a second time -- a pure replay, nothing
// resembling real signal capture/cloning hardware is modeled or needed to
// prove this class of bug.

const crypto = require('crypto');
const { createApp: createVulnerable } = require('./vulnerable/server');
const { createApp: createFixed } = require('./fixed/server');

async function withServer(createApp, fn) {
  const { app, state } = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  try {
    await fn(base, state);
  } finally {
    server.close();
  }
}

async function openDoor(base, token) {
  return fetch(`${base}/access/open`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
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
  await withServer(createVulnerable, async (base, state) => {
    const token = Object.keys(state.tokens)[0];

    const first = await openDoor(base, token);
    report('functionality: the legitimate first use opens the door',
      first.status === 200, `expected 200, got ${first.status}`);

    const replay = await openDoor(base, token);
    const body = await replay.json().catch(() => ({}));
    report(
      'vulnerability: replaying the SAME token opens the door again (confirms the gap is real)',
      replay.status === 200 && body.opened === true,
      `expected 200/opened on replay, got ${replay.status} ${JSON.stringify(body)}`
    );
  });

  console.log('== fixed controller ==');
  await withServer(createFixed, async (base, state) => {
    const token = Object.keys(state.tokens)[0];

    const first = await openDoor(base, token);
    report('functionality: the legitimate first use still opens the door',
      first.status === 200, `expected 200, got ${first.status}`);

    const replay = await openDoor(base, token);
    report(
      'vulnerability: the replayed token is now rejected',
      replay.status === 409,
      `expected 409, got ${replay.status}`
    );
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
