# Dinner shopping transaction measurements

Issue #332, part of #326. Compared the actual #331 baseline at `d878df2` with the batched implementation at `8047f64` against the same local database on 18 September 2026.

The probe called the real Shopping List router with one Dinner containing 10 or 30 distinct ingredients named `Probeingredient0`, `Probeingredient1`, and so on. Each ingredient required 1 g. Each size used a fresh disposable Household and user. The second addition used the same Dinner and existing Own Items with a fresh operation ID. No items were Usually Have. All fixtures were deleted afterward; the database was not reset.

A Prisma query extension counted `$allOperations` during `caller.addDinners`, including raw lock calls, middleware, receipt lookup and creation, and canonical response reads. These are Prisma operations, not SQL statements. `performance.now()` measured the same awaited router call. Fixture creation and cleanup were outside the measured interval.

| Ingredients | Scenario | Original audit operations | #331 operations | Batched operations | #331 local ms | Batched local ms |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 10 | New Own Items | 109 | 114 | 16 | 441 | 332 |
| 10 | Existing Own Items | 99 | 104 | 24 | 108 | 39 |
| 30 | New Own Items | 309 | 314 | 16 | 302 | 43 |
| 30 | Existing Own Items | 279 | 284 | 44 | 226 | 52 |

These are single local samples, including first-call warm-up. They do not estimate production latency. The operation counts demonstrate the reduction independently of those timings. The original audit recorded 248/352 ms for new 10/30-ingredient additions and 106/225 ms for repeat additions in a different local run.

The five additional operations in #331 are its receipt lookup, receipt creation, and three canonical response reads. Both new and repeated additions previously took one outer Household lock plus one lock per ingredient. The batched path takes one lock, loads reusable inputs once, and dismisses completed Oda transfers once when it adds shopping requirements.

New Own Items and Shopping Items are inserted in batches. Shopping Item creation retains Prisma-generated CUIDs because their order breaks display ties. Existing quantities are updated once per changed requirement; these writes stay sequential on the transaction connection. The existing three-connection pool is unchanged.

For 10/30 new ingredients the 16 operations comprise two `findUnique`, one `findFirst`, one raw Household lock, seven `findMany`, one `findUniqueOrThrow`, one `createMany`, one `createManyAndReturn`, one `updateMany`, and one receipt `create`. Repeat additions replace the two batch inserts with 10/30 quantity updates, totaling 24/44 operations.
