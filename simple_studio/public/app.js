const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

const els = {
  uploadCard: document.getElementById('uploadCard'),
  progressCard: document.getElementById('progressCard'),
  reviewCard: document.getElementById('reviewCard'),
  resultCard: document.getElementById('resultCard'),
  errorCard: document.getElementById('errorCard'),

  reviewProgress: document.getElementById('reviewProgress'),
  reviewSpeakerSelect: document.getElementById('reviewSpeakerSelect'),
  reviewTextArea: document.getElementById('reviewTextArea'),
  reviewTestBtn: document.getElementById('reviewTestBtn'),
  reviewPreviewPlayer: document.getElementById('reviewPreviewPlayer'),
  reviewPrevBtn: document.getElementById('reviewPrevBtn'),
  reviewNextBtn: document.getElementById('reviewNextBtn'),
  reviewConfirmBtn: document.getElementById('reviewConfirmBtn'),
  reviewCancelBtn: document.getElementById('reviewCancelBtn'),

  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('fileInput'),
  filePicked: document.getElementById('filePicked'),
  filePickedIcon: document.getElementById('filePickedIcon'),
  filePickedName: document.getElementById('filePickedName'),
  filePickedSize: document.getElementById('filePickedSize'),
  changeFileBtn: document.getElementById('changeFileBtn'),
  startBtn: document.getElementById('startBtn'),

  progressRingFg: document.getElementById('progressRingFg'),
  progressPercent: document.getElementById('progressPercent'),
  progressMessage: document.getElementById('progressMessage'),

  mediaPreview: document.getElementById('mediaPreview'),
  downloadBtn: document.getElementById('downloadBtn'),
  scriptToggleBtn: document.getElementById('scriptToggleBtn'),
  scriptBox: document.getElementById('scriptBox'),
  newFileBtn: document.getElementById('newFileBtn'),

  errorMessage: document.getElementById('errorMessage'),
  retryBtn: document.getElementById('retryBtn'),

  toastContainer: document.getElementById('toastContainer'),

  videoUrlInput: document.getElementById('videoUrlInput'),
  urlDubBtn: document.getElementById('urlDubBtn'),

  modeTabAuto: document.getElementById('modeTabAuto'),
  modeTabMyVoice: document.getElementById('modeTabMyVoice'),
  modeTabRecreate: document.getElementById('modeTabRecreate'),
  autoModeSection: document.getElementById('autoModeSection'),
  myVoiceModeSection: document.getElementById('myVoiceModeSection'),
  recreateModeSection: document.getElementById('recreateModeSection'),

  myVoiceVideoDropzone: document.getElementById('myVoiceVideoDropzone'),
  myVoiceVideoInput: document.getElementById('myVoiceVideoInput'),
  myVoiceVideoText: document.getElementById('myVoiceVideoText'),
  myVoiceAudioDropzone: document.getElementById('myVoiceAudioDropzone'),
  myVoiceAudioInput: document.getElementById('myVoiceAudioInput'),
  myVoiceAudioText: document.getElementById('myVoiceAudioText'),
  myVoiceStartBtn: document.getElementById('myVoiceStartBtn'),

  recreateVideoDropzone: document.getElementById('recreateVideoDropzone'),
  recreateVideoInput: document.getElementById('recreateVideoInput'),
  recreateVideoText: document.getElementById('recreateVideoText'),
  recreateAudioDropzone: document.getElementById('recreateAudioDropzone'),
  recreateAudioInput: document.getElementById('recreateAudioInput'),
  recreateAudioText: document.getElementById('recreateAudioText'),
  recreateStartBtn: document.getElementById('recreateStartBtn'),
  recreateVoiceSelect: document.getElementById('recreateVoiceSelect'),
  openVoiceLibBtnRecreate: document.getElementById('openVoiceLibBtnRecreate'),

  voiceSelect: document.getElementById('voiceSelect'),
  openVoiceLibBtn: document.getElementById('openVoiceLibBtn'),
  voiceLibModal: document.getElementById('voiceLibModal'),
  closeVoiceLibBtn: document.getElementById('closeVoiceLibBtn'),
  addVoiceForm: document.getElementById('addVoiceForm'),
  newVoiceLabel: document.getElementById('newVoiceLabel'),
  newVoiceFile: document.getElementById('newVoiceFile'),
  newVoiceFilename: document.getElementById('newVoiceFilename'),
  voiceList: document.getElementById('voiceList'),
  voiceListEmpty: document.getElementById('voiceListEmpty'),
};

