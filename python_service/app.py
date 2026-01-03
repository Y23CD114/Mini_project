from flask import Flask, request, jsonify
import re

app = Flask(__name__)

BAD_SUBJECTS = [
    "it", "this", "there", "these", "those", "they", "which",
    "debasis", "samanta", "iit", "kharagpur", "applications"
]

def clean_text(text):
    text = re.sub(r'\S+@\S+', '', text)        # remove emails
    text = re.sub(r'\d{2}\.\d{2}\.\d{4}', '', text)  # remove dates
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def split_sentences(text):
    return re.split(r'\.\s+', text)

def extract_subject(sentence):
    match = re.match(r"^(.*?)\s+(is|are)\s+", sentence, re.IGNORECASE)
    if not match:
        return None

    subject = match.group(1).strip()
    subject = re.sub(r"^(a|an|the)\s+", "", subject, flags=re.IGNORECASE)

    if len(subject) < 6:
        return None

    if any(bad in subject.lower() for bad in BAD_SUBJECTS):
        return None

    return subject

def generate_flashcards(text, start=0, limit=5):
    text = clean_text(text)
    sentences = split_sentences(text)
    flashcards = []

    for i in range(start, len(sentences)):
        s = sentences[i].strip()

        if len(s) < 80:
            continue

        subject = extract_subject(s)
        if not subject:
            continue

        answer = s
        if not answer.endswith("."):
            answer += "."

        flashcards.append({
            "question": f"What is {subject}?",
            "answer": answer
        })

        if len(flashcards) == limit:
            return flashcards, i + 1

    return flashcards, len(sentences)

@app.route("/generate", methods=["POST"])
def generate():
    data = request.json
    text = data.get("text", "")
    start = data.get("start", 0)

    flashcards, next_index = generate_flashcards(text, start)

    return jsonify({
        "flashcards": flashcards,
        "nextIndex": next_index
    })

if __name__ == "__main__":
    app.run(port=8000)
