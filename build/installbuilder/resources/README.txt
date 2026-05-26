WatchNexus — modular media server
=================================

After installation:

  • Open http://<host>:8001 in your browser.
  • Enter your license key on the first-launch screen (or pass --license
    to the installer to pre-seed it).
  • Visit Settings → System to review the tier, version, and Fortress
    integrity status.

Service management
------------------

  Linux  : systemctl {start|stop|status} watchnexus
  Windows: services.msc  →  WatchNexusCore
  Docker : docker {start|stop} watchnexus

Support: https://watchnexus.ca/support
Docs   : https://docs.watchnexus.ca