let selectedFile = null;
let pollTimer = null;
let currentJobId = null;

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast-item ${type}`;
  toast.textContent = message;
  els.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

function showCard(name) {
  els.uploadCard.classList.toggle('hidden', name !== 'upload');
  els.progressCard.classList.toggle('hidden', name !== 'progress');
  els.reviewCard.classList.toggle('hidden', name !== 'review');
  els.resultCard.classList.toggle('hidden', name !== 'result');
  els.errorCard.classList.toggle('hidden', name !== 'error');
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAudioFile(name) {
  return /\.(mp3|wav|m4a|aac)$/i.test(name);
}

function pickFile(file) {
  if (!file) return;
  selectedFile = file;
  els.filePickedName.textContent = file.name;
  els.filePickedSize.textContent = formatSize(file.size);
  els.filePickedIcon.textContent = isAudioFile(file.name) ? '🎵' : '🎞️';
  els.filePicked.classList.remove('hidden');
}

els.dropzone.addEventListener('click', (e) => {
  // label already triggers the hidden input; avoid double-trigger from bubbling
});

els.fileInput.addEventListener('change', () => {
  if (els.fileInput.files && els.fileInput.files[0]) {
    pickFile(els.fileInput.files[0]);
  }
});

['dragenter', 'dragover'].forEach((evt) => {
  els.dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    els.dropzone.classList.add('dragover');
  });
});
['dragleave', 'drop'].forEach((evt) => {
  els.dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    els.dropzone.classList.remove('dragover');
  });
});
els.dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) pickFile(file);
});

els.changeFileBtn.addEventListener('click', () => {
  selectedFile = null;
  els.fileInput.value = '';
  els.filePicked.classList.add('hidden');
});

els.startBtn.addEventListener('click', () => {
  if (!selectedFile) return;
  startDubbing(selectedFile);
});

els.urlDubBtn.addEventListener('click', () => {
  const url = els.videoUrlInput.value.trim();
  if (!url) {
    showToast('សូមបិទភ្ជាប់ Link វីដេអូជាមុនសិន', 'warning');
    return;
  }
  if (!/^https?:\/\//i.test(url)) {
    showToast('Link មិនត្រឹមត្រូវទេ (ត្រូវចាប់ផ្តើមដោយ http:// ឬ https://)', 'warning');
    return;
  }
  startDubbingFromUrl(url);
});

els.newFileBtn.addEventListener('click', resetToUpload);
els.retryBtn.addEventListener('click', resetToUpload);

els.scriptToggleBtn.addEventListener('click', () => {
  els.scriptBox.classList.toggle('hidden');
});

function resetToUpload() {
  clearInterval(pollTimer);
  currentJobId = null;
  reviewSegments = [];
  reviewEdits = {};
  reviewSpeakerOptions = [];
  reviewIndex = 0;
  selectedFile = null;
  els.fileInput.value = '';
  els.videoUrlInput.value = '';
  els.filePicked.classList.add('hidden');

  myVoiceVideoFile = null;
  myVoiceAudioFile = null;
  els.myVoiceVideoInput.value = '';
  els.myVoiceAudioInput.value = '';
  els.myVoiceVideoText.textContent = 'ជំហានទី ១ — អូសទម្លាក់ ឬ ជ្រើសរើសវីដេអូ';
  els.myVoiceAudioText.textContent = 'ជំហានទី ២ — អូសទម្លាក់ ឬ ជ្រើសរើសសំឡេងដែលអ្នកបានថត';
  els.myVoiceStartBtn.disabled = true;

  recreateVideoFile = null;
  recreateAudioFile = null;
  els.recreateVideoInput.value = '';
  els.recreateAudioInput.value = '';
  els.recreateVideoText.textContent = 'ជំហានទី ១ — អូសទម្លាក់ ឬ ជ្រើសរើសវីដេអូ';
  els.recreateAudioText.textContent = 'ជំហានទី ២ — អូសទម្លាក់ ឬ ជ្រើសរើសសំឡេងខ្មែរដែលត្រូវនឹងសាច់រឿងរួចហើយ';
  els.recreateStartBtn.disabled = true;

  setProgress(0, 'កំពុងរង់ចាំចាប់ផ្តើម...');
  showCard('upload');
}

function setProgress(pct, message) {
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = RING_CIRCUMFERENCE - (clamped / 100) * RING_CIRCUMFERENCE;
  els.progressRingFg.style.strokeDashoffset = offset;
  els.progressPercent.textContent = `${clamped}%`;
  if (message) els.progressMessage.textContent = message;
}

async function startDubbing(file) {
  showCard('progress');
  setProgress(0, 'កំពុងបញ្ជូនឯកសារ...');

  try {
    const jobId = await uploadFile(file);
    pollStatus(jobId);
  } catch (err) {
    showError(err.message || 'ការបញ្ជូនឯកសារបរាជ័យ');
  }
}

async function startDubbingFromUrl(url) {
  showCard('progress');
  setProgress(0, 'កំពុងទាញយកវីដេអូពី Link...');

  try {
    const formData = new FormData();
    formData.append('url', url);
    if (els.voiceSelect.value) {
      formData.append('voiceId', els.voiceSelect.value);
    }
    const res = await fetch('/api/dub/from-url', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'ទាញយកវីដេអូបរាជ័យ');
    pollStatus(data.jobId);
  } catch (err) {
    showError(err.message || 'ទាញយកវីដេអូបរាជ័យ');
  }
}

function uploadFile(file) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    if (els.voiceSelect.value) {
      formData.append('voiceId', els.voiceSelect.value);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/dub', true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const uploadPct = Math.round((e.loaded / e.total) * 100);
        // Upload counts for the first slice of the overall progress bar
        setProgress(Math.round(uploadPct * 0.05), `កំពុងបញ្ជូនឯកសារ... ${uploadPct}%`);
      }
    };

    xhr.onload = () => {
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch (e) {
        reject(new Error('ការឆ្លើយតបពី Server មិនត្រឹមត្រូវ'));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.jobId) {
        resolve(data.jobId);
      } else {
        reject(new Error(data.detail || 'ការបញ្ជូនឯកសារបរាជ័យ'));
      }
    };
    xhr.onerror = () => reject(new Error('មិនអាចភ្ជាប់ទៅ Server បានទេ'));
    xhr.send(formData);
  });
}

function pollStatus(jobId) {
  currentJobId = jobId;
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/status/${jobId}`);
      if (!res.ok) throw new Error('Job not found');
      const job = await res.json();

      setProgress(job.progress || 0, job.message);

      if (job.status === 'review') {
        clearInterval(pollTimer);
        showReview(job);
      } else if (job.status === 'done') {
        clearInterval(pollTimer);
        showResult(job);
      } else if (job.status === 'error') {
        clearInterval(pollTimer);
        showError(job.error || job.message || 'ដំណើរការបរាជ័យ');
      }
    } catch (err) {
      clearInterval(pollTimer);
      showError('បាត់ការតភ្ជាប់ជាមួយ Server ខណៈកំពុងដំណើរការ');
    }
  }, 1500);
}

