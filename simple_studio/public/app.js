const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

const els = {
  uploadCard: document.getElementById('uploadCard'),
  progressCard: document.getElementById('progressCard'),
  resultCard: document.getElementById('resultCard'),
  errorCard: document.getElementById('errorCard'),

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
  autoModeSection: document.getElementById('autoModeSection'),
  myVoiceModeSection: document.getElementById('myVoiceModeSection'),

  myVoiceVideoDropzone: document.getElementById('myVoiceVideoDropzone'),
  myVoiceVideoInput: document.getElementById('myVoiceVideoInput'),
  myVoiceVideoText: document.getElementById('myVoiceVideoText'),
  myVoiceAudioDropzone: document.getElementById('myVoiceAudioDropzone'),
  myVoiceAudioInput: document.getElementById('myVoiceAudioInput'),
  myVoiceAudioText: document.getElementById('myVoiceAudioText'),
  myVoiceStartBtn: document.getElementById('myVoiceStartBtn'),

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
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/status/${jobId}`);
      if (!res.ok) throw new Error('Job not found');
      const job = await res.json();

      setProgress(job.progress || 0, job.message);

      if (job.status === 'done') {
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
  const isMyVoice = mode === 'myvoice';
  els.modeTabAuto.classList.toggle('active', !isMyVoice);
  els.modeTabMyVoice.classList.toggle('active', isMyVoice);
  els.autoModeSection.classList.toggle('hidden', isMyVoice);
  els.myVoiceModeSection.classList.toggle('hidden', !isMyVoice);
}
els.modeTabAuto.addEventListener('click', () => setMode('auto'));
els.modeTabMyVoice.addEventListener('click', () => setMode('myvoice'));

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
