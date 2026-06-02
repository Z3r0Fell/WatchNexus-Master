---
name: dotnet-audit
description: Use when auditing C#/.NET codebases. Covers EF Core query analysis, async patterns, DI container health, middleware pipeline, and .NET 10-specific features.
---

# .NET Audit Patterns

## EF Core Anti-Patterns
```csharp
// BAD - N+1 query in loop
foreach (var item in items) {
    var related = context.Related.Where(r => r.ItemId == item.Id).ToList();
}

// BAD - Missing Include
var items = context.Items.ToList();
foreach (var i in items) { Console.WriteLine(i.Related.Name); }

// BAD - No pagination
var all = context.Items.ToList(); // 100K+ rows

// GOOD
var items = context.Items
    .Include(i => i.Related)
    .AsNoTracking()
    .Where(i => i.IsActive)
    .Skip(page * size)
    .Take(size)
    .ToList();
```

## Async Pattern Checks
- Never `.Result`, `.Wait()`, `.GetAwaiter().GetResult()` in application code
- `ConfigureAwait(false)` in library code (not needed in ASP.NET Core since .NET Core 2.1+)
- `ValueTask` vs `Task` for hot paths
- Missing `Async` suffix on async methods

## DI Container Health
- Scoped services in Singletons = captive dependency
- Transient disposables not disposed = memory leak
- Circular dependencies at runtime
- Multiple `AddDbContext` registrations

## Middleware Pipeline Order
```
ExceptionHandler → HSTS → HTTPS → StaticFiles → Routing → CORS → Auth → Authorization → Endpoints
```

## Controller Analysis
- All actions: `Task<IActionResult>` or `Task<ActionResult<T>>`
- `[FromRoute]`, `[FromQuery]`, `[FromBody]` explicit binding
- Validation with FluentValidation or Data Annotations
- Consistent error response shape
- No business logic in controllers — delegate to services
