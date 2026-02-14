WatchNexus v1.0.0 - Linux Release
==================================

PREREQUISITES:
- Python 3.10+ (python3, python3-pip, python3-venv)
- MongoDB 6+ (or Docker: docker run -d -p 27017:27017 mongo:7)

QUICK START:
./start-watchnexus.sh

SYSTEM INSTALLATION:
sudo ./install-system.sh
sudo systemctl start watchnexus

ARCH LINUX:
sudo pacman -S python python-pip python-virtualenv
yay -S mongodb-bin  # or use Docker

UBUNTU/DEBIAN:
sudo apt install python3 python3-pip python3-venv
