"use client";

import { useState, useEffect, useRef } from "react";

type Todo = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const EXAMPLES = [
  "プレゼン準備を3ステップに分解して",
  "完了済みのタスクをすべて削除して",
  "買い物リストを作って：牛乳、卵、パン",
];

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");

  const [agentInput, setAgentInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isAgentLoading, setIsAgentLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const agentInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // localStorage から復元
  useEffect(() => {
    const saved = localStorage.getItem("todos");
    if (saved) setTodos(JSON.parse(saved));
  }, []);

  // todos が変わったら保存
  useEffect(() => {
    localStorage.setItem("todos", JSON.stringify(todos));
  }, [todos]);

  // 新しいチャットメッセージに自動スクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isAgentLoading]);

  // ── 手動操作 ──────────────────────────────────────────

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

  const toggleTodo = (id: string) =>
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );

  const deleteTodo = (id: string) =>
    setTodos((prev) => prev.filter((t) => t.id !== id));

  const filtered = todos.filter((t) => {
    if (filter === "active") return !t.completed;
    if (filter === "done") return t.completed;
    return true;
  });

  const activeCount = todos.filter((t) => !t.completed).length;

  // ── AI エージェント呼び出し ────────────────────────────

  const callAgent = async () => {
    const command = agentInput.trim();
    if (!command || isAgentLoading) return;

    setChatHistory((prev) => [...prev, { role: "user", content: command }]);
    setAgentInput("");
    setIsAgentLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todos, message: command }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "API error");

      setTodos(data.todos);
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: data.message },
      ]);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "エラーが発生しました";
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${msg}` },
      ]);
    } finally {
      setIsAgentLoading(false);
      agentInputRef.current?.focus();
    }
  };

  // ─────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-start justify-center pt-16 px-4 pb-16">
      <div className="w-full max-w-md">

        {/* ── ヘッダー ── */}
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

        {/* ── 手動入力 ── */}
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

        {/* ── フィルタータブ ── */}
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

        {/* ── タスクリスト ── */}
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
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              <span className={`flex-1 text-sm leading-relaxed break-all ${todo.completed ? "line-through text-slate-400" : "text-slate-700"}`}>
                {todo.text}
              </span>

              <button
                onClick={() => deleteTodo(todo.id)}
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                aria-label="削除"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>

        {/* 完了済みを一括削除 */}
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

        {/* ── 区切り線 ── */}
        <div className="my-8 flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
            ✨ AIアシスタント
          </span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* ── チャット履歴 ── */}
        {chatHistory.length > 0 && (
          <div className="mb-4 space-y-3 max-h-72 overflow-y-auto pr-1">
            {chatHistory.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white rounded-tr-sm"
                      : "bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* ローディングインジケーター */}
            {isAgentLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1 items-center">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* ── 使用例チップ（初回のみ表示） ── */}
        {chatHistory.length === 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setAgentInput(ex)}
                className="text-xs px-3 py-1.5 rounded-full bg-white border border-violet-200 text-violet-600 hover:bg-violet-50 hover:border-violet-400 transition shadow-sm"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {/* ── AI 入力欄 ── */}
        <div className="flex gap-2">
          <input
            ref={agentInputRef}
            type="text"
            value={agentInput}
            onChange={(e) => setAgentInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) callAgent();
            }}
            placeholder="AIに自然言語で指示する..."
            disabled={isAgentLoading}
            className="flex-1 px-4 py-3 rounded-xl border border-violet-200 bg-white text-slate-800 placeholder-slate-400 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition disabled:opacity-60"
          />
          <button
            onClick={callAgent}
            disabled={!agentInput.trim() || isAgentLoading}
            className="px-5 py-3 rounded-xl bg-violet-600 text-white text-sm font-medium shadow-sm hover:bg-violet-500 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            送信
          </button>
        </div>

      </div>
    </main>
  );
}
