package org.jellyfin.mobile.app

import org.jellyfin.mobile.utils.Constants
import org.jellyfin.sdk.WatchNexus
import org.jellyfin.sdk.createWatchNexus
import org.jellyfin.sdk.model.ClientInfo
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module

val apiModule = module {
    // WatchNexus API builder and API client instance
    single {
        createWatchNexus {
            context = androidContext()
            clientInfo = ClientInfo(name = Constants.APP_INFO_NAME, version = Constants.APP_INFO_VERSION)
        }
    }
    single { get<WatchNexus>().createApi() }
}