// ----------------------------------------------------
// Review & edit step — shown after AI transcribes/translates each
// character's line, before any voice is actually generated. Lines are
// shown one at a time: text can be corrected, the character/voice can be
// reassigned, and a test-listen preview can be played before confirming.
// ----------------------------------------------------
let reviewSegments = [];
let reviewSpeakerOptions = [];
let reviewEdits = {}; // { [lineIndex]: { text, speakerId?, voiceId? } }
let reviewIndex = 0;

function showReview(job) {
  reviewSegments = job.segments || [];
  reviewSpeakerOptions = job.speakerOptions || [];
  reviewEdits = {};
  reviewIndex = 0;
  renderReviewLine();
  showCard('review');
}

function reviewSelectValueFor(index) {
  const edit = reviewEdits[index];
  if (edit && edit.voiceId) return `voice:${edit.voiceId}`;
  if (edit && edit.speakerId) return `char:${edit.speakerId}`;
  return 'orig';
}

function renderReviewLine() {
  const seg = reviewSegments[reviewIndex];
  if (!seg) return;

  els.reviewProgress.textContent = `ឃ្លាទី ${reviewIndex + 1} / ${reviewSegments.length} — 🗣️ ${seg.speakerName || 'តួអង្គ'}`;

  const edit = reviewEdits[reviewIndex];
  els.reviewTextArea.value = (edit && typeof edit.text === 'string') ? edit.text : (seg.text || '');

  let optionsHtml = `<option value="orig">🎯 ដូចដើម (AI បានកំណត់ — ${escapeHtml(seg.speakerName || '')})</option>`;
  if (reviewSpeakerOptions.length) {
    optionsHtml += `<optgroup label="តួអង្គដែលបានរកឃើញ">`;
    reviewSpeakerOptions.forEach((s) => {
      optionsHtml += `<option value="char:${s.speakerId}">🗣️ ${escapeHtml(s.speakerName)}</option>`;
    });
    optionsHtml += `</optgroup>`;
  }
  if (cachedVoices.length) {
    optionsHtml += `<optgroup label="សំឡេងគំរូដែលបានរក្សាទុក">`;
    cachedVoices.forEach((v) => {
      optionsHtml += `<option value="voice:${v.id}">🎙️ ${escapeHtml(v.label)}</option>`;
    });
    optionsHtml += `</optgroup>`;
  }
  els.reviewSpeakerSelect.innerHTML = optionsHtml;
  els.reviewSpeakerSelect.value = reviewSelectValueFor(reviewIndex);

  els.reviewPreviewPlayer.classList.add('hidden');
  els.reviewPreviewPlayer.removeAttribute('src');

  els.reviewPrevBtn.disabled = reviewIndex === 0;
  els.reviewNextBtn.disabled = reviewIndex === reviewSegments.length - 1;
}

