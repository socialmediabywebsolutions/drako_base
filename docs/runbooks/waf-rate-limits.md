# WAF + Edge Rate Limit Rules (Cloudflare Plan)

Define these rules in the Cloudflare Dashboard to protect the AI Router.

## 1. Internal API Protection (Strict)
**Target**: `/internal/ai/run`
**Why**: This endpoint consumes budget. Must be strictly gated.
**WAF Rule**:
- **Expression**: `(http.request.uri.path eq "/internal/ai/run") and (not http.request.headers["Authorization"] contains "Bearer")`
- **Action**: Block
- **Note**: The application already verifies tokens + Origin Secret, but WAF adds defense-in-depth.

**Rate Limit**:
- **Rule Name**: `AI Router Protection`
- **When**: `http.request.uri.path eq "/internal/ai/run"`
- **Rate**: 60 requests / 1 minute
- **Key**: IP Address (and `X-Drako-Tenant-Id` header if available in Enterprise plan)
- **Action**: Block (429)

## 2. Public API Protection (Base)
**Target**: `/api/*`
**Why**: General Protection against DOS.
**Rate Limit**:
- **Rule Name**: `API General Limit`
- **When**: `http.request.uri.path matches "^/api/.*"`
- **Rate**: 1000 requests / 1 minute
- **Key**: IP Address
- **Action**: Managed Challenge (or Block if abusive)

## 3. Auth Brute Force Protection
**Target**: `/auth/*`
**Why**: Prevent credential stuffing.
**Rate Limit**:
- **Rule Name**: `Login Protection`
- **When**: `http.request.uri.path matches "^/auth/.*"`
- **Rate**: 10 requests / 1 minute
- **Key**: IP Address
- **Action**: Block for 15 minutes

## 4. Bot Management (Steel Recommendation)
- Enable **Super Bot Fight Mode** (if Pro) -> "Definitely Automated" -> Block.
