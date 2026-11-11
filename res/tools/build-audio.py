"""Reproduce the original tiny village loop. WAV/intermediates go only to Downloads."""
import argparse
import array
import hashlib
import json
import math
import pathlib
import shutil
import subprocess
import wave

root = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--work', required=True)
parser.add_argument('--sync', action='store_true')
args = parser.parse_args()
work = pathlib.Path(args.work).resolve()
if not work.is_relative_to(pathlib.Path('/Users/happyelements/Downloads')):
    raise ValueError('Intermediate WAV must be under Downloads')
work.mkdir(parents=True, exist_ok=True)
score_path = root / 'source/audio/village_loop.score.json'
score = json.loads(score_path.read_text())
rate, beat = score['sampleRate'], 60 / score['bpm']
duration = len(score['bars']) * score['beatsPerBar'] * beat
samples = array.array('d', [0]) * round(duration * rate)
gains = score['synthesis']

def frequency(note):
    semitone = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[note[0]]
    midi = 12 * (int(note[-1]) + 1) + semitone
    return 440 * 2 ** ((midi - 69) / 12)

def tone(note, start, length, gain, bass=False):
    f = frequency(note)
    count = round(length * rate)
    for i in range(count):
        t = i / rate
        attack = min(1, t / (0.025 if bass else 0.012))
        release = min(1, (length - t) / 0.18)
        decay = math.exp(-t / (1.2 if bass else 0.65))
        phase = 2 * math.pi * f * t
        sound = math.sin(phase) + 0.21 * math.sin(2 * phase) * math.exp(-t * 2) + 0.065 * math.sin(3 * phase) * math.exp(-t * 3)
        # Tail wraps into the next loop; this makes the source boundary continuous.
        samples[(round(start * rate) + i) % len(samples)] += gain * attack * release * decay * sound

for bar_index, bar in enumerate(score['bars']):
    start = bar_index * score['beatsPerBar'] * beat
    tone(bar['bass'], start, 3.0, gains['bassGain'], True)
    for i, note in enumerate(bar['chord']):
        tone(note, start + i * 0.5 * beat, 2.5, gains['chordGain'])
    for i, note in enumerate(bar['melody']):
        if note:
            tone(note, start + i * beat, 2.1, gains['melodyGain'])

dry = samples[:]
for seconds, gain in zip(gains['echoSeconds'], gains['echoGains']):
    delay = round(seconds * rate)
    for i in range(len(samples)):
        samples[i] += dry[(i - delay) % len(samples)] * gain
peak = max(abs(v) for v in samples)
pcm = array.array('h', [round(v / peak * gains['peak'] * 32767) for v in samples])
wav_path = work / 'village_loop.master.wav'
with wave.open(str(wav_path), 'wb') as wav:
    wav.setnchannels(1)
    wav.setsampwidth(2)
    wav.setframerate(rate)
    wav.writeframes(pcm.tobytes())
output = root / 'audio/village_loop.mp3'
output.parent.mkdir(parents=True, exist_ok=True)
subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', str(wav_path), '-codec:a', 'libmp3lame', '-b:a', score['mp3Bitrate'], '-ac', '1', '-ar', str(rate), '-map_metadata', '-1', str(output)], check=True)
if output.stat().st_size > 120_000:
    raise ValueError('Music exceeded the approved 120 KB target')
report = {'title': score['title'], 'source': 'source/audio/village_loop.score.json', 'generator': 'tools/build-audio.py',
          'runtimeFile': 'audio/village_loop.mp3', 'packageFile': 'village_loop.mp3', 'durationSeconds': duration,
          'sampleRate': rate, 'channels': 1, 'bitrate': score['mp3Bitrate'], 'bytes': output.stat().st_size,
          'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'sourceSha256': hashlib.sha256(score_path.read_bytes()).hexdigest(),
          'sourcePeak': gains['peak'], 'sourceBoundaryDifference': abs(pcm[-1] - pcm[0]) / 32768,
          'license': 'Original score and synthesis; no third-party samples', 'phoneListeningVerified': False}
(root / 'audio/manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
if args.sync:
    shutil.copyfile(output, root.parent / 'project/LayaProject/assets/resources/village/village_loop.mp3')
print(json.dumps(report, ensure_ascii=False))
