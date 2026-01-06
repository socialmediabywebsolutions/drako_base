# Release note: D1 binding diagnostics

Problem
- D1 access could fail with "binding-missing" without a clear indication when code was running outside a request context.

Fix
- Centralized D1 access in `getDracoDbFromRequestContext()` so each request reads bindings at runtime.
- Added `/api/debug/bindings` to report whether a request context exists and whether `DRACO_DB` is present.

Impact
- Clearer diagnosis when bindings are missing or when code is running outside Pages/Edge request context.
