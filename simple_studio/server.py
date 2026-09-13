"""
====================================================================
KhmerDub AI (Simple) — Auto Khmer Dubbing, one file in one file out.
No login, no premium tiers, no manual timeline editing. Upload a
video or audio file, wait, download the Khmer-dubbed result.

Reuses the same battle-tested transcription/translation/voice-cloning
pipeline as the main Studio app (services/khmer_dubber.py and
services/audio_processor.py) — just wrapped in a much simpler UI/API.
====================================================================
"""
import os
import sys
import uuid
import json
import shutil
import asyncio
import subprocess
import traceback

APP_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(APP_DIR)
sys.path.insert(0, BASE_DIR)

from dotenv import load_dotenv
load_dotenv(os.path.join(BASE_DIR, '.env'))

from fastapi import FastAPI, File, UploadFile, Form, BackgroundTasks, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from services.khmer_dubber import KhmerDubber
from services import audio_processor
from services import vocal_separator

UPLOAD_DIR = os.path.join(APP_DIR, 'data', 'uploads')
OUTPUT_DIR = os.path.join(APP_DIR, 'data', 'outputs')
VOICES_DIR = os.path.join(APP_DIR, 'data', 'voices')
VOICES_REGISTRY = os.path.join(VOICES_DIR, 'registry.json')
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(VOICES_DIR, exist_ok=True)

ALLOWED_EXT = {'.mp4', '.mkv', '.mov', '.avi', '.webm', '.mp3', '.wav', '.m4a', '.aac'}
ALLOWED_VOICE_EXT = {'.mp3', '.wav', '.m4a', '.aac', '.ogg'}


