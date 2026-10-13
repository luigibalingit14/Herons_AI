import os
from flask import Flask, jsonify, request

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024

@app.post("/transcribe")
def transcribe():
    payload = request.get_json(silent=True) or {}
    if payload.get("input_type") != "url" or not isinstance(payload.get("url"), str):
        return jsonify(error="A public URL is required."), 400
    try:
        import whisper
        import yt_dlp
        model_name = payload.get("model", os.getenv("TRANSCRIBER_MODEL", "tiny"))
        options = {"quiet": True, "no_warnings": True, "format": "bestaudio/best", "outtmpl": "/tmp/herons-%(id)s.%(ext)s"}
        with yt_dlp.YoutubeDL(options) as downloader:
            info = downloader.extract_info(payload["url"], download=True)
            path = downloader.prepare_filename(info)
        result = whisper.load_model(model_name).transcribe(path, language=payload.get("language"))
        return jsonify(text=result["text"].strip(), title=info.get("title", "Video transcript"), language=result.get("language"), source="whisper")
    except Exception as exc:
        return jsonify(error=f"Transcription failed: {exc}"), 422

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
