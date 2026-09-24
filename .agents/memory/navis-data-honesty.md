---
name: NAVIS data honesty
description: Distinguish real workspace records from inherited demonstration fixtures.
---

The dashboard and primary Atlas experience must not use the imported demonstration fixtures to fill empty financial states. Keep explicit simulation demonstrations separate from actual workspace activity.

**Why:** The redesign explicitly requires actual NAVIS data only; the imported application included fictional portfolio balances and recorded demo decisions. Merely labelling those numbers is not sufficient for the primary workspace.

**How to apply:** Render honest empty, unavailable, or blocked states when actual records are absent. Never equate passing policy checks with user approval, simulated execution with confirmation, or hash integrity with onchain settlement. Preserve intentionally disabled broadcasting.