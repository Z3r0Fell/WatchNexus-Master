# -*- coding: utf-8 -*-
from __future__ import division, absolute_import, print_function, unicode_literals


def test_import_main_module():
    import watchnexus_kodi  # noqa: F401


def test_import_client():
    import watchnexus_kodi.client  # noqa: F401


def test_import_connect():
    import watchnexus_kodi.connect  # noqa: F401


def test_import_database():
    import watchnexus_kodi.database
    import watchnexus_kodi.database.watchnexus_db
    import watchnexus_kodi.database.queries  # noqa: F401


def test_import_dialogs():
    import watchnexus_kodi.dialogs
    import watchnexus_kodi.dialogs.context
    import watchnexus_kodi.dialogs.loginmanual
    import watchnexus_kodi.dialogs.resume
    import watchnexus_kodi.dialogs.serverconnect
    import watchnexus_kodi.dialogs.servermanual
    import watchnexus_kodi.dialogs.usersconnect  # noqa: F401


def test_import_downloader():
    import watchnexus_kodi.downloader  # noqa: F401


def test_import_entrypoint():
    import watchnexus_kodi.entrypoint
    import watchnexus_kodi.entrypoint.context

    # import watchnexus_kodi.entrypoint.default  # FIXME: Messes with sys.argv
    import watchnexus_kodi.entrypoint.service  # noqa: F401


def test_import_full_sync():
    import watchnexus_kodi.full_sync  # noqa: F401


def test_import_helper():
    import watchnexus_kodi.helper
    import watchnexus_kodi.helper.api
    import watchnexus_kodi.helper.exceptions
    import watchnexus_kodi.helper.lazylogger
    import watchnexus_kodi.helper.loghandler
    import watchnexus_kodi.helper.playutils
    import watchnexus_kodi.helper.translate
    import watchnexus_kodi.helper.utils
    import watchnexus_kodi.helper.wrapper
    import watchnexus_kodi.helper.xmls  # noqa: F401


def test_import_watchnexus():
    import watchnexus_kodi.watchnexus
    import watchnexus_kodi.watchnexus.api
    import watchnexus_kodi.watchnexus.client
    import watchnexus_kodi.watchnexus.configuration
    import watchnexus_kodi.watchnexus.connection_manager
    import watchnexus_kodi.watchnexus.credentials
    import watchnexus_kodi.watchnexus.http
    import watchnexus_kodi.watchnexus.utils
    import watchnexus_kodi.watchnexus.ws_client  # noqa: F401


def test_import_library():
    import watchnexus_kodi.library  # noqa: F401


def test_import_monitor():
    import watchnexus_kodi.monitor  # noqa: F401


def test_import_objects():
    import watchnexus_kodi.objects
    import watchnexus_kodi.objects.actions
    import watchnexus_kodi.objects.kodi
    import watchnexus_kodi.objects.kodi.artwork
    import watchnexus_kodi.objects.kodi.kodi
    import watchnexus_kodi.objects.kodi.movies
    import watchnexus_kodi.objects.kodi.music
    import watchnexus_kodi.objects.kodi.musicvideos
    import watchnexus_kodi.objects.kodi.queries
    import watchnexus_kodi.objects.kodi.queries_music
    import watchnexus_kodi.objects.kodi.queries_texture
    import watchnexus_kodi.objects.kodi.tvshows
    import watchnexus_kodi.objects.movies
    import watchnexus_kodi.objects.music
    import watchnexus_kodi.objects.musicvideos
    import watchnexus_kodi.objects.obj
    import watchnexus_kodi.objects.tvshows
    import watchnexus_kodi.objects.utils  # noqa: F401


def test_import_player():
    import watchnexus_kodi.player  # noqa: F401


def test_import_views():
    import watchnexus_kodi.views  # noqa: F401
