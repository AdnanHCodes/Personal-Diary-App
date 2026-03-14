import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import "./App.css";

function App() {
  const [entry, setEntry] = useState("");
  const [entries, setEntries] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isListeningTask, setIsListeningTask] = useState(false);
  const [activeTab, setActiveTab] = useState("entry");
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [showEntries, setShowEntries] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [centerView, setCenterView] = useState("new");
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);

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

  const getTodayEntries = () => {
    const today = new Date();
    return entries.filter((e) => {
      const entryDate = new Date(e.created_at);
      return (
        entryDate.getDate() === today.getDate() &&
        entryDate.getMonth() === today.getMonth() &&
        entryDate.getFullYear() === today.getFullYear()
      );
    });
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

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPreview = (text, length = 35) => {
    return text.length > length ? text.substring(0, length) + "..." : text;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const openItem = (item, type) => {
    setSelectedItem(item);
    setSelectedType(type);
    setEditContent(type === "entry" ? item.content : item.title);
    setIsEditing(false);
    setCenterView("view");
  };

  const closeItem = () => {
    setSelectedItem(null);
    setSelectedType(null);
    setEditContent("");
    setIsEditing(false);
    setCenterView("new");
  };

  const saveEdit = async () => {
    if (editContent.trim() === "") return;
    setConfirmAction({
      message: "Are you sure you want to save your changes?",
      onConfirm: async () => {
        if (selectedType === "entry") {
          const cleaned = applyPunctuation(editContent);
          const { error } = await supabase
            .from("entries")
            .update({ content: cleaned })
            .eq("id", selectedItem.id);
          if (!error) {
            setEntries(entries.map((e) =>
              e.id === selectedItem.id ? { ...e, content: cleaned } : e
            ));
            setSelectedItem({ ...selectedItem, content: cleaned });
            setEditContent(cleaned);
          }
        } else {
          const { error } = await supabase
            .from("tasks")
            .update({ title: editContent })
            .eq("id", selectedItem.id);
          if (!error) {
            setTasks(tasks.map((t) =>
              t.id === selectedItem.id ? { ...t, title: editContent } : t
            ));
            setSelectedItem({ ...selectedItem, title: editContent });
          }
        }
        setIsEditing(false);
        setConfirmAction(null);
      },
      onCancel: () => setConfirmAction(null),
    });
  };

  const deleteItem = () => {
    setConfirmAction({
      message: `Are you sure you want to delete this ${selectedType === "entry" ? "diary entry" : "task"}?`,
      onConfirm: async () => {
        if (selectedType === "entry") {
          await supabase.from("entries").delete().eq("id", selectedItem.id);
          setEntries(entries.filter((e) => e.id !== selectedItem.id));
        } else {
          await supabase.from("tasks").delete().eq("id", selectedItem.id);
          setTasks(tasks.filter((t) => t.id !== selectedItem.id));
        }
        closeItem();
        setConfirmAction(null);
      },
      onCancel: () => setConfirmAction(null),
    });
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

  const todayEntries = getTodayEntries();

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
{/* Sidebar */}
<aside className={`sidebar ${sidebarOpen ? "sidebar-expanded" : "sidebar-collapsed"}`}>

  {/* Icon bar — always rendered, visible when collapsed */}
  {!sidebarOpen && (
    <div className="sidebar-icon-bar">
      <div className="sidebar-icon" title="My Diary" onClick={() => setSidebarOpen(true)}>📔</div>
      <div className="sidebar-icon" title="New Entry" onClick={() => { setSidebarOpen(true); closeItem(); }}>➕</div>
      <div className="sidebar-icon" title="Diary Entries" onClick={() => { setSidebarOpen(true); setShowEntries(true); }}>📝</div>
      <div className="sidebar-icon" title="Upcoming Tasks" onClick={() => { setSidebarOpen(true); setShowTasks(true); }}>📌</div>
    </div>
  )}

  {/* Full content — always rendered, visible when expanded */}
  {sidebarOpen && (
    <div className="sidebar-full-content">
      <div className="sidebar-header">
        <h1>📔 My Diary</h1>
        <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>✕</button>
      </div>

      <div className="sidebar-scrollable">
        <div className="sidebar-new-entry">
          <button className="new-entry-button" onClick={closeItem}>
            + New Entry
          </button>
        </div>

        <div className="sidebar-section">
          <button
            className="sidebar-section-toggle"
            onClick={() => setShowEntries(!showEntries)}
          >
            <span>📝 Diary Entries</span>
            <span>{showEntries ? "▲" : "▼"}</span>
          </button>
          <div className={`sidebar-accordion ${showEntries ? "accordion-open" : ""}`}>
            <div className="sidebar-list">
              {loading ? (
                <p className="sidebar-empty">Loading...</p>
              ) : entries.length === 0 ? (
                <p className="sidebar-empty">No entries yet.</p>
              ) : (
                entries.map((e) => (
                  <div
                    key={e.id}
                    className={`sidebar-item ${selectedItem?.id === e.id ? "active" : ""}`}
                    onClick={() => openItem(e, "entry")}
                  >
                    <p className="sidebar-item-date">{formatDateTime(e.created_at)}</p>
                    <p className="sidebar-item-preview">{getPreview(e.content)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="sidebar-section">
          <button
            className="sidebar-section-toggle"
            onClick={() => setShowTasks(!showTasks)}
          >
            <span>📌 Upcoming Tasks</span>
            <span>{showTasks ? "▲" : "▼"}</span>
          </button>
          <div className={`sidebar-accordion ${showTasks ? "accordion-open" : ""}`}>
            <div className="sidebar-list">
              {tasks.length === 0 ? (
                <p className="sidebar-empty">No tasks yet.</p>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`sidebar-item ${selectedItem?.id === task.id ? "active" : ""}`}
                    onClick={() => openItem(task, "task")}
                  >
                    <p className="sidebar-item-date">{formatDateTime(task.due_at)}</p>
                    <p className="sidebar-item-preview">{getPreview(task.title)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )}
</aside>

      {/* Main Content */}
      <main className="main-content">

        {centerView === "new" && (
          <>
            <header className="main-header">
              <h2>{getGreeting()} 👋</h2>
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

         {/* Tabbed Input Section */}
<div className="tab-card">
  <div className="tab-bar">
    <button
      className={`tab-button ${activeTab === "entry" ? "tab-active" : ""}`}
      onClick={() => setActiveTab("entry")}
    >
      📝 Today's Entry
    </button>
    <button
      className={`tab-button ${activeTab === "task" ? "tab-active" : ""}`}
      onClick={() => setActiveTab("task")}
    >
      📌 Add a Task
    </button>
  </div>

  {activeTab === "entry" && (
    <div className="tab-content">
      <textarea
        className="entry-input"
        placeholder="Write about your day or press the microphone to speak..."
        value={entry}
        onChange={(e) => setEntry(e.target.value)}
      />
      
<div className="hints-and-buttons">
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
</div>

    </div>
  )}

  {activeTab === "task" && (
    <div className="tab-content">
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
  )}
</div>

            {/* Today's Entries List */}
            {/* Bottom Two Column Row */}
<div className="bottom-row">

{/* Today's Entries List */}
<section className="today-entries">
  <h3 className="today-entries-heading">
    📅 Today's Entries
    <span className="today-count">{todayEntries.length}</span>
  </h3>
  {todayEntries.length === 0 ? (
    <p className="no-today-entries">
      No entries yet today. Start writing above.
    </p>
  ) : (
    todayEntries.map((e) => (
      <div
        key={e.id}
        className="today-entry-card"
        onClick={() => openItem(e, "entry")}
      >
        <p className="today-entry-time">{formatTime(e.created_at)}</p>
        <p className="today-entry-content">{e.content}</p>
      </div>
    ))
  )}
</section>

{/* Upcoming Tasks List */}
<section className="today-entries">
  <h3 className="today-entries-heading">
    📌 Upcoming Tasks
    <span className="today-count">{tasks.length}</span>
  </h3>
  {tasks.length === 0 ? (
    <p className="no-today-entries">
      No upcoming tasks. Add one above.
    </p>
  ) : (
    tasks.map((task) => (
      <div
        key={task.id}
        className="today-entry-card"
        onClick={() => openItem(task, "task")}
      >
        <p className="today-entry-time">{formatTime(task.due_at)}</p>
        <p className="today-entry-content">{task.title}</p>
      </div>
    ))
  )}
</section>

</div>
          </>
        )}

        {centerView === "view" && selectedItem && (
          <div className="view-panel">
            <div className="view-panel-header">
              <div>
                <span className="view-panel-type">
                  {selectedType === "entry" ? "📝 Diary Entry" : "📌 Task"}
                </span>
                <p className="view-panel-date">
                  {formatDateTime(
                    selectedType === "entry"
                      ? selectedItem.created_at
                      : selectedItem.due_at
                  )}
                </p>
              </div>
              <button className="close-button" onClick={closeItem}>✕</button>
            </div>

            {isEditing ? (
              <textarea
                className="entry-input edit-input"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
            ) : (
              <p className="view-panel-content">
                {selectedType === "entry"
                  ? selectedItem.content
                  : selectedItem.title}
              </p>
            )}

            <div className="view-panel-actions">
              {isEditing ? (
                <>
                  <button className="save-button" onClick={saveEdit}>
                    Save Changes
                  </button>
                  <button
                    className="cancel-edit-button"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="edit-button"
                    onClick={() => setIsEditing(true)}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="delete-button"
                    onClick={deleteItem}
                  >
                    🗑 Delete
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;