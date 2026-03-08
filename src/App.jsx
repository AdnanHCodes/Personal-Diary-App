import { useState } from "react";
import "./App.css";

function App() {
  const [entry, setEntry] = useState("");
  const [entries, setEntries] = useState([]);

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
      content: entry,
    };
    setEntries([newEntry, ...entries]);
    setEntry("");
  };

  return (
    <div className="app">
      <header className="header">
        <h1>My Personal Diary</h1>
        <p>{new Date().toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}</p>
      </header>

      <main className="input-section">
        <textarea
          className="entry-input"
          placeholder="Write about your day..."
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
        />
        <button className="save-button" onClick={saveEntry}>
          Save Entry
        </button>
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