"""
Fprint - WatchNexus Audio Fingerprinting Module
Detects intro/credits segments using Chromaprint audio fingerprinting.

This module analyzes audio from TV episodes to automatically detect:
- Opening intros (theme songs that repeat across episodes)
- Credits sequences (end music that repeats)
- Recaps ("Previously on..." segments)

Works by comparing audio fingerprints across episodes of the same series.
When the same audio segment appears in multiple episodes, it's likely an intro.
"""

import os
import subprocess
import hashlib
import asyncio
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
import json

logger = logging.getLogger(__name__)

# Chromaprint configuration
FPCALC_PATH = "fpcalc"  # Assumes fpcalc is in PATH
FINGERPRINT_DURATION = 180  # Analyze first 3 minutes for intros
CREDITS_DURATION = 180  # Analyze last 3 minutes for credits
SEGMENT_LENGTH = 30  # Length of each fingerprint segment (seconds)
SIMILARITY_THRESHOLD = 0.7  # 70% similarity to consider a match


@dataclass
class AudioSegment:
    """Represents an audio segment with its fingerprint."""
    start_time: float  # seconds
    end_time: float  # seconds
    fingerprint: str
    fingerprint_hash: str
    duration: float


@dataclass 
class DetectedSegment:
    """A detected skip segment (intro, credits, etc.)"""
    segment_type: str  # 'intro', 'credits', 'recap'
    start_time: float
    end_time: float
    confidence: float
    detected_in_episodes: int


