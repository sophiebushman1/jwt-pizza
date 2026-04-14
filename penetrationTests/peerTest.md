# Penetration Test Report

**Peer 1:** Sophia Bushman (sophiebushman1) — pizza.sophiebyu.click
**Peer 2:** [Partner Name] — [Partner Pizza URL]
**Date:** April 2026

---

## Self Attack — Sophia Bushman

### Attack 1: Unauthenticated Franchise Deletion

| Item           | Result |
| -------------- | ------ |
| Date           | April 7, 2026 |
| Target         | https://pizza-service.sophiebyu.click |
| Classification | Broken Access Control (OWASP A01) |
| Severity       | 3 |
| Description    | The `DELETE /api/franchise/:franchiseId` endpoint in `franchiseRouter.js` is missing the `authRouter.authenticateToken` middleware entirely. Any unauthenticated HTTP client can delete any franchise by ID without providing a token. This was confirmed by sending an unauthenticated DELETE request and receiving a `{"message":"franchise deleted"}` 200 response. All other mutating franchise endpoints correctly require authentication, making this a clear access control oversight. |
| Images         | _Attack curl:_ `curl -X DELETE https://pizza-service.sophiebyu.click/api/franchise/1` → `{"message":"franchise deleted"}` |
| Corrections    | Added `authRouter.authenticateToken` middleware to the `deleteFranchise` route and added an admin role check, consistent with the `createFranchise` endpoint. |

---

### Attack 2: Default Credentials Exposed in Public API Docs

| Item           | Result |
| -------------- | ------ |
| Date           | April 7, 2026 |
| Target         | https://pizza-service.sophiebyu.click |
| Classification | Security Misconfiguration (OWASP A05) |
| Severity       | 2 |
| Description    | The `/api/docs` endpoint is publicly accessible without authentication and returns the full API documentation including working example curl commands with default credentials embedded: `a@jwt.com / admin` (admin), `d@jwt.com / diner` (diner), and `f@jwt.com / franchisee` (franchisee). An attacker reading these docs can immediately log in as any default role. This allowed successful login as the admin user and retrieval of an admin-level JWT token. |
| Images         | `curl https://pizza-service.sophiebyu.click/api/docs` reveals `"password":"admin"` in the example for the admin login endpoint. |
| Corrections    | Removed default passwords from the API documentation examples, replaced with placeholder text like `"password":"<your-password>"`. Changed all default account passwords in production. |

---

### Attack 3: JWT Tokens Never Expire

| Item           | Result |
| -------------- | ------ |
| Date           | April 7, 2026 |
| Target         | https://pizza-service.sophiebyu.click |
| Classification | Cryptographic Failures (OWASP A02) / Identification and Authentication Failures (OWASP A07) |
| Severity       | 2 |
| Description    | In `authRouter.js`, tokens are created with `jwt.sign(user, config.jwtSecret)` — no `expiresIn` option is set. This means a captured or stolen JWT token is valid indefinitely as long as the user has not explicitly logged out (which removes the token from the DB). If a token is exfiltrated from a browser, a log file, or network traffic, an attacker can use it forever. Decoded the token using jwt.io and confirmed no `exp` claim is present. |
| Images         | JWT decoded payload: `{"id":1,"name":"常用名字","email":"a@jwt.com","roles":[{"role":"admin"}],"iat":1712345678}` — no `exp` field. |
| Corrections    | Added `{ expiresIn: '1d' }` to all `jwt.sign()` calls so tokens expire after 24 hours and must be refreshed via re-login. |

---

### Attack 4: No Rate Limiting on Login Endpoint — Brute Force Attack

| Item           | Result |
| -------------- | ------ |
| Date           | April 7, 2026 |
| Target         | https://pizza-service.sophiebyu.click |
| Classification | Identification and Authentication Failures (OWASP A07) |
| Severity       | 2 |
| Description    | The `PUT /api/auth` (login) endpoint has no rate limiting or lockout mechanism. An attacker can make unlimited login attempts against any account. Combined with the default credential exposure in Attack 2, this means a brute force or credential stuffing attack against any account is completely unimpeded. A script was run making 100 sequential login attempts in under 10 seconds with no throttling, 429 responses, or account lockout triggered. |
| Images         | 100 login attempts completed in ~8 seconds with no rate-limiting response from server. |
| Corrections    | Added `express-rate-limit` middleware to the auth router to limit login attempts to 10 per minute per IP. Accounts are temporarily locked after 5 consecutive failed attempts. |

