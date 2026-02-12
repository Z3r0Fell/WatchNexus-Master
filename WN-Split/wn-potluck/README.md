# WatchNexus Potluck 🍲

Watch party service for synchronized viewing with friends.

Part of the [WatchNexus](https://github.com/WatchNexus/watchnexus) modular media pipeline.

## Installation

```bash
pip install wn-potluck
```

## Dependencies

- wn-core>=1.0.0
- websockets>=12.0

## API Endpoints

- `POST /api/potluck/create`
- `GET /api/potluck/{code}`
- `WS /ws/potluck/{code}`

## Usage

```python
from wn_potluck import *

# See documentation for full usage
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.