class FprintAnalyzer:
    """
    Audio fingerprint analyzer for detecting intro/credits segments.
    
    Uses Chromaprint to generate audio fingerprints and compares them
    across episodes to find repeated segments (likely intros/credits).
    """
    
    def __init__(self, cache_dir: str = None):
        self.cache_dir = Path(cache_dir) if cache_dir else Path("/app/backend/data/fprint_cache")
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._fingerprint_cache: Dict[str, List[AudioSegment]] = {}
    
    def _get_cache_path(self, media_id: str) -> Path:
        """Get cache file path for a media item."""
        return self.cache_dir / f"{media_id}.json"
    
    def _load_cache(self, media_id: str) -> Optional[List[AudioSegment]]:
        """Load cached fingerprints for a media item."""
        cache_path = self._get_cache_path(media_id)
        if cache_path.exists():
            try:
                with open(cache_path, 'r') as f:
                    data = json.load(f)
                    return [AudioSegment(**seg) for seg in data.get('segments', [])]
            except Exception as e:
                logger.warning(f"Failed to load fingerprint cache for {media_id}: {e}")
        return None
    
    def _save_cache(self, media_id: str, segments: List[AudioSegment]):
        """Save fingerprints to cache."""
        cache_path = self._get_cache_path(media_id)
        try:
            data = {
                'media_id': media_id,
                'analyzed_at': datetime.now(timezone.utc).isoformat(),
                'segments': [
                    {
                        'start_time': seg.start_time,
                        'end_time': seg.end_time,
                        'fingerprint': seg.fingerprint,
                        'fingerprint_hash': seg.fingerprint_hash,
                        'duration': seg.duration
                    }
                    for seg in segments
                ]
            }
            with open(cache_path, 'w') as f:
                json.dump(data, f)
        except Exception as e:
            logger.warning(f"Failed to save fingerprint cache for {media_id}: {e}")
    
    async def generate_fingerprint(
        self, 
        file_path: str, 
        start_time: float = 0, 
        duration: float = SEGMENT_LENGTH
    ) -> Optional[str]:
        """
        Generate a Chromaprint fingerprint for an audio segment.
        
        Args:
            file_path: Path to the media file
            start_time: Start time in seconds
            duration: Duration to analyze in seconds
            
        Returns:
            Fingerprint string or None if failed
        """
        if not os.path.exists(file_path):
            logger.error(f"File not found: {file_path}")
            return None
        
        try:
            # Run fpcalc with specific time range
            cmd = [
                FPCALC_PATH,
                "-raw",  # Raw fingerprint format
                "-length", str(int(duration)),
                "-offset", str(int(start_time)),
                file_path
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=60  # 60 second timeout
            )
            
            if process.returncode != 0:
                logger.warning(f"fpcalc failed for {file_path}: {stderr.decode()}")
                return None
            
            # Parse output
            output = stdout.decode()
            for line in output.split('\n'):
                if line.startswith('FINGERPRINT='):
                    return line.split('=', 1)[1].strip()
            
            return None
            
        except asyncio.TimeoutError:
            logger.warning(f"Fingerprint generation timed out for {file_path}")
            return None
        except Exception as e:
            logger.error(f"Error generating fingerprint for {file_path}: {e}")
            return None
    
    async def analyze_media_file(
        self, 
        file_path: str, 
        media_id: str,
        duration: float = None
    ) -> List[AudioSegment]:
        """
        Analyze a media file and generate fingerprints for potential intro/credits regions.
        
        Generates fingerprints for:
        - First 3 minutes (potential intro region)
        - Last 3 minutes (potential credits region)
        
        Each region is divided into segments for comparison.
        """
        # Check cache first
        cached = self._load_cache(media_id)
        if cached:
            logger.info(f"Using cached fingerprints for {media_id}")
            return cached
        
        segments = []
        
        # Analyze intro region (first FINGERPRINT_DURATION seconds)
        intro_end = min(FINGERPRINT_DURATION, duration - 60) if duration else FINGERPRINT_DURATION
        
        for start in range(0, int(intro_end), SEGMENT_LENGTH):
            fp = await self.generate_fingerprint(file_path, start, SEGMENT_LENGTH)
            if fp:
                fp_hash = hashlib.md5(fp.encode()).hexdigest()
                segments.append(AudioSegment(
                    start_time=start,
                    end_time=start + SEGMENT_LENGTH,
                    fingerprint=fp,
                    fingerprint_hash=fp_hash,
                    duration=SEGMENT_LENGTH
                ))
        
        # Analyze credits region (last CREDITS_DURATION seconds)
        if duration and duration > CREDITS_DURATION + 60:
            credits_start = duration - CREDITS_DURATION
            
            for start in range(int(credits_start), int(duration - SEGMENT_LENGTH), SEGMENT_LENGTH):
                fp = await self.generate_fingerprint(file_path, start, SEGMENT_LENGTH)
                if fp:
                    fp_hash = hashlib.md5(fp.encode()).hexdigest()
                    segments.append(AudioSegment(
                        start_time=start,
                        end_time=min(start + SEGMENT_LENGTH, duration),
                        fingerprint=fp,
                        fingerprint_hash=fp_hash,
                        duration=SEGMENT_LENGTH
                    ))
        
        # Cache the results
        if segments:
            self._save_cache(media_id, segments)
        
        logger.info(f"Generated {len(segments)} fingerprint segments for {media_id}")
        return segments
    
    def compare_fingerprints(self, fp1: str, fp2: str) -> float:
        """
        Compare two fingerprints and return similarity score (0-1).
        
        Uses a simple comparison of the raw fingerprint integers.
        Higher score means more similar.
        """
        try:
            # Fingerprints are comma-separated integers
            ints1 = [int(x) for x in fp1.split(',') if x.strip()]
            ints2 = [int(x) for x in fp2.split(',') if x.strip()]
            
            if not ints1 or not ints2:
                return 0.0
            
            # Compare overlapping portions
            min_len = min(len(ints1), len(ints2))
            if min_len == 0:
                return 0.0
            
            # Count matching bits using XOR
            matching_bits = 0
            total_bits = 0
            
            for i in range(min_len):
                xor_result = ints1[i] ^ ints2[i]
                # Count zeros (matching bits) in XOR result
                matching_bits += 32 - bin(xor_result).count('1')
                total_bits += 32
            
            return matching_bits / total_bits if total_bits > 0 else 0.0
            
        except Exception as e:
            logger.warning(f"Error comparing fingerprints: {e}")
            return 0.0
    
    async def detect_intro_segments(
        self,
        series_episodes: List[Dict],  # [{media_id, file_path, duration}, ...]
        min_episodes: int = 2
    ) -> List[DetectedSegment]:
        """
        Detect intro/credits segments by comparing fingerprints across episodes.
        
        When the same audio appears in multiple episodes at similar positions,
        it's likely an intro or credits sequence.
        
        Args:
            series_episodes: List of episode info dicts
            min_episodes: Minimum episodes that must match to confirm a segment
            
        Returns:
            List of detected segments
        """
        if len(series_episodes) < min_episodes:
            logger.info(f"Not enough episodes ({len(series_episodes)}) for intro detection")
            return []
        
        detected = []
        
        # Analyze all episodes
        all_segments: Dict[str, List[AudioSegment]] = {}
        
        for episode in series_episodes:
            media_id = episode['media_id']
            file_path = episode['file_path']
            duration = episode.get('duration', 0)
            
            if not os.path.exists(file_path):
                continue
            
            segments = await self.analyze_media_file(file_path, media_id, duration)
            all_segments[media_id] = segments
        
        if len(all_segments) < min_episodes:
            return []
        
        # Compare intro regions (first 3 minutes) across episodes
        intro_matches = self._find_matching_segments(
            all_segments, 
            time_range=(0, FINGERPRINT_DURATION),
            min_matches=min_episodes
        )
        
        for match in intro_matches:
            detected.append(DetectedSegment(
                segment_type='intro',
                start_time=match['start_time'],
                end_time=match['end_time'],
                confidence=match['confidence'],
                detected_in_episodes=match['match_count']
            ))
        
        # Compare credits regions across episodes
        credits_matches = self._find_matching_segments(
            all_segments,
            time_range_from_end=CREDITS_DURATION,
            min_matches=min_episodes
        )
        
        for match in credits_matches:
            detected.append(DetectedSegment(
                segment_type='credits',
                start_time=match['start_time'],
                end_time=match['end_time'],
                confidence=match['confidence'],
                detected_in_episodes=match['match_count']
            ))
        
        return detected
    
    def _find_matching_segments(
        self,
        all_segments: Dict[str, List[AudioSegment]],
        time_range: Tuple[float, float] = None,
        time_range_from_end: float = None,
        min_matches: int = 2
    ) -> List[Dict]:
        """
        Find segments that match across multiple episodes.
        
        Returns list of {start_time, end_time, confidence, match_count}
        """
        matches = []
        media_ids = list(all_segments.keys())
        
        if len(media_ids) < min_matches:
            return []
        
        # Use first episode as reference
        reference_id = media_ids[0]
        reference_segments = all_segments[reference_id]
        
        # Filter to relevant time range
        if time_range:
            reference_segments = [
                s for s in reference_segments 
                if s.start_time >= time_range[0] and s.end_time <= time_range[1]
            ]
        
        # Compare each reference segment against other episodes
        for ref_seg in reference_segments:
            match_count = 1  # Count reference as first match
            similarity_scores = []
            
            for other_id in media_ids[1:]:
                other_segments = all_segments[other_id]
                
                # Find best matching segment in similar time position
                best_score = 0
                
                for other_seg in other_segments:
                    # Must be in similar time position (within 30 seconds)
                    time_diff = abs(other_seg.start_time - ref_seg.start_time)
                    if time_diff > 30:
                        continue
                    
                    score = self.compare_fingerprints(
                        ref_seg.fingerprint, 
                        other_seg.fingerprint
                    )
                    
                    if score > best_score:
                        best_score = score
                
                if best_score >= SIMILARITY_THRESHOLD:
                    match_count += 1
                    similarity_scores.append(best_score)
            
            # If enough episodes match, record this segment
            if match_count >= min_matches:
                avg_confidence = sum(similarity_scores) / len(similarity_scores) if similarity_scores else 0
                matches.append({
                    'start_time': ref_seg.start_time,
                    'end_time': ref_seg.end_time,
                    'confidence': avg_confidence,
                    'match_count': match_count
                })
        
        # Merge adjacent matching segments
        merged = self._merge_adjacent_segments(matches)
        
        return merged
    
    def _merge_adjacent_segments(self, segments: List[Dict], gap: float = 5) -> List[Dict]:
        """Merge segments that are adjacent or overlapping."""
        if not segments:
            return []
        
        # Sort by start time
        sorted_segs = sorted(segments, key=lambda x: x['start_time'])
        
        merged = [sorted_segs[0].copy()]
        
        for seg in sorted_segs[1:]:
            last = merged[-1]
            
            # If this segment overlaps or is close to the last one, merge
            if seg['start_time'] <= last['end_time'] + gap:
                last['end_time'] = max(last['end_time'], seg['end_time'])
                last['confidence'] = max(last['confidence'], seg['confidence'])
                last['match_count'] = max(last['match_count'], seg['match_count'])
            else:
                merged.append(seg.copy())
        
        return merged


# Singleton instance
_fprint_analyzer: Optional[FprintAnalyzer] = None


def get_fprint_analyzer() -> FprintAnalyzer:
    """Get or create the FprintAnalyzer instance."""
    global _fprint_analyzer
    if _fprint_analyzer is None:
        _fprint_analyzer = FprintAnalyzer()
    return _fprint_analyzer


async def analyze_series_for_intros(series_episodes: List[Dict]) -> List[Dict]:
    """
    Convenience function to analyze a series and return detected segments.
    
    Args:
        series_episodes: List of dicts with {media_id, file_path, duration}
        
    Returns:
        List of segment dicts ready to store in database
    """
    analyzer = get_fprint_analyzer()
    detected = await analyzer.detect_intro_segments(series_episodes)
    
    # Convert to dict format for storage
    return [
        {
            'type': seg.segment_type,
            'start': seg.start_time,
            'end': seg.end_time,
            'confidence': seg.confidence,
            'episodes_matched': seg.detected_in_episodes,
            'estimated': False  # Not estimated, actually detected
        }
        for seg in detected
    ]
