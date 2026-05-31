---
name: testing-patterns
description: Use when writing tests across all technology layers. Covers xUnit/Moq for C#, Jest/RTL for React, pytest for Python, and Playwright for E2E.
---

# Testing Patterns for WatchNexus

## C# xUnit + Moq

### Basic Service Test
```csharp
using Xunit;
using Moq;
using Microsoft.Extensions.Logging.Abstractions;

public class MovieServiceTests
{
    private readonly Mock<IMovieRepository> _repo;
    private readonly MovieService _service;

    public MovieServiceTests()
    {
        _repo = new Mock<IMovieRepository>();
        _service = new MovieService(
            _repo.Object,
            NullLogger<MovieService>.Instance
        );
    }

    [Fact]
    public async Task GetByIdAsync_WhenMovieExists_ReturnsDto()
    {
        var movie = new Movie { Id = 1, Title = "Inception", Year = 2010 };
        _repo.Setup(r => r.GetByIdAsync(1)).ReturnsAsync(movie);

        var result = await _service.GetByIdAsync(1);

        Assert.NotNull(result);
        Assert.Equal("Inception", result.Title);
        _repo.Verify(r => r.GetByIdAsync(1), Times.Once);
    }

    [Fact]
    public async Task GetByIdAsync_WhenMovieMissing_ReturnsNull()
    {
        _repo.Setup(r => r.GetByIdAsync(It.IsAny<int>())).ReturnsAsync((Movie?)null);

        var result = await _service.GetByIdAsync(999);

        Assert.Null(result);
    }
}
```

### Controller Test
```csharp
public class MoviesControllerTests
{
    [Fact]
    public async Task GetAll_ReturnsOkWithPagedResult()
    {
        var svc = new Mock<IMovieService>();
        svc.Setup(s => s.GetAllAsync(1, 20, null))
           .ReturnsAsync(new PagedResult<MovieDto> { Items = new(), Total = 0 });

        var ctrl = new MoviesController(svc.Object, NullLogger<MoviesController>.Instance);

        var result = await ctrl.GetAll(1, 20, null);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var data = Assert.IsType<PagedResult<MovieDto>>(ok.Value);
        Assert.Empty(data.Items);
    }
}
```

## Jest + React Testing Library

### Component Test
```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

describe('LoginForm', () => {
    it('submits email and password', async () => {
        const onSubmit = jest.fn();
        render(<LoginForm onSubmit={onSubmit} />);

        await userEvent.type(screen.getByLabelText(/email/i), 'user@test.com');
        await userEvent.type(screen.getByLabelText(/password/i), 'secret123');
        await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

        expect(onSubmit).toHaveBeenCalledWith({
            email: 'user@test.com',
            password: 'secret123',
        });
    });

    it('shows error on empty fields', async () => {
        render(<LoginForm onSubmit={jest.fn()} />);

        await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
});
```

### Context Test
```jsx
import { render, screen } from '@testing-library/react';
import { AuthContext, AuthProvider } from '../context/AuthContext';

const renderWithAuth = (ui, { user = null } = {}) => {
    return render(
        <AuthContext.Provider value={{ user, login: jest.fn(), logout: jest.fn() }}>
            {ui}
        </AuthContext.Provider>
    );
};
```

## Python pytest

### API Test
```python
import pytest
from httpx import AsyncClient, ASGITransport

@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")

@pytest.mark.anyio
async def test_proxy_health(client):
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

@pytest.mark.anyio
async def test_proxy_not_found(client):
    response = await client.get("/api/nonexistent")
    assert response.status_code == 404
```

## E2E Playwright

```javascript
const { test, expect } = require('@playwright/test');

test.describe('Media Browser', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('[data-testid="email"]', 'admin@watchnexus.local');
        await page.fill('[data-testid="password"]', 'admin');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL('/dashboard');
    });

    test('displays movie library', async ({ page }) => {
        await page.click('text=Movies');
        await expect(page.locator('[data-testid="movie-grid"]')).toBeVisible();
        await expect(page.locator('[data-testid="movie-card"]').first()).toBeVisible();
    });

    test('search filters results', async ({ page }) => {
        await page.click('text=Movies');
        await page.fill('[data-testid="search-input"]', 'Inception');
        const cards = page.locator('[data-testid="movie-card"]');
        await expect(cards).not.toHaveCount(0);
    });
});
```

## Test File Locations
- C#: `src/watchnexus/core/tests/` or `src/watchnexus/tests/` (follow existing patterns)
- React: Co-located next to component as `*.test.jsx` or in `__tests__/` directory
- Python: `backend/tests/`
- E2E: `frontend/e2e/` or root `e2e/`
