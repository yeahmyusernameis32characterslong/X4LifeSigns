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
