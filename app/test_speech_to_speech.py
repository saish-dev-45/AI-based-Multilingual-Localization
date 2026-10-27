from speech_services.speech_to_speech_service import (
    translate_speech,
)

output = translate_speech(
    input_audio="test_audio.wav",
    output_audio="outputs/hindi_speech.wav",
    target_language="hin",
)

print("Translation complete:", output)