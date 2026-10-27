# Trade transaction capture

## Owner-approved task (25 October 2026)

Starting point: `a6baef003639ad985476c62b3920e760686e0b6c`, deployed PR22.
Implement and deploy buyer/seller identities, ware, offer/ordered quantities,
actual transferred quantity, offer unit price and order total price. Separate
task branch `feat/trade-transaction-capture`; no merge or automated gameplay.

1. Support the generic documented completion offer/order payload and the shipped
   RML form in which the completed deal is in event.param.
2. Attach documented buyer/seller trade hooks to player ships/stations. Preserve
   current listener names/reset boundaries and keep galaxy callbacks observable
   for diagnosis rather than assuming a particular cause of missing rows.
3. Retain original deal/offer quantities and price terms at trade start. Completed
   order.amount is remaining quantity, often zero. Missing historical terms are
   unknown; never reconstruct them from an unverified assumption.
4. Write explicit buyer/seller identity fields and event provenance through the
   existing entity-event/SQLite path. No database migration or profit claims.
5. Exercise both callback forms, buying/selling, internal transfers, expired or
   absent inputs, zero values, escaping, repeated independent trades and reload
   isolation. Regenerate MD; validate installed X4 9.00 schemas and relevant suites.
6. Deploy only the optional recorder after closure, source/receipt/config checks
   and verified backups of protected files. Owner verifies native trade capture.

Source basis: installed 9.00 `common.xsd:16739-16805`, shared trade datatype in
`scriptproperties.xml:1505-1555`, and shipped `md/rml_trade_wares.xml:145-215`.
The latter documents zero remaining order amount and completion payload variation.
Both forms and per-object callback scheduling require owner native acceptance.

No cargo/account polling, vanilla script modifications, destructive scenarios,
full snapshots per trade, detailed failure-code capture or schema changes.

## Implemented behaviour and limits

Six hooks per enrolled player ship/station observe buyer/seller starts,
completions and cancellations. Existing ships/stations enrol on the first
history-processing tick; newly observed/acquired assets enrol even when their
profile is already known. There is no asset-count ceiling. Resetting the event
bus and run state clears enrolments and cached terms on load. Registration
before the first history tick and native callback delivery remain unverified.

The existing galaxy hooks remain as fallback for not-yet-enrolled subjects. For
enrolled subjects, direct object hooks provide the authoritative capture route.
One canonical player participant is selected (prefer a ship, then buyer before
seller) to avoid counting an internal transaction once for each participant.
Named buyer/seller seed, ID code, reference, display name, faction and sector
fields remain independent of that subject ordering. Existing fields retain
their names; ware/ware_name and per-value state/provenance fields are additive.

Original order amount/price and offer amount/unit price are captured at start.
At completion, order_remaining_amount is separate from ordered quantity, and
transferred_amount comes from the actual deal callback. Missing start terms are
explicitly UNKNOWN, including deals already underway when a save loads. They
are not reconstructed from zero remaining quantity or a stale offer. Offer-only
cancel callbacks cannot establish a deal's actual transferred amount. Price
terms do not establish credited money or profit; cancellation does not explain
its own cause. Native refs are run-local correlation aids, not durable IDs.

Terminal records clear cached terms; a bounded sweep removes vanished deals.
No time limit cancels a real in-progress trade. Transaction events are neither
combat-coalesced nor charged against the combat observation rate budget.
DEBUG TRADE_HEALTH aggregates callback/write/unresolved/shadowed counts at most
once per minute when callback counts change. Quiet periods do not add recurring
diagnostic rows. Counts include global callback probes and are not trade totals.

Automated tests cover both payload forms, expired offers, original versus
remaining amount, zero terms, buying/selling, internal duplicate suppression,
independent simultaneous trades, cancellation after partial transfer, new-asset
enrolment, cache cleanup/load reset and real SQLite retention. The harness does
not model separate native cue instances. Owner testing must establish native
coverage and performance, including player traders, station transactions and
ordinary internal transfers. Prior absence of rows remains undiagnosed; this
change uses a documented additional route rather than claiming a proven cause.
