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
