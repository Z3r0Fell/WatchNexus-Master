package org.jellyfin.androidtv.ui.playback.stillwatching

import org.jellyfin.androidtv.util.apiclient.WatchNexusImage
import org.jellyfin.sdk.model.UUID
import org.jellyfin.sdk.model.api.BaseItemDto

data class StillWatchingItemData(
	val baseItem: BaseItemDto,
	val id: UUID,
	val title: String,
	val thumbnail: WatchNexusImage?,
	val logo: WatchNexusImage?,
)
