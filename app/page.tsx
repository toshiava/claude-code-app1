"use client";

import { useState, useEffect, useRef } from "react";

type Todo = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
};

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("todos");
    if (saved) setTodos(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("todos", JSON.stringify(todos));
  }, [todos]);

  const addTodo = () => {
    const text = input.trim();
    if (!text) return;
    setTodos((prev) => [
      { id: crypto.randomUUID(), text, completed: false, createdAt: Date.now() },
      ...prev,
    ]);
    setInput("");
    inputRef.current?.focus();
  };

  const toggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const deleteTodo = (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const filtered = todos.filter((t) => {
    if (filter === "active") return !t.completed;
    if (filter === "done") return t.completed;
    return true;
  });

  const activeCount = todos.filter((t) => !t.completed).length;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-start justify-center pt-16 px-4 pb-16">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
            タスク管理
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {activeCount > 0
              ? `残り ${activeCount} 件のタスク`
              : todos.length > 0
              ? "すべて完了しました 🎉"
              : "タスクを追加してみましょう"}
          </p>
        </div>

        {/* Input */}
        <div className="flex gap-2 mb-6">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}

            placeholder="新しいタスクを入力..."
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300 transition"
          />
          <button
            onClick={addTodo}
            disabled={!input.trim()}
            className="px-5 py-3 rounded-xl bg-slate-800 text-white text-sm font-medium shadow-sm hover:bg-slate-700 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            追加
          </button>
        </div>

        {/* Filter tabs */}
        {todos.length > 0 && (
          <div className="flex gap-1 mb-4 bg-slate-200 p-1 rounded-xl">
            {(["all", "active", "done"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition ${
                  filter === f
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {f === "all" ? "すべて" : f === "active" ? "未完了" : "完了済み"}
              </button>
            ))}
          </div>
        )}

        {/* Todo list */}
        <ul className="space-y-2">
          {filtered.length === 0 && (
            <li className="text-center text-slate-400 text-sm py-10">
              {filter === "done"
                ? "完了したタスクはありません"
                : filter === "active"
                ? "未完了のタスクはありません"
                : "タスクがありません"}
            </li>
          )}
          {filtered.map((todo) => (
            <li
              key={todo.id}
              className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl shadow-sm border border-slate-100 group transition hover:shadow-md"
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleTodo(todo.id)}
                className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                  todo.completed
                    ? "bg-emerald-500 border-emerald-500"
                    : "border-slate-300 hover:border-emerald-400"
                }`}
                aria-label={todo.completed ? "未完了に戻す" : "完了にする"}
              >
                {todo.completed && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>

              {/* Text */}
              <span
                className={`flex-1 text-sm leading-relaxed break-all ${
                  todo.completed
                    ? "line-through text-slate-400"
                    : "text-slate-700"
                }`}
              >
                {todo.text}
              </span>

              {/* Delete */}
              <button
                onClick={() => deleteTodo(todo.id)}
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                aria-label="削除"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>

        {/* Clear completed */}
        {todos.some((t) => t.completed) && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setTodos((prev) => prev.filter((t) => !t.completed))}
              className="text-xs text-slate-400 hover:text-red-400 transition"
            >
              完了済みをすべて削除
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
