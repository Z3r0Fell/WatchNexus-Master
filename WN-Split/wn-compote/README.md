# WatchNexus Compote 🍇

Indexer manager with Syrup scrapers for torrent sites and Pulp for Usenet.

Part of the [WatchNexus](https://github.com/WatchNexus/watchnexus) modular media pipeline.

## Installation

```bash
pip install wn-compote
```

## Dependencies

- wn-core>=1.0.0
- beautifulsoup4>=4.12.0
- aiohttp>=3.9.0

## API Endpoints

- `GET /api/compote/indexers`
- `GET /api/syrup/search`
- `POST /api/compote/test`

## Usage

```python
from wn_compote import *

# See documentation for full usage
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.