def load_voices() -> list:
    if not os.path.exists(VOICES_REGISTRY):
        return []
    try:
        with open(VOICES_REGISTRY, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []


def save_voices(voices: list):
    with open(VOICES_REGISTRY, 'w', encoding='utf-8') as f:
        json.dump(voices, f, ensure_ascii=False, indent=2)

app = FastAPI(title="KhmerDub AI - Simple Auto Khmer Dubbing")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

dubber = KhmerDubber()
jobs = {}


def has_video_stream(path: str) -> bool:
    try:
        out = audio_processor.run_command(
            f'ffprobe -v error -select_streams v -show_entries stream=index -of csv=p=0 "{path}"'
        )
        return bool(out.strip())
    except Exception:
        return False


async def run_audio_only_pipeline(audio_path: str, output_dir: str, on_progress, forced_ref_voice: str = None) -> dict:
    """Same transcription -> translation -> voice-clone -> mix pipeline as the
    full video path, minus the final video remux step, for audio-only uploads.

    If forced_ref_voice is given (a path to a saved voice sample), every line
    is cloned from that one voice instead of AI auto-detecting a voice per
    character."""
    duration = audio_processor.get_media_duration(audio_path)

    on_progress(15, 'AI កំពុងវិភាគ និងស្រង់ការសន្ទនាទាំងអស់ក្នុងឯកសារ...')
    segments = await dubber.extract_dialogue_timeline(audio_path, duration, 'full', on_progress)
    if not segments:
        raise RuntimeError('AI រកមិនឃើញការសន្ទនាណាមួយក្នុងឯកសារនេះទេ')

    on_progress(42, f'បានរកឃើញឃ្លាសរុប {len(segments)}! កំពុងចាត់តាំងសំឡេងតួអង្គ...')
    auto_voice_map = {} if forced_ref_voice else await dubber.extract_character_voice_samples(audio_path, segments, output_dir)

    total = len(segments)
    for i, seg in enumerate(segments):
        ref = forced_ref_voice or auto_voice_map.get(seg.get('speaker_id'))
        line_path = os.path.join(output_dir, f"line_{i}.wav")
        prog = 50 + round(((i + 1) / total) * 32)
        char_name = seg.get('speaker_name') or seg.get('speaker_id')
        on_progress(prog, f'កំពុងបញ្ចេញសំឡេង "{char_name}" ({i + 1}/{total})...')
        await dubber.synthesize_realistic_speech(
            seg.get('khmer_translation', ''),
            line_path,
            'voxcpm-voice-actor',
            ref,
            {
                'gender': seg.get('gender'),
                'emotion': seg.get('emotion', 'dramatic'),
                'role': seg.get('speaker_role', 'male_lead' if seg.get('gender') != 'female' else 'female_lead'),
            },
        )
        seg['audioPath'] = line_path

    on_progress(85, 'កំពុងតម្រៀបសំឡេងតួអង្គទាំងអស់តាមពេលវេលា...')
    master_path = os.path.join(output_dir, 'dialogue_master.wav')
    await dubber.assemble_timeline_audio(segments, duration, master_path)

    on_progress(93, 'កំពុងលាយសំឡេងខ្មែរជាមួយសំឡេងដើម...')
    mixed_path = os.path.join(output_dir, 'final_audio.mp3')
    audio_processor.mix_vocals_with_original(audio_path, master_path, mixed_path, 2.2, 0.85)

    script = "\n".join(
        f"{s.get('speaker_name') or s.get('speaker_id')}: {s.get('khmer_translation')}" for s in segments
    )
    return {'outputAudioPath': mixed_path, 'khmerScript': script}


async def run_job(job_id: str, input_path: str, ref_voice_path: str = None):
    job = jobs[job_id]
    job_dir = os.path.join(OUTPUT_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)

    def on_progress(pct, msg):
        job['progress'] = pct
        job['message'] = msg
        job['status'] = 'processing'

    try:
        job['status'] = 'processing'
        on_progress(3, 'កំពុងពិនិត្យឯកសារ...')
        is_video = has_video_stream(input_path)

        on_progress(6, 'កំពុងស្រង់សំឡេងចេញពីឯកសារ...')
        extracted_audio_path = os.path.join(job_dir, 'original_audio.mp3')
        audio_processor.extract_audio(input_path, extracted_audio_path)

        if is_video:
            dub_options = {'referenceAudioPath': ref_voice_path} if ref_voice_path else {}
            result = await dubber.process_khmer_dubbing(
                input_path, extracted_audio_path, job_dir, dub_options, on_progress=on_progress
            )
            job['mediaType'] = 'video'
            job['outputUrl'] = f"/media/{job_id}/{result['outputVideoFilename']}"
            job['script'] = result.get('khmerScript', '')
        else:
            result = await run_audio_only_pipeline(extracted_audio_path, job_dir, on_progress, forced_ref_voice=ref_voice_path)
            job['mediaType'] = 'audio'
            job['outputUrl'] = f"/media/{job_id}/{os.path.basename(result['outputAudioPath'])}"
            job['script'] = result.get('khmerScript', '')

        job['status'] = 'done'
        job['progress'] = 100
        job['message'] = 'ជោគជ័យ! សំឡេងខ្មែររួចរាល់ហើយ 🎉'
    except Exception as e:
        traceback.print_exc()
        job['status'] = 'error'
        job['error'] = str(e)
        job['message'] = f'កំហុស: {e}'


async def run_voice_redub_job(job_id: str, video_path: str, voice_path: str):
    """Clean a user's own recorded voice, add character, and mix it into their
    video in place of the original speech — the original video's background
    music/effects are preserved via the same ducking mix used elsewhere."""
    job = jobs[job_id]
    job_dir = os.path.join(OUTPUT_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)

    def on_progress(pct, msg):
        job['progress'] = pct
        job['message'] = msg
        job['status'] = 'processing'

    try:
        job['status'] = 'processing'
        on_progress(5, 'កំពុងស្រង់សំឡេងដើមចេញពីវីដេអូ (សម្រាប់ភ្លេងកំដរ)...')
        original_audio_path = os.path.join(job_dir, 'original_audio.mp3')
        audio_processor.extract_audio(video_path, original_audio_path)

        on_progress(20, 'កំពុងសម្អាតសំឡេងថតរបស់អ្នក (កម្ចាត់សំឡេងរំខាន)...')
        clean_dir = os.path.join(job_dir, 'clean')
        sep_result = await asyncio.to_thread(vocal_separator.separate_vocals_and_bgm, voice_path, clean_dir, True)
        clean_voice_path = sep_result['vocalsPath']

        on_progress(55, 'កំពុងបន្ថែមទឹកដម និងគុណភាពសំឡេងឱ្យកាន់តែច្បាស់...')
        mastered_voice_path = os.path.join(job_dir, 'mastered_voice.wav')
        audio_processor.master_vocal_track(clean_voice_path, mastered_voice_path)

        on_progress(75, 'កំពុងលាយសំឡេងចូលជាមួយភ្លេងកំដរដើម...')
        mixed_audio_path = os.path.join(job_dir, 'mixed_audio.mp3')
        audio_processor.mix_vocals_with_original(original_audio_path, mastered_voice_path, mixed_audio_path, 2.0, 0.85)

        on_progress(92, 'កំពុងផ្គុំចូលវីដេអូចុងក្រោយ...')
        video_ext = os.path.splitext(video_path)[1] or '.mp4'
        final_video_path = os.path.join(job_dir, f'redub_final{video_ext}')
        audio_processor.merge_video_audio(video_path, mixed_audio_path, final_video_path)

        job['mediaType'] = 'video'
        job['outputUrl'] = f"/media/{job_id}/{os.path.basename(final_video_path)}"
        job['script'] = None
        job['status'] = 'done'
        job['progress'] = 100
        job['message'] = 'ជោគជ័យ! សំឡេងរបស់អ្នកត្រូវបានបញ្ចូលទៅវីដេអូរួចរាល់ហើយ 🎉'
    except Exception as e:
        traceback.print_exc()
        job['status'] = 'error'
        job['error'] = str(e)
        job['message'] = f'កំហុស: {e}'


@app.post('/api/redub')
async def start_redub(background_tasks: BackgroundTasks, video: UploadFile = File(...), voice: UploadFile = File(...)):
    video_ext = os.path.splitext(video.filename or '')[1].lower()
    voice_ext = os.path.splitext(voice.filename or '')[1].lower()
    if video_ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"ប្រភេទឯកសារវីដេអូមិនត្រូវបានគាំទ្រ: {video_ext}")
    if voice_ext not in ALLOWED_VOICE_EXT:
        raise HTTPException(status_code=400, detail=f"ប្រភេទឯកសារសំឡេងមិនត្រូវបានគាំទ្រ: {voice_ext}")

    job_id = uuid.uuid4().hex[:10]
    video_path = os.path.join(UPLOAD_DIR, f"{job_id}_video{video_ext}")
    voice_path = os.path.join(UPLOAD_DIR, f"{job_id}_voice{voice_ext}")
    with open(video_path, 'wb') as f:
        shutil.copyfileobj(video.file, f)
    with open(voice_path, 'wb') as f:
        shutil.copyfileobj(voice.file, f)

    jobs[job_id] = {
        'status': 'queued',
        'progress': 1,
        'message': 'កំពុងរង់ចាំចាប់ផ្តើម...',
        'mediaType': None,
        'outputUrl': None,
        'script': None,
        'error': None,
    }
    background_tasks.add_task(run_voice_redub_job, job_id, video_path, voice_path)
    return {'jobId': job_id}


