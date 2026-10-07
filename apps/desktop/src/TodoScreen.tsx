import {
  useIsOnline,
  useTodoActions,
  useTodos,
  type Todo,
  type TodoId,
} from "@kirk/shared";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { useSignOut } from "./auth";

export function TodoScreen() {
  const todos = useTodos();
  const online = useIsOnline();
  const signOut = useSignOut();

  const latest = useRef<readonly Todo[]>([]);
  latest.current = todos ?? [];
  const getTodos = useCallback(() => latest.current, []);
  const actions = useTodoActions(getTodos);

  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<TodoId | null>(null);
  const [editText, setEditText] = useState("");
  const [dragId, setDragId] = useState<TodoId | null>(null);
  const [overId, setOverId] = useState<TodoId | null>(null);

  const add = (event: FormEvent) => {
    event.preventDefault();
    const title = draft.trim();
    if (!online || title === "") return;
    setDraft("");
    void actions.add(title);
  };

  const finishEdit = (save: boolean) => {
    if (editingId === null) return;
    const id = editingId;
    setEditingId(null);
    const title = editText.trim();
    const original = latest.current.find((t) => t._id === id);
    if (save && online && title !== "" && original && title !== original.title) {
      void actions.rename(id, title);
    }
  };

  const drop = (target: TodoId) => {
    const list = latest.current;
    const toIndex = list.findIndex((t) => t._id === target);
    if (online && dragId !== null && dragId !== target && toIndex !== -1) {
      void actions.move(dragId, toIndex);
    }
    setDragId(null);
    setOverId(null);
  };

  return (
    <main className="todos">
      {!online && (
        <div className="banner" role="alert">
          You are offline. Editing is paused until the connection returns.
        </div>
      )}
      <header>
        <h1>Todos</h1>
        <button className="link" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>
      <form className="add" onSubmit={add}>
        <input
          placeholder="Add a todo"
          value={draft}
          disabled={!online}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" disabled={!online}>
          Add
        </button>
      </form>
      {todos === undefined ? (
        <p className="center">Loading</p>
      ) : todos.length === 0 ? (
        <p className="center muted">Nothing to do.</p>
      ) : (
        <ul>
          {todos.map((todo, index) => (
            <li
              key={todo._id}
              draggable={online && editingId !== todo._id}
              className={[
                dragId === todo._id ? "dragging" : "",
                overId === todo._id && dragId !== todo._id ? "over" : "",
              ].join(" ")}
              onDragStart={() => setDragId(todo._id)}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              onDragOver={(e) => {
                if (dragId === null) return;
                e.preventDefault();
                setOverId(todo._id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(todo._id);
              }}
            >
              <input
                type="checkbox"
                checked={todo.done}
                disabled={!online}
                aria-label={`Done: ${todo.title}`}
                onChange={(e) => void actions.setDone(todo._id, e.target.checked)}
              />
              {editingId === todo._id ? (
                <input
                  className="edit"
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={() => finishEdit(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") finishEdit(true);
                    if (e.key === "Escape") finishEdit(false);
                  }}
                />
              ) : (
                <span
                  className={todo.done ? "title done" : "title"}
                  onDoubleClick={() => {
                    if (!online) return;
                    setEditingId(todo._id);
                    setEditText(todo.title);
                  }}
                >
                  {todo.title}
                </span>
              )}
              <span className="actions">
                <button
                  aria-label="Move up"
                  disabled={!online || index === 0}
                  onClick={() => void actions.move(todo._id, index - 1)}
                >
                  ▲
                </button>
                <button
                  aria-label="Move down"
                  disabled={!online || index === todos.length - 1}
                  onClick={() => void actions.move(todo._id, index + 1)}
                >
                  ▼
                </button>
                <button
                  aria-label="Delete"
                  disabled={!online}
                  onClick={() => void actions.remove(todo._id)}
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="hint muted">Double-click a todo to rename it. Drag to reorder.</p>
    </main>
  );
}
