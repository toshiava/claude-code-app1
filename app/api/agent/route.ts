import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";

// Vercel: サーバーレス関数の最大実行時間（秒）
export const maxDuration = 60;

const client = new Anthropic();

type Todo = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
};

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  try {
    const { todos, message }: { todos: Todo[]; message: string } =
      await req.json();

    // サーバー側でタスクリストのコピーを操作する
    let workingTodos: Todo[] = [...todos];

    // ── ツール定義 ──────────────────────────────────────

    const addTask = betaZodTool({
      name: "add_task",
      description: "タスクを1件追加する",
      inputSchema: z.object({
        text: z.string().describe("追加するタスクの内容"),
      }),
      run: async ({ text }) => {
        const newTodo: Todo = {
          id: randomUUID(),
          text,
          completed: false,
          createdAt: Date.now(),
        };
        workingTodos = [newTodo, ...workingTodos];
        return `タスク「${text}」を追加しました`;
      },
    });

    const breakDownTask = betaZodTool({
      name: "break_down_task",
      description:
        "大きなタスクやプロジェクトを、具体的なアクションレベルの複数サブタスクに分解して一括追加する",
      inputSchema: z.object({
        subtasks: z
          .array(z.string())
          .describe("分解したサブタスクのリスト（具体的な行動ベースで）"),
      }),
      run: async ({ subtasks }) => {
        const newTodos: Todo[] = subtasks.map((text) => ({
          id: randomUUID(),
          text,
          completed: false,
          createdAt: Date.now(),
        }));
        workingTodos = [...newTodos, ...workingTodos];
        return `${subtasks.length}件に分解して追加: ${subtasks.join("、")}`;
      },
    });

    const completeTask = betaZodTool({
      name: "complete_task",
      description: "指定したIDのタスクを完了済みにする",
      inputSchema: z.object({
        id: z.string().describe("完了にするタスクのID"),
      }),
      run: async ({ id }) => {
        const task = workingTodos.find((t) => t.id === id);
        if (!task) return `ID「${id}」のタスクが見つかりません`;
        workingTodos = workingTodos.map((t) =>
          t.id === id ? { ...t, completed: true } : t
        );
        return `「${task.text}」を完了にしました`;
      },
    });

    const deleteTask = betaZodTool({
      name: "delete_task",
      description: "指定したIDのタスクを削除する",
      inputSchema: z.object({
        id: z.string().describe("削除するタスクのID"),
      }),
      run: async ({ id }) => {
        const task = workingTodos.find((t) => t.id === id);
        if (!task) return `ID「${id}」のタスクが見つかりません`;
        workingTodos = workingTodos.filter((t) => t.id !== id);
        return `「${task.text}」を削除しました`;
      },
    });

    // ── システムプロンプト（現在のタスク一覧をコンテキストとして渡す）──

    const taskList =
      workingTodos.length > 0
        ? `現在のタスク一覧:\n${workingTodos
            .map(
              (t) =>
                `- [${t.completed ? "完了" : "未完了"}] id="${t.id}" 「${t.text}」`
            )
            .join("\n")}`
        : "現在タスクはありません";

    // ── Claude にツールを持たせて実行 ──────────────────────

    const finalMessage = await client.beta.messages.toolRunner({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      system: `あなたは日本語のタスク管理アシスタントです。
ユーザーの指示に従い、適切なツールを使ってタスクを操作してください。

${taskList}

【ガイドライン】
- タスクを1件追加: add_task
- 大きなタスクをステップ分解して追加: break_down_task
- タスクを完了にする: complete_task（IDで指定）
- タスクを削除する: delete_task（IDで指定）
- 操作後は何をしたか日本語で簡潔に（1〜3文）伝えてください
- タスクが存在しない場合は適切に説明してください`,
      messages: [{ role: "user", content: message }],
      tools: [addTask, breakDownTask, completeTask, deleteTask],
    });

    // テキストブロックだけ取り出してレスポンスを組み立てる
    const responseText = finalMessage.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("");

    return NextResponse.json({
      todos: workingTodos,
      message: responseText || "完了しました",
    });
  } catch (error) {
    console.error("Agent error:", error);
    return NextResponse.json(
      { error: "AIの処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