async def run_recreate_voice_job(job_id: str, video_path: str, khmer_audio_path: str, ref_voice_path: str = None, gender: str = 'female'):
    """Take a Khmer narration that already matches the video's story and
    re-synthesize it with a chosen voice (built-in neural or a saved voice
    library sample), keeping the original wording and timing, then mix the
    new voice back onto the video's original background music."""
    job = jobs[job_id]
    job_dir = os.path.join(OUTPUT_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)

    def on_progress(pct, msg):
        job['progress'] = pct
        job['message'] = msg
        job['status'] = 'processing'

    try:
        job['status'] = 'processing'
        on_progress(3, 'កំពុងស្រង់សំឡេងដើមចេញពីវីដេអូ (សម្រាប់ភ្លេងកំដរ)...')
        original_audio_path = os.path.join(job_dir, 'original_audio.mp3')
        audio_processor.extract_audio(video_path, original_audio_path)

        duration = audio_processor.get_media_duration(khmer_audio_path)
        segments = await dubber.extract_khmer_only_timeline(khmer_audio_path, duration, on_progress)
        if not segments:
            raise RuntimeError('AI ស្តាប់មិនឃើញអត្ថបទសម្តីខ្មែរណាមួយក្នុងឯកសារនេះទេ')

        total = len(segments)
        role = 'female_lead' if gender != 'male' else 'male_lead'
        for i, seg in enumerate(segments):
            line_path = os.path.join(job_dir, f"line_{i}.wav")
            prog = 45 + round(((i + 1) / total) * 35)
            on_progress(prog, f'កំពុងបង្កើតសំឡេងឡើងវិញ ({i + 1}/{total})...')
            await dubber.synthesize_realistic_speech(
                seg.get('khmer_translation', ''),
                line_path,
                'voxcpm-voice-actor',
                ref_voice_path,
                {'gender': gender, 'emotion': 'neutral', 'role': role},
            )
            seg['audioPath'] = line_path

        on_progress(85, 'កំពុងតម្រៀបសំឡេងតាមពេលវេលាដើម...')
        master_path = os.path.join(job_dir, 'recreated_voice_master.wav')
        await dubber.assemble_timeline_audio(segments, duration, master_path)

        on_progress(93, 'កំពុងលាយសំឡេងថ្មីជាមួយភ្លេងកំដរដើម...')
        mixed_audio_path = os.path.join(job_dir, 'mixed_audio.mp3')
        audio_processor.mix_vocals_with_original(original_audio_path, master_path, mixed_audio_path, 2.2, 0.85)

        on_progress(97, 'កំពុងផ្គុំចូលវីដេអូចុងក្រោយ...')
        video_ext = os.path.splitext(video_path)[1] or '.mp4'
        final_video_path = os.path.join(job_dir, f'recreated_final{video_ext}')
        audio_processor.merge_video_audio(video_path, mixed_audio_path, final_video_path)

        job['mediaType'] = 'video'
        job['outputUrl'] = f"/media/{job_id}/{os.path.basename(final_video_path)}"
        job['script'] = "\n".join(s.get('khmer_translation', '') for s in segments)
        job['status'] = 'done'
        job['progress'] = 100
        job['message'] = 'ជោគជ័យ! សំឡេងត្រូវបានបង្កើតឡើងវិញ និងបញ្ចូលទៅវីដេអូរួចរាល់ហើយ 🎉'
    except Exception as e:
        traceback.print_exc()
        job['status'] = 'error'
        job['error'] = str(e)
        job['message'] = f'កំហុស: {e}'


