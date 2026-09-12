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

els.newFileBtn.addEventListener('click', resetToUpload);
els.retryBtn.addEventListener('click', resetToUpload);

els.scriptToggleBtn.addEventListener('click', () => {
  els.scriptBox.classList.toggle('hidden');
});

function resetToUpload() {
  clearInterval(pollTimer);
  selectedFile = null;
  els.fileInput.value = '';
  els.filePicked.classList.add('hidden');
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

function uploadFile(file) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);

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
