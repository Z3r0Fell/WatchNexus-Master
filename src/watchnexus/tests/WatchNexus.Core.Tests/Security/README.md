# Security Test Suite

## Overview
Comprehensive security tests for WatchNexus covering:
- **Backend** (C# .NET 10): Path traversal, SSRF, SQL injection, auth bypass, CSRF, rate limiting, secrets, encryption
- **Frontend** (React 19): Auth storage, tier enforcement, CSP, input sanitization, CSRF
- **Configuration**: Docker, docker-compose, CI/CD, runtime headers
- **Penetration Test Helpers**: Payload libraries for manual/automated testing

## Running Tests

### Backend Security Tests
```bash
cd /home/auz/Downloads/git/WatchNexus-Master
dotnet test src/watchnexus/tests/WatchNexus.Core.Tests/WatchNexus.Core.Tests.csproj --filter "FullyQualifiedName~Security" --no-restore
```

### Frontend Security Tests
```bash
cd /home/auz/Downloads/git/WatchNexus-Master/src/web
yarn test --testPathPattern="security" --watchAll=false --ci
```

### All Security Tests
```bash
# Backend
dotnet test src/watchnexus/tests/WatchNexus.Core.Tests/WatchNexus.Core.Tests.csproj --filter "FullyQualifiedName~Security" --no-restore -v n

# Frontend
cd src/web && yarn test --testPathPattern="security" --watchAll=false --ci
```

## Test Categories

### Critical Vulnerabilities (Must Pass)
| Test File | Vulnerabilities Verified |
|-----------|-------------------------|
| `PathTraversalTests.cs` | C1, C2, M2 |
| `SsrfTests.cs` | C3, H1, H2 |
| `AuthBypassTests.cs` | FortressFilter tier enforcement |
| `SqlInjectionTests.cs` | SQL injection prevention |

### High Priority
| Test File | Vulnerabilities Verified |
|-----------|-------------------------|
| `CsrfAndRateLimitTests.cs` | CSRF, rate limiting |
| `SecretsAndEncryptionTests.cs` | Secrets, encryption at rest |

### Frontend
| Test File | Verifies |
|-----------|----------|
| `frontend-security.test.js` | Auth storage, tier gates, CSP, sanitization |
| `config-security.test.js` | Docker, compose, CI/CD, headers |

### Penetration Test Payloads
| File | Purpose |
|------|---------|
| `PenetrationTestPayloads.cs` | Parameterized tests with attack payloads |

## Expected Results

### If Vulnerability EXISTS (UNFIXED)
- Test will **FAIL** with clear assertion message
- Example: `SubtitlesController_ServeSubtitle_Blocks_PathTraversal_EtcPasswd` fails if path traversal works

### If Vulnerability FIXED
- Test will **PASS**
- Documents the fix is working

### Unfixed Vulnerabilities (Documented)
```csharp
// UNFIXED: C1 - Path traversal in SubtitlesController
// UNFIXED: H3 - TMDB proxy host rewrite fragile
```

## Adding New Security Tests

1. Create test in appropriate category file
2. Add `// VERIFIES: <VULN-ID> - <Description>` comment
3. Test should FAIL if vulnerability exists, PASS if fixed
4. Run tests to verify

## CI Integration

Add to `.github/workflows/ci.yml`:
```yaml
- name: Run Security Tests
  run: |
    dotnet test src/watchnexus/tests/WatchNexus.Core.Tests/WatchNexus.Core.Tests.csproj --filter "FullyQualifiedName~Security" --no-restore
    cd src/web && yarn test --testPathPattern="security" --watchAll=false --ci
```

## Test Infrastructure

- **Backend**: xUnit + Moq + EF Core InMemory
- **Frontend**: Jest + React Testing Library + MSW (mock service worker)
- **Test Database**: In-memory SQLite (EF Core InMemory provider)
- **Mock HTTP**: Moq.Protected for HttpClientFactory

## Known Limitations

1. **Rate Limiting**: Unit tests verify policy registration; integration tests needed for actual limiting
2. **CSP**: Header presence verified; browser enforcement requires E2E tests
3. **Docker**: Config tests are static analysis; runtime verification needs container tests
4. **Penetration Payloads**: Parameterized tests cover common vectors; not exhaustive