@app.post('/api/recreate-voice')
async def start_recreate_voice(
    background_tasks: BackgroundTasks,
    video: UploadFile = File(...),
    voice: UploadFile = File(...),
    voiceId: str = Form(None),
    gender: str = Form('female'),
):
    video_ext = os.path.splitext(video.filename or '')[1].lower()
    voice_ext = os.path.splitext(voice.filename or '')[1].lower()
    if video_ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"ប្រភេទឯកសារវីដេអូមិនត្រូវបានគាំទ្រ: {video_ext}")
    if voice_ext not in ALLOWED_VOICE_EXT:
        raise HTTPException(status_code=400, detail=f"ប្រភេទឯកសារសំឡេងមិនត្រូវបានគាំទ្រ: {voice_ext}")

    ref_voice_path = None
    if voiceId:
        match = next((v for v in load_voices() if v['id'] == voiceId), None)
        if match:
            ref_voice_path = os.path.join(VOICES_DIR, match['filename'])

    job_id = uuid.uuid4().hex[:10]
    video_path = os.path.join(UPLOAD_DIR, f"{job_id}_video{video_ext}")
    voice_path = os.path.join(UPLOAD_DIR, f"{job_id}_voice{voice_ext}")
    with open(video_path, 'wb') as f:
        shutil.copyfileobj(video.file, f)
    with open(voice_path, 'wb') as f:
        shutil.copyfileobj(voice.file, f)

    jobs[job_id] = {
        'status': 'queued',
        'progress': 1,
        'message': 'កំពុងរង់ចាំចាប់ផ្តើម...',
        'mediaType': None,
        'outputUrl': None,
        'script': None,
        'error': None,
    }
    background_tasks.add_task(run_recreate_voice_job, job_id, video_path, voice_path, ref_voice_path, gender or 'female')
    return {'jobId': job_id}


