package org.jellyfin.androidtv.ui.base.list

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import org.jellyfin.androidtv.ui.base.WatchNexusTheme

@Composable
fun ListSection(
	modifier: Modifier = Modifier,
	headingContent: @Composable () -> Unit,
	overlineContent: (@Composable () -> Unit)? = null,
	captionContent: (@Composable () -> Unit)? = null,
	leadingContent: (@Composable () -> Unit)? = null,
	trailingContent: (@Composable () -> Unit)? = null,
	footerContent: (@Composable () -> Unit)? = null,
) {
	ListItemContent(
		headingContent = headingContent,
		overlineContent = overlineContent,
		captionContent = captionContent,
		leadingContent = leadingContent,
		trailingContent = trailingContent,
		footerContent = footerContent,
		headingStyle = WatchNexusTheme.typography.listHeader
			.copy(color = WatchNexusTheme.colorScheme.listHeader),
		modifier = modifier,
	)
}