function saveCurrentReviewLine() {
  const selectVal = els.reviewSpeakerSelect.value;
  const edit = { text: els.reviewTextArea.value };
  if (selectVal.startsWith('char:')) edit.speakerId = selectVal.slice(5);
  else if (selectVal.startsWith('voice:')) edit.voiceId = selectVal.slice(6);
  reviewEdits[reviewIndex] = edit;
}

els.reviewPrevBtn.addEventListener('click', () => {
  saveCurrentReviewLine();
  if (reviewIndex > 0) {
    reviewIndex -= 1;
    renderReviewLine();
  }
});

els.reviewNextBtn.addEventListener('click', () => {
  saveCurrentReviewLine();
  if (reviewIndex < reviewSegments.length - 1) {
    reviewIndex += 1;
    renderReviewLine();
  }
});

els.reviewTestBtn.addEventListener('click', async () => {
  saveCurrentReviewLine();
  const edit = reviewEdits[reviewIndex] || {};

  els.reviewTestBtn.disabled = true;
  els.reviewTestBtn.textContent = '⏳ កំពុងបង្កើតសំឡេង...';
  try {
    const res = await fetch('/api/preview-line', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: currentJobId,
        lineId: reviewIndex,
        text: edit.text,
        speakerId: edit.speakerId,
        voiceId: edit.voiceId,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'សាកល្បងស្តាប់បរាជ័យ');

    els.reviewPreviewPlayer.src = data.previewUrl;
    els.reviewPreviewPlayer.classList.remove('hidden');
    els.reviewPreviewPlayer.play().catch(() => {});
  } catch (err) {
    showToast(err.message || 'សាកល្បងស្តាប់បរាជ័យ', 'error');
  } finally {
    els.reviewTestBtn.disabled = false;
    els.reviewTestBtn.textContent = '▶️ ស្តាប់សាកល្បង';
  }
});

els.reviewCancelBtn.addEventListener('click', resetToUpload);

