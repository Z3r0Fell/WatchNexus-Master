WatchNexus v1.0.0 - Linux Release
==================================

PREREQUISITES:
- Python 3.10+ (python3, python3-pip, python3-venv)
- MongoDB 6+ (or Docker: docker run -d -p 27017:27017 mongo:7)

QUICK START (User Mode):
1. ./start-watchnexus.sh
2. Open http://localhost:8001

SYSTEM INSTALLATION:
1. sudo ./install-system.sh
2. sudo systemctl start watchnexus
3. Open http://localhost:8001

ARCH LINUX:
sudo pacman -S python python-pip python-virtualenv
yay -S mongodb-bin  # or use Docker

UBUNTU/DEBIAN:
sudo apt install python3 python3-pip python3-venv

FEDORA:
sudo dnf install python3 python3-pip python3-virtualenv

For detailed instructions: docs/BUILD_GUIDE.md