def download_video_from_url(url: str, dest_dir: str) -> str:
    """Download a video/audio from a public link (YouTube, TikTok, Facebook, etc.)
    using yt-dlp. Runs with an explicit argument list (never shell=True) so the
    user-supplied URL can never be interpreted as shell syntax."""
    output_template = os.path.join(dest_dir, '%(id)s.%(ext)s')
    cmd = [
        'yt-dlp',
        '-f', 'bv*+ba/b',
        '--merge-output-format', 'mp4',
        '--no-playlist',
        '-o', output_template,
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        raise RuntimeError(f'ទាញយកវីដេអូបានបរាជ័យ: {result.stderr[-300:].strip()}')

    files = [f for f in os.listdir(dest_dir) if not f.startswith('.')]
    if not files:
        raise RuntimeError('ទាញយកវីដេអូបានបរាជ័យ (Link មិនត្រូវបានគាំទ្រ ឬឯកសារឯកជន)')
    files.sort(key=lambda f: os.path.getmtime(os.path.join(dest_dir, f)), reverse=True)
    return os.path.join(dest_dir, files[0])


async def run_download_and_dub(job_id: str, url: str, ref_voice_path: str = None):
    job = jobs[job_id]
    try:
        job['status'] = 'processing'
        job['progress'] = 2
        job['message'] = 'កំពុងទាញយកវីដេអូពី Link... (អាចចំណាយពេលបន្តិច)'
        dl_dir = os.path.join(UPLOAD_DIR, f"dl_{job_id}")
        os.makedirs(dl_dir, exist_ok=True)
        video_path = await asyncio.to_thread(download_video_from_url, url, dl_dir)
        job['progress'] = 5
        job['message'] = 'ទាញយកជោគជ័យ! កំពុងចាប់ផ្តើមវិភាគ...'
    except Exception as e:
        traceback.print_exc()
        job['status'] = 'error'
        job['error'] = str(e)
        job['message'] = f'កំហុសទាញយក: {e}'
        return

    await run_job(job_id, video_path, ref_voice_path)


@app.post('/api/dub/from-url')
async def start_dub_from_url(background_tasks: BackgroundTasks, url: str = Form(...), voiceId: str = Form(None)):
    clean_url = (url or '').strip()
    if not clean_url.lower().startswith(('http://', 'https://')):
        raise HTTPException(status_code=400, detail='Link មិនត្រឹមត្រូវទេ (ត្រូវចាប់ផ្តើមដោយ http:// ឬ https://)')

    ref_voice_path = None
    if voiceId:
        match = next((v for v in load_voices() if v['id'] == voiceId), None)
        if match:
            ref_voice_path = os.path.join(VOICES_DIR, match['filename'])

    job_id = uuid.uuid4().hex[:10]
    jobs[job_id] = {
        'status': 'queued',
        'progress': 0,
        'message': 'កំពុងរង់ចាំចាប់ផ្តើមទាញយក...',
        'mediaType': None,
        'outputUrl': None,
        'script': None,
        'error': None,
    }
    background_tasks.add_task(run_download_and_dub, job_id, clean_url, ref_voice_path)
    return {'jobId': job_id}


@app.post('/api/dub')
async def start_dub(background_tasks: BackgroundTasks, file: UploadFile = File(...), voiceId: str = Form(None)):
    ext = os.path.splitext(file.filename or '')[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"ប្រភេទឯកសារមិនត្រូវបានគាំទ្រ: {ext}")

    ref_voice_path = None
    if voiceId:
        match = next((v for v in load_voices() if v['id'] == voiceId), None)
        if match:
            ref_voice_path = os.path.join(VOICES_DIR, match['filename'])

    job_id = uuid.uuid4().hex[:10]
    input_path = os.path.join(UPLOAD_DIR, f"{job_id}{ext}")
    with open(input_path, 'wb') as f:
        shutil.copyfileobj(file.file, f)

    jobs[job_id] = {
        'status': 'queued',
        'progress': 1,
        'message': 'កំពុងរង់ចាំចាប់ផ្តើម...',
        'mediaType': None,
        'outputUrl': None,
        'script': None,
        'error': None,
    }
    background_tasks.add_task(run_job, job_id, input_path, ref_voice_path)
    return {'jobId': job_id}


@app.get('/api/status/{job_id}')
def get_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail='Job not found')
    return job


@app.get('/api/voices')
def list_voices():
    return load_voices()


@app.post('/api/voices')
async def add_voice(label: str = Form(...), file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename or '')[1].lower()
    if ext not in ALLOWED_VOICE_EXT:
        raise HTTPException(status_code=400, detail=f"ប្រភេទឯកសារមិនត្រូវបានគាំទ្រ: {ext}")

    voice_id = uuid.uuid4().hex[:10]
    filename = f"{voice_id}{ext}"
    with open(os.path.join(VOICES_DIR, filename), 'wb') as f:
        shutil.copyfileobj(file.file, f)

    entry = {
        'id': voice_id,
        'label': (label or '').strip() or (file.filename or 'សំឡេងគំរូ'),
        'filename': filename,
        'url': f"/voices/{filename}",
    }
    voices = load_voices()
    voices.append(entry)
    save_voices(voices)
    return entry


@app.delete('/api/voices/{voice_id}')
def delete_voice(voice_id: str):
    voices = load_voices()
    target = next((v for v in voices if v['id'] == voice_id), None)
    if not target:
        raise HTTPException(status_code=404, detail='Voice not found')
    try:
        os.remove(os.path.join(VOICES_DIR, target['filename']))
    except Exception:
        pass
    voices = [v for v in voices if v['id'] != voice_id]
    save_voices(voices)
    return {'success': True}


app.mount('/media', StaticFiles(directory=OUTPUT_DIR), name='media')
app.mount('/voices', StaticFiles(directory=VOICES_DIR), name='voices')
app.mount('/', StaticFiles(directory=os.path.join(APP_DIR, 'public'), html=True), name='public')


if __name__ == '__main__':
    import uvicorn
    port = int(os.getenv('SIMPLE_STUDIO_PORT', '4000'))
    print("=" * 68)
    print(f"KhmerDub AI (Simple) កំពុងដំណើរការនៅ http://localhost:{port}")
    print("=" * 68)
    uvicorn.run(app, host='0.0.0.0', port=port)