els.reviewConfirmBtn.addEventListener('click', async () => {
  if (!currentJobId) return;
  saveCurrentReviewLine();

  const edits = {};
  Object.keys(reviewEdits).forEach((idx) => {
    edits[idx] = reviewEdits[idx];
  });

  els.reviewConfirmBtn.disabled = true;
  try {
    const res = await fetch(`/api/confirm/${currentJobId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edits }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'បញ្ជាក់បរាជ័យ');

    showCard('progress');
    setProgress(50, 'កំពុងបង្កើតសំឡេងចុងក្រោយ...');
    pollStatus(currentJobId);
  } catch (err) {
    showToast(err.message || 'បញ្ជាក់បរាជ័យ', 'error');
  } finally {
    els.reviewConfirmBtn.disabled = false;
  }
});

function showResult(job) {
  els.mediaPreview.innerHTML = '';
  const el = document.createElement(job.mediaType === 'audio' ? 'audio' : 'video');
  el.src = job.outputUrl;
  el.controls = true;
  if (job.mediaType !== 'audio') el.setAttribute('playsinline', '');
  els.mediaPreview.appendChild(el);

  els.downloadBtn.href = job.outputUrl;
  els.downloadBtn.setAttribute('download', '');

  els.scriptBox.textContent = job.script || '(គ្មានអត្ថបទសម្តី)';
  els.scriptBox.classList.add('hidden');

  showCard('result');
  showToast('ដាប់សំឡេងខ្មែរជោគជ័យ! 🎉', 'success');
}

function showError(message) {
  els.errorMessage.textContent = message;
  showCard('error');
  showToast(message, 'error');
}

// ----------------------------------------------------
// Voice Library — add/list/delete reusable character voice samples
// ----------------------------------------------------
let cachedVoices = [];

async function loadVoices() {
  try {
    const res = await fetch('/api/voices');
    if (!res.ok) throw new Error('Failed to load voices');
    cachedVoices = await res.json();
    renderVoiceSelect();
    renderVoiceList();
  } catch (err) {
    console.error('loadVoices error:', err);
  }
}

function renderVoiceSelect() {
  const currentValue = els.voiceSelect.value;
  els.voiceSelect.innerHTML = '<option value="">🤖 ស្វ័យប្រវត្តិ (AI ជ្រើសរើសសំឡេងតួអង្គដោយខ្លួនឯង)</option>';
  cachedVoices.forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = `🎙️ ${v.label}`;
    els.voiceSelect.appendChild(opt);
  });
  if (cachedVoices.some((v) => v.id === currentValue)) {
    els.voiceSelect.value = currentValue;
  }

  const currentRecreateValue = els.recreateVoiceSelect.value || '__auto_female';
  els.recreateVoiceSelect.innerHTML = `
    <option value="__auto_female">🤖 សំឡេងស្រី ស្តង់ដារ (Neural)</option>
    <option value="__auto_male">🤖 សំឡេងប្រុស ស្តង់ដារ (Neural)</option>
  `;
  cachedVoices.forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = `🎙️ ${v.label}`;
    els.recreateVoiceSelect.appendChild(opt);
  });
  if (currentRecreateValue.startsWith('__auto_') || cachedVoices.some((v) => v.id === currentRecreateValue)) {
    els.recreateVoiceSelect.value = currentRecreateValue;
  }
}

function renderVoiceList() {
  els.voiceList.querySelectorAll('.voice-list-item').forEach((el) => el.remove());
  els.voiceListEmpty.classList.toggle('hidden', cachedVoices.length > 0);

  cachedVoices.forEach((v) => {
    const item = document.createElement('div');
    item.className = 'voice-list-item';
    item.innerHTML = `
      <span class="voice-list-item-label">${escapeHtml(v.label)}</span>
      <audio controls src="${v.url}"></audio>
      <button class="voice-list-item-delete" type="button" title="លុប" data-id="${v.id}">🗑️</button>
    `;
    item.querySelector('.voice-list-item-delete').addEventListener('click', () => deleteVoice(v.id));
    els.voiceList.appendChild(item);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function deleteVoice(voiceId) {
  try {
    const res = await fetch(`/api/voices/${voiceId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    showToast('បានលុបសំឡេងគំរូរួចរាល់', 'info');
    await loadVoices();
  } catch (err) {
    showToast('លុបសំឡេងគំរូបរាជ័យ', 'error');
  }
}

els.openVoiceLibBtn.addEventListener('click', () => {
  els.voiceLibModal.classList.remove('hidden');
  loadVoices();
});
els.closeVoiceLibBtn.addEventListener('click', () => {
  els.voiceLibModal.classList.add('hidden');
});
els.voiceLibModal.addEventListener('click', (e) => {
  if (e.target === els.voiceLibModal) els.voiceLibModal.classList.add('hidden');
});

els.newVoiceFile.addEventListener('change', () => {
  const file = els.newVoiceFile.files && els.newVoiceFile.files[0];
  els.newVoiceFilename.textContent = file ? file.name : 'មិនទាន់ជ្រើសរើសទេ';
});

els.addVoiceForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const label = els.newVoiceLabel.value.trim();
  const file = els.newVoiceFile.files && els.newVoiceFile.files[0];
  if (!label) {
    showToast('សូមបញ្ចូលឈ្មោះតួអង្គជាមុនសិន', 'warning');
    return;
  }
  if (!file) {
    showToast('សូមជ្រើសរើសឯកសារសំឡេងជាមុនសិន', 'warning');
    return;
  }

  const formData = new FormData();
  formData.append('label', label);
  formData.append('file', file);

  const submitBtn = els.addVoiceForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const res = await fetch('/api/voices', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'បន្ថែមសំឡេងគំរូបរាជ័យ');

    showToast(`បានបន្ថែមសំឡេងគំរូ "${data.label}" ជោគជ័យ!`, 'success');
    els.addVoiceForm.reset();
    els.newVoiceFilename.textContent = 'មិនទាន់ជ្រើសរើសទេ';
    await loadVoices();
  } catch (err) {
    showToast(err.message || 'បន្ថែមសំឡេងគំរូបរាជ័យ', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

// Populate the dropdown on the main upload card as soon as the page loads
loadVoices();

// ----------------------------------------------------
// Mode switcher — Auto AI dubbing vs. Replace with My Own Voice
// ----------------------------------------------------
function setMode(mode) {
  els.modeTabAuto.classList.toggle('active', mode === 'auto');
  els.modeTabMyVoice.classList.toggle('active', mode === 'myvoice');
  els.modeTabRecreate.classList.toggle('active', mode === 'recreate');
  els.autoModeSection.classList.toggle('hidden', mode !== 'auto');
  els.myVoiceModeSection.classList.toggle('hidden', mode !== 'myvoice');
  els.recreateModeSection.classList.toggle('hidden', mode !== 'recreate');
}
els.modeTabAuto.addEventListener('click', () => setMode('auto'));
els.modeTabMyVoice.addEventListener('click', () => setMode('myvoice'));
els.modeTabRecreate.addEventListener('click', () => setMode('recreate'));

els.openVoiceLibBtnRecreate.addEventListener('click', () => {
  els.voiceLibModal.classList.remove('hidden');
  loadVoices();
});

// ----------------------------------------------------
// "My Own Voice" redub flow — clean + master a user's own recording,
// then mix it into their video in place of the original speech.
// ----------------------------------------------------
let myVoiceVideoFile = null;
let myVoiceAudioFile = null;

function updateMyVoiceStartBtn() {
  els.myVoiceStartBtn.disabled = !(myVoiceVideoFile && myVoiceAudioFile);
}

function wireDropzone(dropzone, input, onPick) {
  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });
  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) onPick(file);
  });
  input.addEventListener('change', () => {
    if (input.files && input.files[0]) onPick(input.files[0]);
  });
}

