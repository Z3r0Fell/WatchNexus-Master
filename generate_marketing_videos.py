"""
WatchNexus Video Asset Generator
Generates marketing videos using Sora 2 and walkthrough frames with cursor
"""

import os
import asyncio
import time
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()

# Create output directories
VIDEO_DIR = Path("/app/videos")
VIDEO_DIR.mkdir(exist_ok=True)

# Video prompts for different marketing purposes
VIDEO_PROMPTS = {
    "kickstarter_intro": {
        "prompt": "Cinematic shot of a modern home theater room with warm ambient lighting, a large screen displaying a media library interface with movie posters, the camera slowly pushes in revealing the elegant dark UI with orange accent colors, professional product showcase style",
        "duration": 8,
        "size": "1792x1024",
        "filename": "kickstarter_intro.mp4"
    },
    "feature_streaming": {
        "prompt": "Close-up of a sleek modern interface showing movie thumbnails smoothly scrolling, orange and dark theme, Netflix-like media browsing experience, smooth 60fps animation, professional UI demonstration",
        "duration": 4,
        "size": "1280x720",
        "filename": "feature_streaming.mp4"
    },
    "feature_download": {
        "prompt": "Modern dark UI showing download progress bars filling up with orange glow, multiple files downloading simultaneously, torrent-style interface with clean design, satisfying progress animation",
        "duration": 4,
        "size": "1280x720",
        "filename": "feature_download.mp4"
    },
    "social_teaser_1": {
        "prompt": "Quick dynamic montage of a media server interface, movie posters flying by, sleek dark UI with orange accents, modern streaming platform aesthetic, energetic and exciting",
        "duration": 4,
        "size": "1024x1024",
        "filename": "social_teaser_square.mp4"
    },
    "social_teaser_vertical": {
        "prompt": "Vertical smartphone view of a media streaming app, dark elegant UI with movie posters, smooth scrolling animation, mobile-first design showcase, professional app demonstration",
        "duration": 4,
        "size": "1024x1792",
        "filename": "social_teaser_vertical.mp4"
    },
    "watch_party": {
        "prompt": "Split screen showing multiple people watching the same movie in sync, video chat bubbles appearing, friends laughing together while watching, cozy living room atmosphere with screens glowing",
        "duration": 8,
        "size": "1280x720",
        "filename": "feature_watch_party.mp4"
    }
}


def generate_video(prompt_key: str) -> str:
    """Generate a single video using Sora 2"""
    from emergentintegrations.llm.openai.video_generation import OpenAIVideoGeneration
    
    config = VIDEO_PROMPTS[prompt_key]
    output_path = str(VIDEO_DIR / config["filename"])
    
    print(f"\n🎬 Generating: {prompt_key}")
    print(f"   Prompt: {config['prompt'][:80]}...")
    print(f"   Size: {config['size']}, Duration: {config['duration']}s")
    
    try:
        video_gen = OpenAIVideoGeneration(api_key=os.environ['EMERGENT_LLM_KEY'])
        
        video_bytes = video_gen.text_to_video(
            prompt=config["prompt"],
            model="sora-2",
            size=config["size"],
            duration=config["duration"],
            max_wait_time=600
        )
        
        if video_bytes:
            video_gen.save_video(video_bytes, output_path)
            print(f"   ✅ Saved to: {output_path}")
            return output_path
        else:
            print(f"   ❌ Generation returned no data")
            return None
            
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return None


def generate_all_videos():
    """Generate all marketing videos"""
    print("=" * 60)
    print("  WatchNexus Video Generator - Sora 2")
    print("=" * 60)
    
    results = {}
    
    for key in VIDEO_PROMPTS.keys():
        result = generate_video(key)
        results[key] = result
        
        # Small delay between generations
        if result:
            time.sleep(2)
    
    print("\n" + "=" * 60)
    print("  Generation Complete!")
    print("=" * 60)
    
    success = sum(1 for v in results.values() if v)
    print(f"\n  ✅ Generated: {success}/{len(results)} videos")
    
    print("\n  Files:")
    for key, path in results.items():
        status = "✅" if path else "❌"
        print(f"    {status} {key}: {path or 'FAILED'}")
    
    return results


def generate_single(key: str):
    """Generate a single video by key"""
    if key not in VIDEO_PROMPTS:
        print(f"Unknown video key: {key}")
        print(f"Available keys: {', '.join(VIDEO_PROMPTS.keys())}")
        return None
    return generate_video(key)


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        # Generate specific video
        key = sys.argv[1]
        generate_single(key)
    else:
        # Generate all videos
        generate_all_videos()
