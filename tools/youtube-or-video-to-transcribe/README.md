# Herons.AI transcription service

Install FFmpeg, create a virtual environment, then run:

```powershell
python -m pip install -r requirements.txt
python app.py
```

The service exposes `POST http://127.0.0.1:5000/transcribe` with
`{"input_type":"url","url":"https://..."}`.
