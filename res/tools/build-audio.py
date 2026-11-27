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


def master_samples(score):
    # 使用批准的母带及其校验值，确保资源重建时保留试听音色和时长。
    master = root / score['masterWav']
    if hashlib.sha256(master.read_bytes()).hexdigest() != score['masterSha256']:
        raise ValueError(f"音频母带校验失败：{score['masterWav']}")
    with wave.open(str(master), 'rb') as wav:
        expected = (1, 2, score['sampleRate'], round(score['sampleRate'] * score['durationSeconds']))
        if wav.getparams()[:4] != expected:
            raise ValueError(f"音频母带声道、采样率或时长不符：{score['masterWav']}")
        samples = array.array('h')
        samples.frombytes(wav.readframes(wav.getnframes()))
    return samples


def patrol_flight_samples(score):
    rate, length, voice = score['sampleRate'], score['durationSeconds'], score['synthesis']
    count = round(rate * length)
    rng = random.Random(voice['noiseSeed'])
    noise = [rng.uniform(-1, 1) for _ in range(count)]
    samples = []
    # 整圈走完整数个载波周期。滑音、气息和噪声滤波也首尾相接，可以在实际落地时结束循环。
    cycles = round(voice['centerHz'] * length)
    for i in range(count):
        angle = math.tau * i / count
        phase = (cycles * angle - voice['glideHz'] * length * math.sin(angle)
                 + voice['skewHz'] * length * (1 - math.cos(2 * angle)) / 2)
        breath = (1 - math.cos(angle)) / 2
        air = sum(noise[(i - k) % count] for k in range(4)) / 4
        whistle = math.sin(phase) + voice['overtoneGain'] * breath * math.sin(2 * phase)
        samples.append((voice['breathFloor'] + breath) * (whistle + voice['airGain'] * air))
    return samples


def patrol_landing_samples(score):
    rate, length, voice = score['sampleRate'], score['durationSeconds'], score['synthesis']
    rng = random.Random(voice['noiseSeed'])
    samples, smooth = [], 0.0
    for i in range(round(rate * length)):
        t = i / rate
        attack = min(1, t / voice['attackSeconds'])
        release = min(1, (length - t) / voice['releaseSeconds'])
        # 脚底触地时音高快速下沉，中频鞋底共鸣和短砂土声使小扬声器也保有接触感。
        fall = voice['pitchDecaySeconds']
        phase = math.tau * (voice['bodyHz'] * t + voice['dropHz'] * fall * (1 - math.exp(-t / fall)))
        body = math.sin(phase) * math.exp(-t / voice['bodyDecaySeconds'])
        sole = math.sin(phase * voice['soleRatio']) * math.exp(-t / voice['soleDecaySeconds'])
        smooth += voice['grainSmoothing'] * (rng.uniform(-1, 1) - smooth)
        grit = smooth * math.exp(-t / voice['grainDecaySeconds'])
        samples.append(attack * release * (body + voice['soleGain'] * sole + voice['grainGain'] * grit))
    return samples


def delivery_splash_samples(score):
    rate, duration, mix = score['sampleRate'], score['durationSeconds'], score['synthesis']
    rng = random.Random(mix['noiseSeed'])
    smooth = 0.0
    samples = []
    for i in range(round(duration * rate)):
        t = i / rate
        noise = rng.uniform(-1, 1)
        smooth += .23 * (noise - smooth)
        # 硬纸盒先碰地，紧跟三声短促汤汁泡响；单声道也能分清「啪、噗噜」。
        box = (math.sin(math.tau * mix['boxHz'] * t) + (noise - smooth) * .8) * math.exp(-t / .017)
        splash = 1.4 * smooth * min(1, t / .009) * math.exp(-t / .047)
        drops = 0.0
        for start, frequency in mix['drops']:
            age = t - start
            if age >= 0:
                phase = math.tau * frequency * (age + .019 * (1 - math.exp(-age / .016)))
                drops += .62 * math.sin(phase) * min(1, age / .004) * math.exp(-age / .017)
        samples.append((box + splash + drops) * min(1, t / .0015, (duration - t) / .015))
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
          build('tower_fire', tower_samples), build('enemy_defeat', master_samples)]
if tracks[-1]['bytes'] > 3_000:
    raise ValueError('Enemy defeat sound exceeded the approved 3 KB target')
tracks.extend([build('patrol_flight', patrol_flight_samples), build('patrol_landing', patrol_landing_samples)])
tracks.append(build('patrol_rapid_fire', patrol_landing_samples))
tracks.append(build('hero_hit', master_samples))
tracks.append(build('delivery_splash', delivery_splash_samples))
if tracks[0]['bytes'] > 120_000:
    raise ValueError('Village music exceeded the approved 120 KB target')
if sum(track['bytes'] for track in tracks[1:]) > 80_000:
    raise ValueError('Battle and interface audio exceeded the approved 80 KB target')
report = {'tracks': tracks, 'bytes': sum(track['bytes'] for track in tracks)}
(root / 'audio/manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
if args.sync:
    package = root.parent / 'project/LayaProject/assets/resources'
    for track in tracks:
        destination = package / track['bundle'] / track['packageFile']
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / track['runtimeFile'], destination)
print(json.dumps(report, ensure_ascii=False))
