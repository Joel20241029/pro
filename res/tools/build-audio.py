"""Reproduce the original music and game sounds. WAV intermediates go to Downloads."""
import argparse
import array
import hashlib
import json
import math
import pathlib
import random
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


def village_samples(score):
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
    return samples


def battle_samples(score):
    rate, beat = score['sampleRate'], 60 / score['bpm']
    beats_per_bar = score['beatsPerBar']
    samples = [0.0] * round(rate * score['bars'] * beats_per_bar * beat)
    synthesis = score['synthesis']
    arpeggio, bass = score['arpeggio'], score['bass']

    def tone(freq, start, length, voice):
        for i in range(round(length * rate)):
            t = i / rate
            env = (min(1, t / synthesis['attackSeconds']) * math.exp(-t / voice['decaySeconds'])
                   * min(1, (length - t) / synthesis['releaseSeconds']))
            phase = 2 * math.pi * freq * t
            value = math.sin(phase)
            for harmonic, gain in enumerate(synthesis['harmonics'], 2):
                value += gain * math.sin(harmonic * phase)
            samples[(round(start * rate) + i) % len(samples)] += voice['gain'] * env * value

    steps_per_beat = arpeggio['stepsPerBeat']
    for bar in range(score['bars']):
        chord = score['chordsHz'][bar % len(score['chordsHz'])]
        for step in range(beats_per_bar * steps_per_beat):
            when = (bar * beats_per_bar + step / steps_per_beat) * beat
            tone(chord[step % len(chord)] * arpeggio['frequencyRatio'], when, beat * arpeggio['lengthBeats'], arpeggio)
        for step in range(beats_per_bar):
            when = (bar * beats_per_bar + step) * beat
            tone(chord[0] * bass['frequencyRatio'], when, bass['lengthSeconds'], bass)
    return samples


def click_samples(score):
    rate, length, synthesis = score['sampleRate'], score['durationSeconds'], score['synthesis']
    base, overtone = synthesis['frequenciesHz']
    samples = []
    for i in range(round(rate * length)):
        t = i / rate
        env = (min(1, t / synthesis['attackSeconds']) * math.exp(-t * synthesis['decayRate'])
               * min(1, (length - t) / synthesis['releaseSeconds']))
        samples.append(env * (math.sin(2 * math.pi * base * t) + synthesis['overtoneGain'] * math.sin(2 * math.pi * overtone * t)))
    return samples


def tower_samples(score):
    rate, length, voice = score['sampleRate'], score['durationSeconds'], score['synthesis']
    rng = random.Random(voice['noiseSeed'])
    samples, smooth = [], 0.0
    for i in range(round(rate * length)):
        t = i / rate
        smooth = smooth * .65 + rng.uniform(-1, 1) * .35
        env = min(1, t / voice['attackSeconds']) * (1 - t / length) ** 2
        phase = 2 * math.pi * (voice['frequencyHz'] * t - voice['sweepHz'] * t * t / (2 * length))
        samples.append(env * (smooth * voice['noiseGain'] + math.sin(phase)))
    return samples


def defeat_samples(score):
    rate, length, voice = score['sampleRate'], score['durationSeconds'], score['synthesis']
    high, low = voice['pitchHz']
    rng = random.Random(voice['noiseSeed'])
    # 两次极短停顿把同一口气分成三声。共振峰给声带激励加上喉音的音色。
    formants = []
    for frequency, bandwidth, gain in voice['formants']:
        radius = math.exp(-math.pi * bandwidth / rate)
        formants.append([2 * radius * math.cos(2 * math.pi * frequency / rate), radius ** 2, gain * (1 - radius), 0., 0.])
    phase, last_flow, noise = 0., 0., 0.
    samples = []
    for i in range(round(rate * length)):
        t = i / rate
        envelope = sum(gain * math.sin(math.pi * (t - start) / span) ** 1.3
                       for start, span, gain in voice['bursts'] if start <= t < start + span)
        pitch = low + (high - low) * (1 - t / length) ** 1.2
        pitch += voice['jitterHz'] * (math.sin(2 * math.pi * 19 * t) + .4 * math.sin(2 * math.pi * 31 * t))
        phase = (phase + pitch / rate) % 2
        cycle = phase % 1
        opened, closed = voice['glottalPhase']
        if cycle < opened:
            flow = .5 - .5 * math.cos(math.pi * cycle / opened)
        elif cycle < closed:
            flow = .5 + .5 * math.cos(math.pi * (cycle - opened) / (closed - opened))
        else:
            flow = 0.
        flow *= 1 if phase < 1 else voice['creakGain']
        noise += .32 * (rng.uniform(-1, 1) - noise)
        excitation = flow - last_flow + voice['breathGain'] * noise
        last_flow = flow
        resonant = 0.
        for band in formants:
            pole, damping, gain, last, before = band
            frame = pole * last - damping * before + gain * excitation
            band[3], band[4] = frame, last
            resonant += frame
        samples.append(envelope * (resonant + voice['throatGain'] * excitation))
    return samples


def build(name, render):
    score_path = root / f'source/audio/{name}.score.json'
    score = json.loads(score_path.read_text())
    rate, source_peak = score['sampleRate'], score['synthesis']['peak']
    samples = render(score)
    peak = max(abs(v) for v in samples)
    pcm = array.array('h', [round(v / peak * source_peak * 32767) for v in samples])
    wav_path = work / f'{name}.master.wav'
    with wave.open(str(wav_path), 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(pcm.tobytes())
    package_file = f'{name}.mp3'
    output = root / 'audio' / package_file
    output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', str(wav_path),
                    '-codec:a', 'libmp3lame', '-b:a', score['mp3Bitrate'], '-ac', '1', '-ar', str(rate),
                    '-map_metadata', '-1', str(output)], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(output), '-f', 'null', '-'], check=True)
    return {'title': score['title'], 'source': score_path.relative_to(root).as_posix(), 'generator': 'tools/build-audio.py',
            'runtimeFile': output.relative_to(root).as_posix(), 'packageFile': package_file, 'bundle': score['bundle'],
            'durationSeconds': len(pcm) / rate, 'sampleRate': rate, 'channels': 1, 'bitrate': score['mp3Bitrate'],
            'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
            'sourceSha256': hashlib.sha256(score_path.read_bytes()).hexdigest(), 'sourcePeak': source_peak,
            'sourceBoundaryDifference': abs(pcm[-1] - pcm[0]) / 32768,
            'license': 'Original score and synthesis; no third-party samples', 'phoneListeningVerified': False}


tracks = [build('village_loop', village_samples), build('battle_loop', battle_samples), build('ui_click', click_samples),
          build('tower_fire', tower_samples), build('enemy_defeat', defeat_samples)]
if tracks[0]['bytes'] > 120_000:
    raise ValueError('Village music exceeded the approved 120 KB target')
if sum(track['bytes'] for track in tracks[1:]) > 80_000:
    raise ValueError('Battle and interface audio exceeded the approved 80 KB target')
if tracks[-1]['bytes'] > 3_000:
    raise ValueError('Enemy defeat sound exceeded the approved 3 KB target')
report = {'tracks': tracks, 'bytes': sum(track['bytes'] for track in tracks)}
(root / 'audio/manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
if args.sync:
    package = root.parent / 'project/LayaProject/assets/resources'
    for track in tracks:
        destination = package / track['bundle'] / track['packageFile']
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / track['runtimeFile'], destination)
print(json.dumps(report, ensure_ascii=False))
