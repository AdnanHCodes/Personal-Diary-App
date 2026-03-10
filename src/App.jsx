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
  const [expandedEntry, setExpandedEntry] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);
  const [showEntries, setShowEntries] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [confirmAction, setConfirmAction] = useState(null);

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

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPreview = (text, length = 40) => {
    return text.length > length ? text.substring(0, length) + "..." : text;
  };

  const saveEntry = async () => {
    if (entry.trim() === "") return;
    setConfirmAction({
      message: "Are you sure you want to save this diary entry?",
      onConfirm: async () => {
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
        setConfirmAction(null);
      },
      onCancel: () => setConfirmAction(null),
    });
  };

  const saveTask = async () => {
    if (taskTitle.trim() === "" || taskDueAt === "") return;
    setConfirmAction({
      message: "Are you sure you want to add this task?",
      onConfirm: async () => {
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
        setConfirmAction(null);
      },
      onCancel: () => setConfirmAction(null),
    });
  };

  const deleteTask = (id) => {
    setConfirmAction({
      message: "Are you sure you want to delete this task?",
      onConfirm: async () => {
        await supabase.from("tasks").delete().eq("id", id);
        setTasks(tasks.filter((t) => t.id !== id));
        setConfirmAction(null);
      },
      onCancel: () => setConfirmAction(null),
    });
  };

  const deleteEntry = (id) => {
    setConfirmAction({
      message: "Are you sure you want to delete this diary entry?",
      onConfirm: async () => {
        await supabase.from("entries").delete().eq("id", id);
        setEntries(entries.filter((e) => e.id !== id));
        setConfirmAction(null);
      },
      onCancel: () => setConfirmAction(null),
    });
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

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="modal-overlay">
          <div className="modal">
            <p className="modal-message">{confirmAction.message}</p>
            <div className="modal-buttons">
              <button className="modal-confirm" onClick={confirmAction.onConfirm}>
                Yes, confirm
              </button>
              <button className="modal-cancel" onClick={confirmAction.onCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>📔 My Diary</h1>
          <p className="sidebar-date">
            {new Date().toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Entries List */}
        <div className="sidebar-section">
          <button
            className="sidebar-section-toggle"
            onClick={() => setShowEntries(!showEntries)}
          >
            <span>📝 Diary Entries</span>
            <span>{showEntries ? "▲" : "▼"}</span>
          </button>
          {showEntries && (
            <div className="sidebar-list">
              {loading ? (
                <p className="sidebar-empty">Loading...</p>
              ) : entries.length === 0 ? (
                <p className="sidebar-empty">No entries yet.</p>
              ) : (
                entries.map((e) => (
                  <div
                    key={e.id}
                    className={`sidebar-item ${expandedEntry === e.id ? "active" : ""}`}
                  >
                    <div
                      className="sidebar-item-header"
                      onClick={() =>
                        setExpandedEntry(expandedEntry === e.id ? null : e.id)
                      }
                    >
                      <p className="sidebar-item-date">{formatDateTime(e.created_at)}</p>
                      <p className="sidebar-item-preview">{getPreview(e.content)}</p>
                    </div>
                    {expandedEntry === e.id && (
                      <div className="sidebar-item-expanded">
                        <p className="sidebar-item-content">{e.content}</p>
                        <button
                          className="sidebar-delete"
                          onClick={() => deleteEntry(e.id)}
                        >
                          🗑 Delete Entry
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Tasks List */}
        <div className="sidebar-section">
          <button
            className="sidebar-section-toggle"
            onClick={() => setShowTasks(!showTasks)}
          >
            <span>📌 Upcoming Tasks</span>
            <span>{showTasks ? "▲" : "▼"}</span>
          </button>
          {showTasks && (
            <div className="sidebar-list">
              {tasks.length === 0 ? (
                <p className="sidebar-empty">No tasks yet.</p>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`sidebar-item ${expandedTask === task.id ? "active" : ""}`}
                  >
                    <div
                      className="sidebar-item-header"
                      onClick={() =>
                        setExpandedTask(expandedTask === task.id ? null : task.id)
                      }
                    >
                      <p className="sidebar-item-date">{formatDateTime(task.due_at)}</p>
                      <p className="sidebar-item-preview">{getPreview(task.title)}</p>
                    </div>
                    {expandedTask === task.id && (
                      <div className="sidebar-item-expanded">
                        <p className="sidebar-item-content">{task.title}</p>
                        <button
                          className="sidebar-delete"
                          onClick={() => deleteTask(task.id)}
                        >
                          🗑 Delete Task
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="main-header">
          <h2>Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 18 ? "Afternoon" : "Evening"} 👋</h2>
          <p className="main-date">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </header>

        {/* New Diary Entry */}
        <section className="card">
          <h3>Today's Entry</h3>
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
        </section>

        {/* New Task */}
        <section className="card">
          <h3>Add a Task</h3>
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
        </section>
      </main>
    </div>
  );
}

export default App;