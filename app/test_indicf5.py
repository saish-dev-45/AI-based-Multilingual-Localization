import numpy as np
import soundfile as sf
from transformers import AutoModel

MODEL_ID = "ai4bharat/IndicF5"

print("Loading IndicF5 model...")
model = AutoModel.from_pretrained(
    MODEL_ID,
    trust_remote_code=True,
)

text = "नमस्ते, LinguaAI में आपका स्वागत है।"

audio = model(
    text,
    ref_audio_path="app/tts/prompts/reference.wav",
    ref_text=open(
        "app/tts/prompts/reference.txt",
        encoding="utf-8",
    ).read().strip(),
)

audio = np.asarray(audio)

if audio.dtype == np.int16:
    audio = audio.astype(np.float32) / 32768.0
else:
    audio = audio.astype(np.float32)

sf.write("test_output.wav", audio, samplerate=24000)

print("Speech generated: test_output.wav")