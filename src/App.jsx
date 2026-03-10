import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import "./App.css";

function App() {
  const [entry, setEntry] = useState("");
  const [entries, setEntries] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isListeningTask, setIsListeningTask] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");

  useEffect(() => {
    loadEntries();
    loadTasks();
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      checkNotifications();
    }, 60000);
    return () => clearInterval(interval);
  }, [tasks]);

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      await Notification.requestPermission();
    }
  };

  const checkNotifications = async () => {
    const now = new Date();
    tasks.forEach(async (task) => {
      if (task.notified) return;
      const dueAt = new Date(task.due_at);
      const diffMinutes = (dueAt - now) / 60000;
      if (diffMinutes <= 30 && diffMinutes > 0) {
        if (Notification.permission === "granted") {
          new Notification("Upcoming Task Reminder", {
            body: `"${task.title}" is due in ${Math.round(diffMinutes)} minutes.`,
          });
          await supabase
            .from("tasks")
            .update({ notified: true })
            .eq("id", task.id);
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id ? { ...t, notified: true } : t
            )
          );
        }
      }
    });
  };

  const loadEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("entries")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error loading entries:", error);
    } else {
      setEntries(data);
    }
    setLoading(false);
  };

  const loadTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("due_at", { ascending: true });
    if (error) {
      console.error("Error loading tasks:", error);
    } else {
      setTasks(data);
    }
  };

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
    result = result.replace(/\s([.,!?:;])/g, "$1");
    result = result.replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase());
    result = result.trim();
    if (result && !/[.!?]$/.test(result)) {
      result += ".";
    }
    return result;
  };

  const saveEntry = async () => {
    if (entry.trim() === "") return;
    const cleanedEntry = applyPunctuation(entry);
    const { data, error } = await supabase
      .from("entries")
      .insert([{ content: cleanedEntry }])
      .select();
    if (error) {
      console.error("Error saving entry:", error);
      alert("Failed to save entry. Please try again.");
    } else {
      setEntries([data[0], ...entries]);
      setEntry("");
    }
  };

  const saveTask = async () => {
    if (taskTitle.trim() === "" || taskDueAt === "") return;
    const { data, error } = await supabase
      .from("tasks")
      .insert([{ title: taskTitle, due_at: taskDueAt }])
      .select();
    if (error) {
      console.error("Error saving task:", error);
      alert("Failed to save task. Please try again.");
    } else {
      setTasks([...tasks, data[0]].sort(
        (a, b) => new Date(a.due_at) - new Date(b.due_at)
      ));
      setTaskTitle("");
      setTaskDueAt("");
    }
  };

  const deleteTask = async (id) => {
    await supabase.from("tasks").delete().eq("id", id);
    setTasks(tasks.filter((t) => t.id !== id));
  };

  const startListening = (setter, setListening) => {
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
    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setter(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.start();
    window._recognition = recognition;
  };

  const stopListening = (setListening) => {
    if (window._recognition) {
      window._recognition.stop();
    }
    setListening(false);
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
        <h2>Today's Entry</h2>
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
            onClick={() =>
              isListening
                ? stopListening(setIsListening)
                : startListening(setEntry, setIsListening)
            }
          >
            {isListening ? "⏹ Stop" : "🎤 Speak"}
          </button>
          <button className="save-button" onClick={saveEntry}>
            Save Entry
          </button>
        </div>
      </main>

      <section className="tasks-section">
        <h2>Upcoming Tasks</h2>
        <div className="task-input-group">
          <div className="task-title-row">
            <input
              type="text"
              className="task-input"
              placeholder="Task title..."
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
            <button
              className={`mic-button small ${isListeningTask ? "listening" : ""}`}
              onClick={() =>
                isListeningTask
                  ? stopListening(setIsListeningTask)
                  : startListening(setTaskTitle, setIsListeningTask)
              }
            >
              {isListeningTask ? "⏹" : "🎤"}
            </button>
          </div>
          <input
            type="datetime-local"
            className="task-date-input"
            value={taskDueAt}
            onChange={(e) => setTaskDueAt(e.target.value)}
          />
          <button className="save-button" onClick={saveTask}>
            Add Task
          </button>
        </div>

        {tasks.length === 0 ? (
          <p className="no-entries">No upcoming tasks. Add one above!</p>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="task-card">
              <div className="task-info">
                <p className="task-title">{task.title}</p>
                <p className="task-due">
                  {new Date(task.due_at).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <button
                className="delete-button"
                onClick={() => deleteTask(task.id)}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </section>

      <section className="entries-list">
        <h2>Past Entries</h2>
        {loading ? (
          <p className="no-entries">Loading entries...</p>
        ) : entries.length === 0 ? (
          <p className="no-entries">No entries yet. Start writing!</p>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="entry-card">
              <p className="entry-date">
                {new Date(e.created_at).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <p className="entry-content">{e.content}</p>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

export default App;