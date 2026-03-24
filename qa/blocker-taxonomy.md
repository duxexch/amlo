# Mobile Release Blocker Taxonomy

This taxonomy is used by the mobile Go/No-Go gate.

## Severity Levels

- P0: Catastrophic blocker. Always NO-GO.
- P1: Critical user-impact blocker. Always NO-GO.
- P2: Major but non-blocking if mitigation exists and approved.
- P3: Minor issue. Tracked post-release.

## Mandatory NO-GO Rules

Release is automatically NO-GO when any item is true:

- At least one OPEN blocker with severity P0.
- At least one OPEN blocker with severity P1.
- Any privacy/security data-exposure issue marked OPEN (treated as P0/P1).

## Open Status Values

The gate treats these as open:

- open
- new
- in_progress
- reopened
- blocked

## Accepted Closed Status Values

The gate treats these as closed/non-blocking:

- resolved
- fixed
- verified
- closed
- waived

## Blocker Record Shape (for qa/results/current-run.json)

```json
{
  "id": "MOB-123",
  "severity": "P1",
  "status": "open",
  "area": "voice-call",
  "title": "Call drops on network handover"
}
```

## Ownership

- QA lead owns blocker triage and status accuracy.
- Engineering lead owns mitigation and closure evidence.
- Release manager owns final GO/NO-GO sign-off.
