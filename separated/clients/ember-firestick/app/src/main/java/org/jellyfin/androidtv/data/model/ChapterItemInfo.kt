package org.jellyfin.androidtv.data.model

import org.jellyfin.androidtv.util.apiclient.WatchNexusImage
import java.util.UUID

data class ChapterItemInfo(
	val itemId: UUID,
	val name: String?,
	val startPositionTicks: Long,
	val image: WatchNexusImage?,
)
