package org.jellyfin.mobile.data

import androidx.room.Room
import org.koin.android.ext.koin.androidApplication
import org.koin.dsl.module

val databaseModule = module {
    single {
        Room.databaseBuilder(androidApplication(), WatchNexusDatabase::class.java, "jellyfin")
            .fallbackToDestructiveMigrationFrom(true, 1)
            .fallbackToDestructiveMigrationOnDowngrade(true)
            .build()
    }
    single { get<WatchNexusDatabase>().serverDao }
    single { get<WatchNexusDatabase>().userDao }
    single { get<WatchNexusDatabase>().downloadDao }
}
