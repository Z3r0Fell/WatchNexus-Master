# WatchNexus Fondue 🫕

Built-in torrent download engine with magnet link support.

Part of the [WatchNexus](https://github.com/WatchNexus/watchnexus) modular media pipeline.

## Installation

```bash
pip install wn-fondue
```

## Dependencies

- wn-core>=1.0.0
- libtorrent>=2.0.0

## API Endpoints

- `GET /api/fondue/status`
- `POST /api/fondue/add`
- `GET /api/fondue/torrents`
- `DELETE /api/fondue/{id}`

## Usage

```python
from wn_fondue import *

# See documentation for full usage
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.
