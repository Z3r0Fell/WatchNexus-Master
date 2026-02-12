#!/bin/bash
# WatchNexus Marketing Video Generator
# This script creates a slideshow video from screenshots

# Configuration
DURATION=3  # seconds per image
FPS=30
OUTPUT="watchnexus_demo.mp4"
RESOLUTION="1920x1080"

echo "🎬 WatchNexus Video Generator"
echo "=============================="

# Check if screenshots directory exists
if [ ! -d "./images" ]; then
    echo "❌ Error: ./images directory not found"
    echo "Please create an 'images' folder with numbered screenshots:"
    echo "  01-login-page.png"
    echo "  02-dashboard-hero.png"
    echo "  etc..."
    exit 1
fi

# Check for ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ Error: ffmpeg is not installed"
    echo "Install with: sudo apt install ffmpeg (Linux)"
    echo "            : brew install ffmpeg (macOS)"
    exit 1
fi

echo "📸 Found screenshots:"
ls -1 ./images/*.png 2>/dev/null || echo "No PNG files found"

echo ""
echo "🎥 Generating video..."

# Create video from images with crossfade transitions
ffmpeg -y \
    -framerate 1/$DURATION \
    -pattern_type glob \
    -i './images/*.png' \
    -vf "scale=$RESOLUTION:force_original_aspect_ratio=decrease,pad=$RESOLUTION:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p" \
    -c:v libx264 \
    -preset slow \
    -crf 18 \
    -r $FPS \
    -pix_fmt yuv420p \
    $OUTPUT

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Video created successfully: $OUTPUT"
    echo "📊 File size: $(du -h $OUTPUT | cut -f1)"
    echo ""
    echo "🎵 To add music, use:"
    echo "   ffmpeg -i $OUTPUT -i background_music.mp3 -c:v copy -c:a aac -shortest output_with_music.mp4"
else
    echo "❌ Video generation failed"
fi