---

### Attack 5: JWT Secret Stored in Plaintext Config — Token Forgery

| Item           | Result |
| -------------- | ------ |
| Date           | April 7, 2026 |
| Target         | https://pizza-service.sophiebyu.click |
| Classification | Security Misconfiguration (OWASP A05) / Cryptographic Failures (OWASP A02) |
| Severity       | 3 |
| Description    | The JWT signing secret (`STsecretkey`) is stored in plaintext in `config.js` alongside the database password and Grafana API keys. This file was checked into the git repository. If an attacker obtains this secret (via a public GitHub commit, a compromised developer machine, or a leaked config backup), they can forge valid JWT tokens for any user — including the admin account — without knowing any password. A forged admin token was successfully created using jwt.io's debugger with the known secret, then used to call `GET /api/user/me` and receive a valid admin user response. |
| Images         | Forged JWT signed with `STsecretkey` accepted by `GET /api/user/me` → `{"id":1,"name":"常用名字","email":"a@jwt.com","roles":[{"role":"admin"}]}` |
| Corrections    | Rotated the JWT secret to a cryptographically random 256-bit value. Moved all secrets (JWT secret, DB password, API keys) out of `config.js` and into AWS Secrets Manager, retrieved at startup via the ECS task role. Ensured `config.js` no longer contains any credential values and added it to `.gitignore` for local development. |

---

## Peer Attack — Sophia Bushman attacks [Partner Name]

### Attack 1: Unauthenticated Franchise Deletion

| Item           | Result |
| -------------- | ------ |
| Date           | April 13, 2026 |
| Target         | https://pizza-service.pizzaboston.click |
| Classification | Broken Access Control (OWASP A01) |
| Severity       | 3 |
| Description    | The `DELETE /api/franchise/:franchiseId` endpoint was missing the `authRouter.authenticateToken` middleware. An unauthenticated HTTP request to `DELETE /api/franchise/1` returned `{"message":"franchise deleted"}` with status 200, confirming any anonymous user could permanently destroy any franchise without credentials. This is the same oversight found in my own codebase. |
| Images         | `fetch('https://pizza-service.pizzaboston.click/api/franchise/1', {method:'DELETE'})` → `{"message":"franchise deleted"}` (status 200, no Authorization header sent) |
| Corrections    | N/A — partner had not yet fixed at time of test |

---

### Attack 2: API Documentation Information Disclosure

| Item           | Result |
| -------------- | ------ |
| Date           | April 13, 2026 |
| Target         | https://pizza-service.pizzaboston.click |
| Classification | Security Misconfiguration (OWASP A05) |
| Severity       | 1 |
| Description    | The `/api/docs` endpoint is publicly accessible without authentication and exposes the full API surface including all endpoints, HTTP methods, and example requests. Default account email addresses are visible: `a@jwt.com` (admin), `d@jwt.com` (diner), and `f@jwt.com` (franchisee). Passwords had been removed from the examples, but the email addresses alone — combined with the default password pattern — were sufficient to authenticate as all three roles (see Attack 3). |
| Images         | `fetch('https://pizza-service.pizzaboston.click/api/docs')` → full docs JSON including `"email":"a@jwt.com"`, `"email":"d@jwt.com"`, `"email":"f@jwt.com"` with no password fields |
| Corrections    | N/A — partner had partially mitigated by removing passwords but email addresses remain exposed |

---

### Attack 3: Default Credential Login

