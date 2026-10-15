// Formal two-part verification, written AFTER the race was actually
// found by running ./explore.js, not before. Non-destructive: every
// request here is a normal call against this lab's own in-memory
// fixture state, no real reader/badge hardware involved.

const { createPacs: createVulnerable } = require('./vulnerable/pacs');
const { createPacs: createFixed } = require('./fixed/pacs');

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

  console.log('== vulnerable PACS ==');
  {
    const pacs = createVulnerable({ controllerDelayMs: 20 });

    // Functionality: normal sequential multi-door transit works.
    const r1 = await pacs.requestTransit({ badgeId: 'badge_alice', doorFrom: 'landside', doorTo: 'sterile' });
    const r2 = await pacs.requestTransit({ badgeId: 'badge_alice', doorFrom: 'sterile', doorTo: 'ramp' });
    report('functionality: sequential multi-door transit succeeds',
      r1.ok && r2.ok, `got ${JSON.stringify(r1)} then ${JSON.stringify(r2)}`);

    // Vulnerability: 5 concurrent identical requests on a fresh badge --
    // confirmed live in ./explore.js to all succeed.
    const pacs2 = createVulnerable({ controllerDelayMs: 20 });
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        pacs2.requestTransit({ badgeId: 'badge_alice', doorFrom: 'landside', doorTo: 'sterile' })
      )
    );
    const successes = results.filter((r) => r.ok).length;
    report(
      'vulnerability: concurrent badge-sharing race lets more than one through (confirms the gap is real)',
      successes > 1,
      `expected >1 of 5 to succeed, got ${successes} of 5`
    );
  }

  console.log('== fixed PACS ==');
  {
    const pacs = createFixed({ controllerDelayMs: 20 });

    const r1 = await pacs.requestTransit({ badgeId: 'badge_alice', doorFrom: 'landside', doorTo: 'sterile' });
    const r2 = await pacs.requestTransit({ badgeId: 'badge_alice', doorFrom: 'sterile', doorTo: 'ramp' });
    report('functionality: sequential multi-door transit still succeeds',
      r1.ok && r2.ok, `got ${JSON.stringify(r1)} then ${JSON.stringify(r2)}`);

    const pacs2 = createFixed({ controllerDelayMs: 20 });
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        pacs2.requestTransit({ badgeId: 'badge_alice', doorFrom: 'landside', doorTo: 'sterile' })
      )
    );
    const successes = results.filter((r) => r.ok).length;
    report(
      'vulnerability: concurrent badge-sharing race now lets through exactly ONE',
      successes === 1,
      `expected exactly 1 of 5 to succeed, got ${successes} of 5`
    );
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
