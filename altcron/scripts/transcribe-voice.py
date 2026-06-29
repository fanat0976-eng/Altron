#!/usr/bin/env python3
"""
Auto-transcribe voice chunks using Whisper.
Generates metadata.csv with transcriptions.
"""
import os
import sys
from pathlib import Path

try:
    import whisper
except ImportError:
    print("Installing whisper...")
    os.system("pip install openai-whisper")
    import whisper

# Configuration
WAVS_DIR = Path("/opt/piper-voice-clone/dataset/wavs")
METADATA_FILE = Path("/opt/piper-voice-clone/dataset/metadata.csv")
MODEL_SIZE = "base"  # tiny, base, small, medium, large

def transcribe_chunks(wavs_dir, model_size="base"):
    """Transcribe all WAV chunks using Whisper."""
    print(f"Loading Whisper model ({model_size})...")
    model = whisper.load_model(model_size)
    
    wav_files = sorted(wavs_dir.glob("chunk_*.wav"))
    print(f"Found {len(wav_files)} chunks to transcribe")
    
    results = []
    for i, wav_file in enumerate(wav_files):
        print(f"  [{i+1}/{len(wav_files)}] Transcribing {wav_file.name}...", end=" ")
        
        result = model.transcribe(
            str(wav_file),
            language="ru",  # Russian
            fp16=False  # CPU mode
        )
        
        text = result["text"].strip()
        results.append((wav_file.name, text))
        print(f"'{text[:50]}...'")
    
    return results

def save_metadata(results, output_file):
    """Save transcriptions to metadata.csv."""
    with open(output_file, 'w', encoding='utf-8') as f:
        for filename, text in results:
            f.write(f"{filename}|{text}\n")
    
    print(f"\nSaved {len(results)} entries to {output_file}")

def main():
    print("=" * 60)
    print("Voice Chunk Auto-Transcription")
    print("=" * 60)
    print()
    
    if not WAVS_DIR.exists():
        print(f"Error: {WAVS_DIR} not found")
        print("Run process-voice.py first")
        sys.exit(1)
    
    # Transcribe
    results = transcribe_chunks(WAVS_DIR, MODEL_SIZE)
    
    # Save metadata
    save_metadata(results, METADATA_FILE)
    
    print()
    print("=" * 60)
    print("Transcription complete!")
    print("=" * 60)
    print()
    print("Next step: Run training with:")
    print("  python3 -m piper_train.train \\")
    print("    --config configs/voice_config.json \\")
    print("    --dataset-dir dataset \\")
    print("    --output-dir output")

if __name__ == "__main__":
    main()
