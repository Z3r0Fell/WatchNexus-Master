"""
Sieve - WatchNexus Media Health Checker
Filters out the bad, keeps the good - quality control for your media.
Validates and optionally repairs media files to prevent playback issues.
Works with the Marmalade media server to detect corrupted or incomplete files.
"""

import subprocess
import json
import os
import hashlib
import logging
from pathlib import Path
from typing import Optional, Dict, List, Tuple
from dataclasses import dataclass, asdict
from enum import Enum

logger = logging.getLogger(__name__)

class HealthStatus(Enum):
    HEALTHY = "healthy"
    WARNING = "warning"
    ERROR = "error"
    REPAIRABLE = "repairable"
    CORRUPT = "corrupt"

@dataclass
class MediaHealthReport:
    file_path: str
    status: HealthStatus
    file_size: int
    duration: Optional[float]
    video_codec: Optional[str]
    audio_codec: Optional[str]
    container: Optional[str]
    issues: List[str]
    warnings: List[str]
    repairable: bool
    repair_actions: List[str]
    hash_md5: Optional[str]
    hash_sha256: Optional[str]
    
    def to_dict(self):
        result = asdict(self)
        result['status'] = self.status.value
        return result

class SieveChecker:
    """
    Sieve - Comprehensive media file health checker.
    Filters out the bad, keeps the good - quality control for your media.
    Uses FFprobe and FFmpeg to detect common issues that cause playback failures.
    """
    
    def __init__(self, ffprobe_path: str = "ffprobe", ffmpeg_path: str = "ffmpeg"):
        self.ffprobe_path = ffprobe_path
        self.ffmpeg_path = ffmpeg_path
        
    def check_file(self, file_path: str, compute_hash: bool = False) -> MediaHealthReport:
        """
        Perform comprehensive health check on a media file.
        """
        path = Path(file_path)
        
        if not path.exists():
            return MediaHealthReport(
                file_path=file_path,
                status=HealthStatus.ERROR,
                file_size=0,
                duration=None,
                video_codec=None,
                audio_codec=None,
                container=None,
                issues=["File does not exist"],
                warnings=[],
                repairable=False,
                repair_actions=[],
                hash_md5=None,
                hash_sha256=None
            )
        
        file_size = path.stat().st_size
        issues = []
        warnings = []
        repair_actions = []
        
        # Get file info via FFprobe
        probe_data = self._run_ffprobe(file_path)
        
        if probe_data is None:
            return MediaHealthReport(
                file_path=file_path,
                status=HealthStatus.CORRUPT,
                file_size=file_size,
                duration=None,
                video_codec=None,
                audio_codec=None,
                container=None,
                issues=["FFprobe failed to read file - likely corrupt or unsupported format"],
                warnings=[],
                repairable=False,
                repair_actions=[],
                hash_md5=None,
                hash_sha256=None
            )
        
        # Extract basic info
        format_info = probe_data.get('format', {})
        streams = probe_data.get('streams', [])
        
        container = format_info.get('format_name', 'unknown')
        duration = float(format_info.get('duration', 0)) if format_info.get('duration') else None
        
        video_codec = None
        audio_codec = None
        video_stream = None
        audio_stream = None
        
        for stream in streams:
            if stream.get('codec_type') == 'video' and not video_codec:
                video_codec = stream.get('codec_name')
                video_stream = stream
            elif stream.get('codec_type') == 'audio' and not audio_codec:
                audio_codec = stream.get('codec_name')
                audio_stream = stream
        
        # Run checks
        self._check_container_integrity(format_info, issues, warnings, repair_actions)
        self._check_video_stream(video_stream, issues, warnings, repair_actions)
        self._check_audio_stream(audio_stream, issues, warnings, repair_actions)
        self._check_duration_consistency(probe_data, issues, warnings, repair_actions)
        self._check_keyframes(file_path, video_stream, issues, warnings, repair_actions)
        self._check_moov_atom(file_path, container, issues, warnings, repair_actions)
        self._check_stream_sync(probe_data, issues, warnings, repair_actions)
        
        # Compute hashes if requested
        hash_md5 = None
        hash_sha256 = None
        if compute_hash:
            hash_md5, hash_sha256 = self._compute_hashes(file_path)
        
        # Determine overall status
        if issues:
            status = HealthStatus.ERROR if not repair_actions else HealthStatus.REPAIRABLE
        elif warnings:
            status = HealthStatus.WARNING
        else:
            status = HealthStatus.HEALTHY
        
        return MediaHealthReport(
            file_path=file_path,
            status=status,
            file_size=file_size,
            duration=duration,
            video_codec=video_codec,
            audio_codec=audio_codec,
            container=container,
            issues=issues,
            warnings=warnings,
            repairable=len(repair_actions) > 0,
            repair_actions=repair_actions,
            hash_md5=hash_md5,
            hash_sha256=hash_sha256
        )
    
    def repair_file(self, file_path: str, output_path: Optional[str] = None) -> Tuple[bool, str]:
        """
        Attempt to repair common issues in a media file.
        Returns (success, message).
        """
        if output_path is None:
            path = Path(file_path)
            output_path = str(path.parent / f"{path.stem}_repaired{path.suffix}")
        
        # First, check what's wrong
        report = self.check_file(file_path)
        
        if report.status == HealthStatus.HEALTHY:
            return True, "File is already healthy, no repair needed"
        
        if not report.repairable:
            return False, f"File has unrecoverable issues: {', '.join(report.issues)}"
        
        repair_commands = []
        
        # Build repair command based on issues
        base_cmd = [self.ffmpeg_path, '-i', file_path, '-y']
        
        if "moov atom not at start" in ' '.join(report.repair_actions).lower():
            # Move moov atom to start for fast streaming
            repair_commands.append(base_cmd + [
                '-c', 'copy',
                '-movflags', '+faststart',
                output_path
            ])
        
        elif "missing keyframes" in ' '.join(report.repair_actions).lower():
            # Re-encode to fix keyframe issues
            repair_commands.append(base_cmd + [
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '18',
                '-c:a', 'copy',
                '-g', '48',  # Keyframe every 2 seconds at 24fps
                output_path
            ])
        
        elif "stream desync" in ' '.join(report.repair_actions).lower():
            # Remux to fix sync issues
            repair_commands.append(base_cmd + [
                '-c', 'copy',
                '-async', '1',
                '-vsync', '1',
                output_path
            ])
        
        else:
            # Generic remux to fix container issues
            repair_commands.append(base_cmd + [
                '-c', 'copy',
                '-map', '0',
                output_path
            ])
        
        # Try each repair method
        for cmd in repair_commands:
            try:
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=3600  # 1 hour timeout
                )
                
                if result.returncode == 0:
                    # Verify the repaired file
                    new_report = self.check_file(output_path)
                    if new_report.status in [HealthStatus.HEALTHY, HealthStatus.WARNING]:
                        return True, f"File repaired successfully: {output_path}"
                    else:
                        os.remove(output_path)
                        
            except subprocess.TimeoutExpired:
                return False, "Repair timed out"
            except Exception as e:
                logger.error(f"Repair error: {e}")
        
        return False, "All repair attempts failed"
    
    def scan_directory(self, directory: str, extensions: List[str] = None) -> List[MediaHealthReport]:
        """
        Scan all media files in a directory.
        """
        if extensions is None:
            extensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.ts']
        
        reports = []
        path = Path(directory)
        
        for ext in extensions:
            for file_path in path.rglob(f"*{ext}"):
                try:
                    report = self.check_file(str(file_path))
                    reports.append(report)
                except Exception as e:
                    logger.error(f"Error checking {file_path}: {e}")
        
        return reports
    
    def _run_ffprobe(self, file_path: str) -> Optional[Dict]:
        """Run FFprobe and return parsed JSON output."""
        try:
            cmd = [
                self.ffprobe_path,
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                '-show_error',
                file_path
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode != 0:
                logger.error(f"FFprobe error: {result.stderr}")
                return None
            
            return json.loads(result.stdout)
            
        except subprocess.TimeoutExpired:
            logger.error(f"FFprobe timeout for {file_path}")
            return None
        except json.JSONDecodeError as e:
            logger.error(f"FFprobe JSON parse error: {e}")
            return None
        except Exception as e:
            logger.error(f"FFprobe error: {e}")
            return None
    
    def _check_container_integrity(self, format_info: Dict, issues: List, warnings: List, repairs: List):
        """Check container-level integrity."""
        
        # Check if file is truncated
        if format_info.get('probe_score', 100) < 50:
            issues.append("Low probe score - file may be truncated or corrupted")
            repairs.append("Attempt remux to fix container structure")
        
        # Check for valid duration
        duration = format_info.get('duration')
        if duration:
            try:
                dur = float(duration)
                if dur <= 0:
                    issues.append("Invalid duration (0 or negative)")
                elif dur < 1:
                    warnings.append("Very short duration (<1 second)")
            except ValueError:
                issues.append("Invalid duration value in container")
        else:
            warnings.append("No duration in container metadata")
    
    def _check_video_stream(self, stream: Optional[Dict], issues: List, warnings: List, repairs: List):
        """Check video stream health."""
        if stream is None:
            return  # Audio-only file
        
        # Check codec
        codec = stream.get('codec_name', '').lower()
        if codec in ['unknown', '']:
            issues.append("Unknown video codec")
        
        # Check dimensions
        width = stream.get('width', 0)
        height = stream.get('height', 0)
        if width == 0 or height == 0:
            issues.append("Invalid video dimensions")
        elif width < 100 or height < 100:
            warnings.append("Very low resolution video")
        
        # Check for codec-specific issues
        if codec == 'h264':
            profile = stream.get('profile', '')
            if 'High 10' in profile or 'Hi10P' in profile.upper():
                warnings.append("H.264 Hi10P may have compatibility issues with some players")
        
        # Check frame rate
        frame_rate = stream.get('r_frame_rate', '0/1')
        try:
            num, den = map(int, frame_rate.split('/'))
            if den > 0:
                fps = num / den
                if fps <= 0:
                    issues.append("Invalid frame rate")
                elif fps < 10:
                    warnings.append("Very low frame rate")
                elif fps > 120:
                    warnings.append("Very high frame rate may cause playback issues")
        except:
            warnings.append("Could not parse frame rate")
    
    def _check_audio_stream(self, stream: Optional[Dict], issues: List, warnings: List, repairs: List):
        """Check audio stream health."""
        if stream is None:
            warnings.append("No audio stream found")
            return
        
        codec = stream.get('codec_name', '').lower()
        if codec in ['unknown', '']:
            issues.append("Unknown audio codec")
        
        # Check sample rate
        sample_rate = int(stream.get('sample_rate', 0))
        if sample_rate == 0:
            warnings.append("Unknown audio sample rate")
        elif sample_rate < 8000:
            warnings.append("Very low audio sample rate")
        
        # Check channels
        channels = int(stream.get('channels', 0))
        if channels == 0:
            warnings.append("Unknown audio channel count")
    
    def _check_duration_consistency(self, probe_data: Dict, issues: List, warnings: List, repairs: List):
        """Check if stream durations match container duration."""
        format_duration = float(probe_data.get('format', {}).get('duration', 0))
        
        for stream in probe_data.get('streams', []):
            stream_duration = float(stream.get('duration', 0))
            if stream_duration > 0 and format_duration > 0:
                diff = abs(format_duration - stream_duration)
                if diff > 5:  # More than 5 seconds difference
                    warnings.append(f"Stream duration mismatch: container={format_duration:.2f}s, stream={stream_duration:.2f}s")
                    repairs.append("Remux to fix duration inconsistency")
    
    def _check_keyframes(self, file_path: str, video_stream: Optional[Dict], issues: List, warnings: List, repairs: List):
        """Check keyframe distribution."""
        if video_stream is None:
            return
        
        try:
            # Use FFprobe to get keyframe info
            cmd = [
                self.ffprobe_path,
                '-v', 'quiet',
                '-select_streams', 'v:0',
                '-show_entries', 'packet=pts_time,flags',
                '-of', 'json',
                '-read_intervals', '%+30',  # Check first 30 seconds
                file_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                data = json.loads(result.stdout)
                packets = data.get('packets', [])
                
                keyframes = [p for p in packets if 'K' in p.get('flags', '')]
                
                if len(keyframes) == 0 and len(packets) > 0:
                    issues.append("No keyframes found in first 30 seconds")
                    repairs.append("Re-encode to add proper keyframes")
                elif len(packets) > 100 and len(keyframes) < 2:
                    warnings.append("Very few keyframes - may cause seeking issues")
                    repairs.append("Re-encode to improve keyframe distribution")
                    
        except Exception as e:
            logger.debug(f"Keyframe check error: {e}")
    
    def _check_moov_atom(self, file_path: str, container: str, issues: List, warnings: List, repairs: List):
        """Check if moov atom is at start (for MP4/M4V)."""
        if 'mp4' not in container.lower() and 'mov' not in container.lower():
            return
        
        try:
            # Read first 32 bytes to check for ftyp
            with open(file_path, 'rb') as f:
                header = f.read(32)
            
            # Check for ftyp box at start (normal)
            if b'ftyp' in header[:12]:
                # Now check if moov comes before mdat
                with open(file_path, 'rb') as f:
                    # Read first 10MB to find moov/mdat
                    chunk = f.read(10 * 1024 * 1024)
                
                moov_pos = chunk.find(b'moov')
                mdat_pos = chunk.find(b'mdat')
                
                if moov_pos > 0 and mdat_pos > 0 and moov_pos > mdat_pos:
                    warnings.append("moov atom is after mdat - slow streaming start")
                    repairs.append("Run faststart to move moov atom to beginning")
                    
        except Exception as e:
            logger.debug(f"Moov atom check error: {e}")
    
    def _check_stream_sync(self, probe_data: Dict, issues: List, warnings: List, repairs: List):
        """Check for audio/video sync issues."""
        streams = probe_data.get('streams', [])
        
        video_start = None
        audio_start = None
        
        for stream in streams:
            start_time = float(stream.get('start_time', 0))
            if stream.get('codec_type') == 'video':
                video_start = start_time
            elif stream.get('codec_type') == 'audio':
                audio_start = start_time
        
        if video_start is not None and audio_start is not None:
            sync_diff = abs(video_start - audio_start)
            if sync_diff > 0.5:  # More than 500ms
                warnings.append(f"Audio/video start time mismatch: {sync_diff:.3f}s")
                repairs.append("Remux with sync correction")
    
    def _compute_hashes(self, file_path: str) -> Tuple[str, str]:
        """Compute MD5 and SHA256 hashes of file."""
        md5_hash = hashlib.md5()
        sha256_hash = hashlib.sha256()
        
        try:
            with open(file_path, 'rb') as f:
                for chunk in iter(lambda: f.read(8192), b''):
                    md5_hash.update(chunk)
                    sha256_hash.update(chunk)
            
            return md5_hash.hexdigest(), sha256_hash.hexdigest()
        except Exception as e:
            logger.error(f"Hash computation error: {e}")
            return None, None


# Singleton instance
sieve_checker = SieveChecker()


def check_media_health(file_path: str, compute_hash: bool = False) -> Dict:
    """
    Quick function to check a single file's health using Sieve.
    Returns a dictionary with the health report.
    """
    report = sieve_checker.check_file(file_path, compute_hash)
    return report.to_dict()


def repair_media_file(file_path: str, output_path: str = None) -> Dict:
    """
    Attempt to repair a media file using Sieve.
    Returns dict with success status and message.
    """
    success, message = sieve_checker.repair_file(file_path, output_path)
    return {"success": success, "message": message}


def scan_library(directory: str) -> List[Dict]:
    """
    Scan a directory for media health issues using Sieve.
    Returns list of health reports.
    """
    reports = sieve_checker.scan_directory(directory)
    return [r.to_dict() for r in reports]
