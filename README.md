# airport_pacs_lab

A reproducible lab for vulnerability classes in airport physical access
control systems (PACS) — the badge/door-controller layer gating landside,
sterile-area, ramp, and tarmac zones. Same pattern as
[`transit_fare_lab`](../transit_fare_lab) and [`cve_lab`](../cve_lab): one
case per directory, a vulnerable version and a fixed version of the same
server, a two-part test (functionality + vulnerability) run against both,
Docker-verified from the start.

## Why airports, and why now

Transit fare went digital and the worst case stayed mostly digital — fraud,
tracking, account data. PACS is the version of this problem where the
worst case is physical: a flaw here isn't a free ride, it's a person
reaching a ramp, a sterile area, or a tarmac they were never cleared for.
Same discipline as the transit work, higher stakes.

Both cases below model real, long-public vulnerability classes in badge
access systems — not anything novel. Anti-passback/zone-authorization
bypass and badge-signal replay (the Wiegand-protocol cleartext/no-rolling-
code problem) have been documented and talked about at DEF CON and
elsewhere for years. Nothing here is a new technique; it's a clean,
runnable demonstration of failure classes the industry already knows
about, built against fixture data this lab owns — no real reader, no real
badge, no real airport.

## Cases

- [`01-zone-authorization-bypass`](./cases/01-zone-authorization-bypass/) —
  a door controller that checks "is this badge active" but never "is this
  badge authorized for *this door's zone*." A landside-only badge opens a
  ramp-zone door. Fixed version adds the one check: the door's zone must be
  in the badge's authorized-zone list.
- [`02-replay-missing-nonce`](./cases/02-replay-missing-nonce/) — a
  reader-to-controller access token that's valid forever once issued, so
  the same captured token reopens the door on replay, with no badge
  present at all. Fixed version consumes the token on first use and
  enforces a freshness window — the two properties a real rolling-code
  scheme provides that a bare static credential doesn't.

## Running it

```bash
npm install
npm test
```

Or containerized:

```bash
docker compose build
docker compose run --rm lab
```

Both run identically — confirmed live, 9/9 passing either way.

## Standing rules for every case added here

Same as `cve_lab` / `transit_fare_lab`:

- Vulnerable and fixed server for a case differ by exactly the one
  check under test, so the diff itself is the finding.
- Exploit demonstrations are non-destructive probes proving a boundary
  holds or doesn't, never a weaponized payload, never against anything
  but this lab's own fixture data. No real reader hardware, RF signal
  capture/cloning, or live airport system is touched or modeled at the
  hardware level — this stays at the controller-logic layer, which is
  where the actual fix lives anyway.
- Every claim gets actually run before it's written down as fact.

## Not public yet

Deliberately not pushed to GitHub. This one's held back until there's an
actual contract or engagement conversation on the table with an airport
authority or PACS vendor — unlike the OMNY work, there's no public web
surface to responsibly disclose against here, so there's no "disclosure"
story that argues for publishing it for free in the meantime.

## Queued next, not started

- A badge-cloning-adjacent case modeling what changes once a credential
  format carries a signed/encrypted payload instead of a bare ID (the
  actual fix path real PACS vendors have been migrating toward).
- A multi-door/anti-passback sequencing case: using a badge to enter a
  zone without ever exiting it, then re-entering, the way a real
  anti-passback violation gets caught (or doesn't).
