#!/usr/bin/env python3
"""
Voice Sample Processor for Piper Training
Converts MP3 to WAV, splits into chunks, prepares dataset.
"""
import os
import sys
import subprocess
from pathlib import Path

try:
    from pydub import AudioSegment
    from pydub.silence import split_on_silence
except ImportError:
    print("Install pydub: pip install pydub")
    sys.exit(1)

# Configuration
INPUT_FILE = Path("/mnt/c/Users/badge/OneDrive/Desktop/патерны голоса/Baranov_Vyacheslav_-_Obrazec_golosa_(SkySound.cc).mp3")
OUTPUT_DIR = Path("/opt/piper-voice-clone/dataset/wavs")
METADATA_FILE = Path("/opt/piper-voice-clone/dataset/metadata.csv")
SAMPLE_RATE = 22050
MIN_CHUNK_LENGTH = 3000  # 3 seconds
MAX_CHUNK_LENGTH = 15000  # 15 seconds
SILENCE_THRESHOLD = -40  # dB
SILENCE_DURATION = 300  # ms

def convert_to_wav(input_path, output_path, sample_rate=22050):
    """Convert MP3 to WAV with specified sample rate."""
    print(f"Converting {input_path.name} to WAV...")
    audio = AudioSegment.from_file(str(input_path))
    audio = audio.set_frame_rate(sample_rate).set_channels(1).set_sample_width(2)
    audio.export(str(output_path), format="wav")
    print(f"  Saved: {output_path}")
    return audio

def split_audio(audio, min_length=MIN_CHUNK_LENGTH, max_length=MAX_CHUNK_LENGTH):
    """Split audio into chunks based on silence detection."""
    print("Splitting audio into chunks...")
    
    # Split on silence
    chunks = split_on_silence(
        audio,
        min_silence_len=SILENCE_DURATION,
        silence_thresh=SILENCE_THRESHOLD,
        keep_silence=500
    )
    
    # Filter by length
    valid_chunks = []
    for chunk in chunks:
        if len(chunk) < min_length:
            continue
        if len(chunk) > max_length:
            # Split long chunks further
            for i in range(0, len(chunk), max_length):
                sub_chunk = chunk[i:i + max_length]
                if len(sub_chunk) >= min_length:
                    valid_chunks.append(sub_chunk)
        else:
            valid_chunks.append(chunk)
    
    print(f"  Found {len(valid_chunks)} valid chunks")
    return valid_chunks

def save_chunks(chunks, output_dir):
    """Save chunks as WAV files."""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    saved_files = []
    for i, chunk in enumerate(chunks):
        filename = f"chunk_{i:04d}.wav"
        filepath = output_dir / filename
        chunk.export(str(filepath), format="wav")
        saved_files.append(filename)
        duration = len(chunk) / 1000
        print(f"  Saved: {filename} ({duration:.1f}s)")
    
    return saved_files

def create_metadata(file_list, output_file):
    """Create metadata CSV for Piper training."""
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        for filename in file_list:
            # Empty transcription - user will fill in
            f.write(f"{filename}|\n")
    
    print(f"  Created: {output_file}")
    print(f"  NOTE: Fill in transcriptions manually in metadata.csv")

def main():
    print("=" * 60)
    print("Voice Sample Processor for Piper Training")
    print("=" * 60)
    print()
    
    if not INPUT_FILE.exists():
        print(f"Error: Input file not found: {INPUT_FILE}")
        sys.exit(1)
    
    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Convert to WAV
    wav_path = OUTPUT_DIR / "source.wav"
    audio = convert_to_wav(INPUT_FILE, wav_path)
    
    print()
    
    # Split into chunks
    chunks = split_audio(audio)
    
    if not chunks:
        print("No valid chunks found. Try adjusting parameters.")
        sys.exit(1)
    
    print()
    
    # Save chunks
    print("Saving chunks...")
    saved_files = save_chunks(chunks, OUTPUT_DIR)
    
    print()
    
    # Create metadata
    print("Creating metadata...")
    create_metadata(saved_files, METADATA_FILE)
    
    print()
    print("=" * 60)
    print("Processing complete!")
    print("=" * 60)
    print()
    print("Next steps:")
    print("  1. Open metadata.csv and fill in transcriptions")
    print("  2. Each line: filename.wav|transcription text")
    print("  3. Then run: python3 prepare_dataset.py")
    print()
    print(f"Files saved to: {OUTPUT_DIR}")
    print(f"Metadata: {METADATA_FILE}")

if __name__ == "__main__":
    main()
