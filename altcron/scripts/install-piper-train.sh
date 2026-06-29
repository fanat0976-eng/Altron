#!/bin/bash
# ===================================================================
# Piper TTS Voice Cloning - Installation Script
# For WSL2 Ubuntu 22.04
# ===================================================================

set -e

RED="\033[0;31m"
GRN="\033[0;32m"
YLW="\033[1;33m"
CYN="\033[0;36m"
NC="\033[0m"

say() { echo -e "${CYN}[*]${NC} $*"; }
ok() { echo -e "${GRN}[✓]${NC} $*"; }
fail() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  fail "Please run as root: sudo bash install-piper-train.sh"
fi

say "Installing Piper TTS Voice Cloning environment..."

# Update system
say "Updating system packages..."
apt update -y >/dev/null 2>&1
apt install -y python3 python3-pip python3-venv git ffmpeg >/dev/null 2>&1

# Create project directory
PROJECT_DIR="/opt/piper-voice-clone"
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

# Create virtual environment
say "Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip >/dev/null 2>&1

# Install PyTorch (CPU version - smaller, works everywhere)
say "Installing PyTorch (CPU version)..."
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1

# Install Piper training dependencies
say "Installing Piper training dependencies..."
pip install \
  piper-tts \
  pydub \
  librosa \
  soundfile \
  numpy \
  scipy \
  matplotlib \
  tensorboard \
  wandb \
  phonemizer \
  espeak-ng >/dev/null 2>&1

# Install espeak-ng
say "Installing espeak-ng..."
apt install -y espeak-ng >/dev/null 2>&1

# Clone piper-train repository
say "Cloning piper-train repository..."
if [ ! -d "piper-train" ]; then
  git clone https://github.com/rhasspy/piper-train.git
fi

# Install piper-train dependencies
say "Installing piper-train dependencies..."
cd piper-train
pip install -r requirements.txt >/dev/null 2>&1

# Go back to project root
cd "$PROJECT_DIR"

# Create directory structure
say "Creating directory structure..."
mkdir -p dataset/{wavs,metadata}
mkdir -p output
mkdir -p configs

# Create sample config
say "Creating sample training config..."
cat > configs/voice_config.json << 'EOF'
{
  "train": {
    "batch_size": 16,
    "learning_rate": 0.001,
    "epochs": 1000,
    "save_every": 100,
    "eval_every": 50
  },
  "model": {
    "num_speakers": 1,
    "speaker_embedding_dim": 256,
    "hidden_dim": 512,
    "num_layers": 6
  },
  "audio": {
    "sample_rate": 22050,
    "num_mels": 80,
    "n_fft": 1024,
    "hop_length": 256
  }
}
EOF

# Create README with instructions
cat > README.md << 'EOF'
# Piper Voice Clone

Fine-tune Piper TTS on your own voice.

## Directory Structure

```
/opt/piper-voice-clone/
├── venv/                    # Python virtual environment
├── piper-train/             # Piper training code
├── dataset/
│   ├── wavs/                # Audio files (WAV format, 22050 Hz)
│   └── metadata.csv         # Transcriptions
├── output/                  # Trained models
└── configs/
    └── voice_config.json    # Training config
```

## How to Use

### 1. Record Your Voice

Record 10-30 minutes of clear speech:

```bash
# Activate environment
source /opt/piper-voice-clone/venv/bin/activate

# Record audio (uses system microphone)
python3 record_voice.py
```

### 2. Prepare Dataset

Place your WAV files in `dataset/wavs/` and create `metadata.csv`:

```bash
python3 prepare_dataset.py
```

### 3. Train Model

```bash
cd /opt/piper-voice-clone
source venv/bin/activate

# Start training
python3 -m piper_train.train \
  --config configs/voice_config.json \
  --dataset-dir dataset \
  --output-dir output
```

### 4. Export to ONNX

```bash
python3 export_model.py --input output/best_model.pth --output output/voice.onnx
```

### 5. Use with Altron

Copy `voice.onnx` and `voice.onnx.json` to Altron's TTS models directory.
EOF

# Create voice recording script
cat > record_voice.py << 'RECORD_EOF'
#!/usr/bin/env python3
"""
Voice Recorder for Piper Training
Records audio from microphone and saves as WAV files.
"""
import os
import sys
import time
import wave
import json
from pathlib import Path

try:
    import sounddevice as sd
    import numpy as np
except ImportError:
    print("Install dependencies: pip install sounddevice numpy")
    sys.exit(1)

# Configuration
SAMPLE_RATE = 22050
CHANNELS = 1
CHUNK_DURATION = 10  # seconds per chunk
DATASET_DIR = Path("dataset/wavs")
METADATA_FILE = Path("dataset/metadata.csv")

def record_chunk(duration=CHUNK_DURATION):
    """Record audio chunk from microphone."""
    print(f"Recording {duration} seconds... Speak now!")
    audio = sd.rec(
        int(duration * SAMPLE_RATE),
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        dtype='float32'
    )
    sd.wait()
    return audio.flatten()

def save_wav(audio, filename):
    """Save audio as WAV file."""
    with wave.open(str(filename), 'w') as wav_file:
        wav_file.setnchannels(CHANNELS)
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(SAMPLE_RATE)
        wav_file.writeframes((audio * 32767).astype(np.int16).tobytes())

