package org.jellyfin.androidtv.ui.base.button

import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp
import org.jellyfin.androidtv.ui.base.WatchNexusTheme

object IconButtonDefaults {
	val Shape: Shape = ButtonDefaults.Shape
	val ContentPadding: PaddingValues = PaddingValues(horizontal = 10.dp, vertical = 10.dp)

	@ReadOnlyComposable
	@Composable
	fun colors(
		containerColor: Color = WatchNexusTheme.colorScheme.button,
		contentColor: Color = WatchNexusTheme.colorScheme.onButton,
		focusedContainerColor: Color = WatchNexusTheme.colorScheme.buttonFocused,
		focusedContentColor: Color = WatchNexusTheme.colorScheme.onButtonFocused,
		disabledContainerColor: Color = WatchNexusTheme.colorScheme.buttonDisabled,
		disabledContentColor: Color = WatchNexusTheme.colorScheme.onButtonDisabled,
	) = ButtonDefaults.colors(
		containerColor = containerColor,
		contentColor = contentColor,
		focusedContainerColor = focusedContainerColor,
		focusedContentColor = focusedContentColor,
		disabledContainerColor = disabledContainerColor,
		disabledContentColor = disabledContentColor,
	)
}

@Composable
fun IconButton(
	onClick: () -> Unit,
	modifier: Modifier = Modifier,
	onLongClick: (() -> Unit)? = null,
	enabled: Boolean = true,
	shape: Shape = IconButtonDefaults.Shape,
	colors: ButtonColors = ButtonDefaults.colors(),
	contentPadding: PaddingValues = IconButtonDefaults.ContentPadding,
	interactionSource: MutableInteractionSource? = null,
	content: @Composable BoxScope.() -> Unit
) {
	ButtonBase(
		onClick = onClick,
		modifier = modifier,
		onLongClick = onLongClick,
		enabled = enabled,
		shape = shape,
		colors = colors,
		interactionSource = interactionSource,
	) {
		Box(
			modifier = Modifier
				.padding(contentPadding),
			content = content,
		)
	}
}