wireDropzone(els.myVoiceVideoDropzone, els.myVoiceVideoInput, (file) => {
  myVoiceVideoFile = file;
  els.myVoiceVideoText.textContent = `✅ ${file.name}`;
  updateMyVoiceStartBtn();
});

wireDropzone(els.myVoiceAudioDropzone, els.myVoiceAudioInput, (file) => {
  myVoiceAudioFile = file;
  els.myVoiceAudioText.textContent = `✅ ${file.name}`;
  updateMyVoiceStartBtn();
});

els.myVoiceStartBtn.addEventListener('click', () => {
  if (!myVoiceVideoFile || !myVoiceAudioFile) return;
  startVoiceRedub(myVoiceVideoFile, myVoiceAudioFile);
});

async function startVoiceRedub(videoFile, audioFile) {
  showCard('progress');
  setProgress(0, 'កំពុងបញ្ជូនឯកសារ...');

  try {
    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('voice', audioFile);

    const jobId = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/redub', true);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const uploadPct = Math.round((e.loaded / e.total) * 100);
          setProgress(Math.round(uploadPct * 0.05), `កំពុងបញ្ជូនឯកសារ... ${uploadPct}%`);
        }
      };
      xhr.onload = () => {
        let data;
        try {
          data = JSON.parse(xhr.responseText);
        } catch (e) {
          reject(new Error('ការឆ្លើយតបពី Server មិនត្រឹមត្រូវ'));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300 && data.jobId) {
          resolve(data.jobId);
        } else {
          reject(new Error(data.detail || 'ការបញ្ជូនឯកសារបរាជ័យ'));
        }
      };
      xhr.onerror = () => reject(new Error('មិនអាចភ្ជាប់ទៅ Server បានទេ'));
      xhr.send(formData);
    });

    pollStatus(jobId);
  } catch (err) {
    showError(err.message || 'ការបញ្ជូនឯកសារបរាជ័យ');
  }
}

