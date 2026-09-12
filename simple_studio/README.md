# KhmerDub AI (Simple)

កម្មវិធីតូចមួយ ដាច់ដោយឡែកពី Studio ចម្បង (`server.py` / `public/`) — សម្រាប់អ្នកដែលចង់បាន
លំហូរការងារ**សាមញ្ញបំផុត**៖ បញ្ចូលឯកសារវីដេអូ ឬសំឡេងមួយ → ចាំមួយភ្លែត → ទាញយកលទ្ធផលដែលមានសំឡេងខ្មែរ។

**គ្មាន** Login, Premium tier, Colab/Cloud setup, ឬ Manual timeline editing។ គ្រាន់តែ Upload
ហើយ AI ធ្វើការទាំងអស់ដោយស្វ័យប្រវត្តិ៖ ស្គាល់សំឡេង → បកប្រែជាភាសាខ្មែរ → ក្លូនសំឡេងតួអង្គ (ជាមួយ
ទឹកដមធម្មជាតិ) → លាយជាមួយភ្លេងដើម → នាំចេញឯកសារចុងក្រោយ។

## របៀបប្រើ

កម្មវិធីនេះប្រើ Python environment និង FFmpeg ដូចគ្នានឹង Studio ចម្បង ដូច្នេះត្រូវរត់ setup
របស់ Studio ចម្បង (`run.bat` លើ Windows ឬ `install_mac.sh` លើ Mac) **យ៉ាងហោចណាស់ម្តង** ជាមុនសិន
ដើម្បីឱ្យ `.venv` និង FFmpeg ត្រូវបានដំឡើង។

បន្ទាប់មក៖

- **Windows:** ចុច `simple_studio\run.bat`
- **Mac / Linux:** រត់ `simple_studio/run.sh`

បើក Browser ទៅកាន់ **http://localhost:4000**

## ការកំណត់ (Optional)

កម្មវិធីនេះអានឯកសារ `.env` ដូចគ្នានឹង Studio ចម្បង (នៅ root នៃ Project)៖

- `GEMINI_API_KEY` — ចាំបាច់ សម្រាប់ការស្គាល់សំឡេង + បកប្រែខ្មែរ (Speech-to-text & translation)
- `VOXCPM_API_URL` — Optional៖ បើកំណត់ នឹងប្រើ VoxCPM2 Zero-Shot Voice Cloning (គុណភាពខ្ពស់ជាង)។
  បើមិនកំណត់ ប្រព័ន្ធនឹងប្រើ Khmer Neural TTS ក្នុងតំបន់ ជាមួយកម្មវិធីកែលម្អទឹកដមធម្មជាតិស្រាប់។

## ថតឯកសារ

- `data/uploads/` — ឯកសារដើមដែល Upload ចូល (លុបបានដោយសុវត្ថិភាពនៅពេលណាក៏បាន)
- `data/outputs/` — លទ្ធផលចុងក្រោយ តាម Job ID នីមួយៗ