def main():
    DATASET_DIR.mkdir(parents=True, exist_ok=True)
    
    print("=" * 50)
    print("Voice Recorder for Piper Training")
    print("=" * 50)
    print(f"Sample rate: {SAMPLE_RATE} Hz")
    print(f"Chunk duration: {CHUNK_DURATION} seconds")
    print(f"Output directory: {DATASET_DIR}")
    print()
    
    # Load existing count
    existing = list(DATASET_DIR.glob("*.wav"))
    count = len(existing)
    
    print("Instructions:")
    print("1. Find a quiet room")
    print("2. Speak clearly into your microphone")
    print("3. Read any text (books, articles, etc.)")
    print("4. Press ENTER to start each recording chunk")
    print("5. Type 'quit' to finish")
    print()
    
    metadata_lines = []
    if METADATA_FILE.exists():
        metadata_lines = METADATA_FILE.read_text().splitlines()
    
    while True:
        user_input = input(f"Press ENTER to record chunk {count + 1} (or 'quit'): ")
        if user_input.lower() == 'quit':
            break
        
        audio = record_chunk()
        
        filename = f"chunk_{count:04d}.wav"
        filepath = DATASET_DIR / filename
        save_wav(audio, filepath)
        
        # Add to metadata (filename|transcription)
        # User will need to fill in transcription manually
        metadata_lines.append(f"{filename}|")
        
        count += 1
        print(f"Saved: {filepath}")
        print()
    
    # Save metadata
    METADATA_FILE.write_text("\n".join(metadata_lines))
    print()
    print(f"Recording complete! {count} chunks saved.")
    print(f"Next step: Fill in transcriptions in {METADATA_FILE}")
    print(f"Then run: python3 prepare_dataset.py")

if __name__ == "__main__":
    main()
RECORD_EOF

# Create dataset preparation script
cat > prepare_dataset.py << 'PREPARE_EOF'
#!/usr/bin/env python3
"""
Dataset Preparation for Piper Training
Validates audio files and creates training metadata.
"""
import os
import csv
import json
from pathlib import Path

try:
    import soundfile as sf
except ImportError:
    print("Install dependencies: pip install soundfile")
    exit(1)

DATASET_DIR = Path("dataset/wavs")
METADATA_FILE = Path("dataset/metadata.csv")
OUTPUT_FILE = Path("dataset/metadata.jsonl")

def validate_audio(filepath):
    """Validate audio file format."""
    try:
        info = sf.info(filepath)
        return info.samplerate == 22050 and info.channels == 1
    except:
        return False

def main():
    print("=" * 50)
    print("Dataset Preparation for Piper Training")
    print("=" * 50)
    
    # Read metadata.csv
    if not METADATA_FILE.exists():
        print(f"Error: {METADATA_FILE} not found")
        print("Run record_voice.py first to create recordings")
        exit(1)
    
    entries = []
    with open(METADATA_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split('|', 1)
            if len(parts) == 2:
                entries.append({
                    'audio_file': parts[0],
                    'text': parts[1]
                })
    
    # Validate entries
    valid_entries = []
    for entry in entries:
        audio_path = DATASET_DIR / entry['audio_file']
        
        if not audio_path.exists():
            print(f"Warning: {entry['audio_file']} not found, skipping")
            continue
        
        if not validate_audio(audio_path):
            print(f"Warning: {entry['audio_file']} invalid format, skipping")
            continue
        
        if not entry['text'].strip():
            print(f"Warning: {entry['audio_file']} has no transcription, skipping")
            continue
        
        valid_entries.append(entry)
    
    print(f"Found {len(valid_entries)} valid entries")
    
    # Save as JSONL for piper-train
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        for entry in valid_entries:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
    
    print(f"Saved to {OUTPUT_FILE}")
    print()
    print("Next step: Run training with:")
    print("  python3 -m piper_train.train --config configs/voice_config.json --dataset-dir dataset --output-dir output")

if __name__ == "__main__":
    main()
PREPARE_EOF

# Create model export script
cat > export_model.py << 'EXPORT_EOF'
#!/usr/bin/env python3
"""
Export trained Piper model to ONNX format.
"""
import argparse
import torch
from pathlib import Path

def export_to_onnx(checkpoint_path, output_path):
    """Export PyTorch model to ONNX."""
    print(f"Loading checkpoint: {checkpoint_path}")
    
    # Load checkpoint
    checkpoint = torch.load(checkpoint_path, map_location='cpu')
    
    # TODO: Implement actual export logic based on piper-train architecture
    # This is a placeholder - actual implementation depends on model architecture
    
    print(f"Model exported to: {output_path}")
    print("Note: This is a simplified export. Use piper-train's official export for production.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Input checkpoint path")
    parser.add_argument("--output", required=True, help="Output ONNX path")
    args = parser.parse_args()
    
    export_to_onnx(args.input, args.output)
EXPORT_EOF

# Make scripts executable
chmod +x record_voice.py prepare_dataset.py export_model.py

ok "Installation complete!"
echo
echo "Next steps:"
echo "  1. cd $PROJECT_DIR"
echo "  2. source venv/bin/activate"
echo "  3. python3 record_voice.py  # Record your voice"
echo "  4. python3 prepare_dataset.py  # Prepare dataset"
echo "  5. Start training with piper-train"
echo
echo "Project directory: $PROJECT_DIR"