// ----------------------------------------------------
// "Recreate Voice" flow — re-synthesize an already-correct Khmer narration
// with a chosen (nicer / different) voice, keeping the same wording and
// timing, then mix it back onto the video's original background music.
// ----------------------------------------------------
let recreateVideoFile = null;
let recreateAudioFile = null;

function updateRecreateStartBtn() {
  els.recreateStartBtn.disabled = !(recreateVideoFile && recreateAudioFile);
}

wireDropzone(els.recreateVideoDropzone, els.recreateVideoInput, (file) => {
  recreateVideoFile = file;
  els.recreateVideoText.textContent = `✅ ${file.name}`;
  updateRecreateStartBtn();
});

wireDropzone(els.recreateAudioDropzone, els.recreateAudioInput, (file) => {
  recreateAudioFile = file;
  els.recreateAudioText.textContent = `✅ ${file.name}`;
  updateRecreateStartBtn();
});

els.recreateStartBtn.addEventListener('click', () => {
  if (!recreateVideoFile || !recreateAudioFile) return;
  startRecreateVoice(recreateVideoFile, recreateAudioFile);
});

async function startRecreateVoice(videoFile, audioFile) {
  showCard('progress');
  setProgress(0, 'កំពុងបញ្ជូនឯកសារ...');

  try {
    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('voice', audioFile);
    const selectVal = els.recreateVoiceSelect.value || '__auto_female';
    if (selectVal.startsWith('__auto_')) {
      formData.append('gender', selectVal === '__auto_male' ? 'male' : 'female');
    } else {
      formData.append('voiceId', selectVal);
    }

    const jobId = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/recreate-voice', true);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const uploadPct = Math.round((e.loaded / e.total) * 100);
          setProgress(Math.round(uploadPct * 0.05), `កំពុងបញ្ជូនឯកសារ... ${uploadPct}%`);
        }
      };
      xhr.onload = () => {
        let data;
        try {
          data = JSON.parse(xhr.responseText);
        } catch (e) {
          reject(new Error('ការឆ្លើយតបពី Server មិនត្រឹមត្រូវ'));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300 && data.jobId) {
          resolve(data.jobId);
        } else {
          reject(new Error(data.detail || 'ការបញ្ជូនឯកសារបរាជ័យ'));
        }
      };
      xhr.onerror = () => reject(new Error('មិនអាចភ្ជាប់ទៅ Server បានទេ'));
      xhr.send(formData);
    });

    pollStatus(jobId);
  } catch (err) {
    showError(err.message || 'ការបញ្ជូនឯកសារបរាជ័យ');
  }
}