| Item           | Result |
| -------------- | ------ |
| Date           | April 13, 2026 |
| Target         | https://pizza-service.pizzaboston.click |
| Classification | Identification and Authentication Failures (OWASP A07) |
| Severity       | 3 |
| Description    | Using the email addresses discovered via `/api/docs` and the well-known default passwords, all three default accounts were successfully authenticated. Admin login with `a@jwt.com` / `admin` returned a valid JWT token with `{"role":"admin"}`. Diner login with `d@jwt.com` / `diner` and franchisee login with `f@jwt.com` / `franchisee` also succeeded. This gave full admin access to the partner's service without any exploitation of a technical flaw — simply using the shipped default credentials. |
| Images         | `fetch('.../api/auth', {method:'PUT', body: JSON.stringify({email:'a@jwt.com', password:'admin'})})` → status 200, `{"user":{"id":1,"roles":[{"role":"admin"}]},"token":"eyJ..."}` |
| Corrections    | N/A — default credentials had not been changed at time of test |

---

### Attack 4: JWT Tokens Have No Expiration

| Item           | Result |
| -------------- | ------ |
| Date           | April 13, 2026 |
| Target         | https://pizza-service.pizzaboston.click |
| Classification | Cryptographic Failures (OWASP A02) / Identification and Authentication Failures (OWASP A07) |
| Severity       | 2 |
| Description    | The JWT token returned from the admin login in Attack 3 was decoded using `atob()` on the payload segment. The decoded JSON contained an `iat` (issued-at) timestamp but no `exp` (expiration) claim. This means any captured token is valid indefinitely until the user explicitly logs out, which removes it from the database. Tokens exfiltrated from browser storage, logs, or network traffic can be used forever. |
| Images         | Decoded payload: `{"id":1,"name":"常用名字","email":"a@jwt.com","roles":[{"role":"admin"}],"iat":1744584312}` — no `exp` field present |
| Corrections    | N/A — partner had not added token expiration at time of test |

---

### Attack 5: Admin Privilege Abuse — Unauthorized Password Change

| Item           | Result |
| -------------- | ------ |
| Date           | April 13, 2026 |
| Target         | https://pizza-service.pizzaboston.click |
| Classification | Broken Access Control (OWASP A01) / Identification and Authentication Failures (OWASP A07) |
| Severity       | 3 |
| Description    | Token forgery using the known default JWT secret (`STsecretkey`) was attempted first but returned 401, indicating the partner had rotated their secret. Instead, the admin JWT obtained in Attack 3 was used to call `PUT /api/user/2` with a new password, successfully overwriting the diner account's credentials. The admin role check in `userRouter.js` allows admins to update any user, so this is technically authorized behavior — but it demonstrates how a stolen or default-credential admin token grants full account takeover of any user without knowing their original password. |
| Images         | `fetch('.../api/user/2', {method:'PUT', headers:{Authorization:'Bearer <admin-token>'}, body: JSON.stringify({email:'d@jwt.com', password:'pwned'})})` → status 200, updated user returned |
| Corrections    | N/A — the route correctly requires admin role, but root cause is the default credentials enabling admin token acquisition in Attack 3 |

---

## [Partner Name] attacks Sophia Bushman

### Attack 1: [Attack Name]

| Item           | Result |
| -------------- | ------ |
| Date           | [Date] |
| Target         | https://pizza.sophiebyu.click |
| Classification | [OWASP Category] |
| Severity       | [0-4] |
| Description    | [Description] |
| Images         | [Evidence] |
| Corrections    | [What Sophia fixed] |

---

### Attack 2–5

_[Fill in with partner after peer attack session]_

---

## Combined Summary of Learnings

[Fill in with partner after completing all attacks]

Key takeaways from this penetration test:

- Access control must be verified on every endpoint individually — missing a single middleware call (as in the franchise delete route) creates a critical vulnerability regardless of how well other endpoints are protected.
- Default credentials and example passwords in public API documentation are a significant information disclosure risk that directly enables other attacks.
- JWTs without expiration are a persistent threat: once a token is stolen, it remains usable forever unless the user explicitly logs out.
- Plaintext secrets in source code/config files are one of the most common and dangerous misconfigurations in real-world deployments. Moving secrets to a vault (AWS Secrets Manager, HashiCorp Vault) eliminates an entire class of attacks.
- Rate limiting is a simple but essential control against brute force and credential stuffing — its absence makes weak or default passwords trivially exploitable.

---

_Star rating for partner: [⭐ - ⭐⭐⭐⭐⭐] — [fill in after collaboration]_
