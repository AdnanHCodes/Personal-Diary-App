import { useState } from "react";
import "./App.css";

function App() {
  const [entry, setEntry] = useState("");
  const [entries, setEntries] = useState([]);
  const [isListening, setIsListening] = useState(false);

  const applyPunctuation = (text) => {
    let result = text
      .replace(/\bcomma\b/gi, ",")
      .replace(/\bperiod\b/gi, ".")
      .replace(/\bfull stop\b/gi, ".")
      .replace(/\bquestion mark\b/gi, "?")
      .replace(/\bexclamation mark\b/gi, "!")
      .replace(/\bnew line\b/gi, "\n")
      .replace(/\bcolon\b/gi, ":")
      .replace(/\bsemicolon\b/gi, ";");

    // Remove space before punctuation marks
    result = result.replace(/\s([.,!?:;])/g, "$1");

    // Auto capitalise first letter of each sentence
    result = result.replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase());

    // Add period at end if missing
    result = result.trim();
    if (result && !/[.!?]$/.test(result)) {
      result += ".";
    }

    return result;
  };

  const saveEntry = () => {
    if (entry.trim() === "") return;
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      content: applyPunctuation(entry),
    };
    setEntries([newEntry, ...entries]);
    setEntry("");
  };

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Your browser does not support voice input. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setEntry(transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
    window._recognition = recognition;
  };

  const stopListening = () => {
    if (window._recognition) {
      window._recognition.stop();
    }
    setIsListening(false);
  };

  return (
    <div className="app">
      <header className="header">
        <h1>My Personal Diary</h1>
        <p>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </header>

      <main className="input-section">
        <textarea
          className="entry-input"
          placeholder="Write about your day or press the microphone to speak..."
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
        />
        <div className="voice-hints">
          <span>Voice commands:</span>
          <code>comma</code>
          <code>period</code>
          <code>question mark</code>
          <code>exclamation mark</code>
          <code>new line</code>
        </div>
        <div className="button-group">
          <button
            className={`mic-button ${isListening ? "listening" : ""}`}
            onClick={isListening ? stopListening : startListening}
          >
            {isListening ? "⏹ Stop" : "🎤 Speak"}
          </button>
          <button className="save-button" onClick={saveEntry}>
            Save Entry
          </button>
        </div>
      </main>

      <section className="entries-list">
        <h2>Past Entries</h2>
        {entries.length === 0 ? (
          <p className="no-entries">No entries yet. Start writing!</p>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="entry-card">
              <p className="entry-date">{e.date}</p>
              <p className="entry-content">{e.content}</p>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

export default App;