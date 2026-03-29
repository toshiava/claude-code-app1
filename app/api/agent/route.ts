import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

// Vercel: サーバーレス関数の最大実行時間（秒）
export const maxDuration = 60;

const client = new Anthropic();

type Todo = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
};

// ── ツール定義（標準 API）─────────────────────────────────

const tools: Anthropic.Tool[] = [
  {
    name: "add_task",
    description: "タスクを1件追加する",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "追加するタスクの内容" },
      },
      required: ["text"],
    },
  },
  {
    name: "break_down_task",
    description:
      "大きなタスクやプロジェクトを、具体的なアクションレベルの複数サブタスクに分解して一括追加する",
    input_schema: {
      type: "object",
      properties: {
        subtasks: {
          type: "array",
          items: { type: "string" },
          description: "分解したサブタスクのリスト（具体的な行動ベースで）",
        },
      },
      required: ["subtasks"],
    },
  },
  {
    name: "complete_task",
    description: "指定したIDのタスクを完了済みにする",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "完了にするタスクのID" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_task",
    description: "指定したIDのタスクを削除する",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "削除するタスクのID" },
      },
      required: ["id"],
    },
  },
];

// ── ツール実行（サーバー側でタスクリストを直接操作）────────

function executeTool(
  name: string,
  input: Record<string, unknown>,
  todos: Todo[]
): { result: string; todos: Todo[] } {
  switch (name) {
    case "add_task": {
      const text = input.text as string;
      const newTodo: Todo = {
        id: randomUUID(),
        text,
        completed: false,
        createdAt: Date.now(),
      };
      return {
        result: `タスク「${text}」を追加しました`,
        todos: [newTodo, ...todos],
      };
    }
    case "break_down_task": {
      const subtasks = input.subtasks as string[];
      const newTodos: Todo[] = subtasks.map((text) => ({
        id: randomUUID(),
        text,
        completed: false,
        createdAt: Date.now(),
      }));
      return {
        result: `${subtasks.length}件に分解して追加: ${subtasks.join("、")}`,
        todos: [...newTodos, ...todos],
      };
    }
    case "complete_task": {
      const id = input.id as string;
      const task = todos.find((t) => t.id === id);
      if (!task)
        return { result: `ID「${id}」のタスクが見つかりません`, todos };
      return {
        result: `「${task.text}」を完了にしました`,
        todos: todos.map((t) =>
          t.id === id ? { ...t, completed: true } : t
        ),
      };
    }
    case "delete_task": {
      const id = input.id as string;
      const task = todos.find((t) => t.id === id);
      if (!task)
        return { result: `ID「${id}」のタスクが見つかりません`, todos };
      return {
        result: `「${task.text}」を削除しました`,
        todos: todos.filter((t) => t.id !== id),
      };
    }
    default:
      return { result: `不明なツール: ${name}`, todos };
  }
}

// ── API ルート ────────────────────────────────────────────

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

    let workingTodos: Todo[] = [...todos];

    const taskList =
      workingTodos.length > 0
        ? `現在のタスク一覧:\n${workingTodos
            .map(
              (t) =>
                `- [${t.completed ? "完了" : "未完了"}] id="${t.id}" 「${t.text}」`
            )
            .join("\n")}`
        : "現在タスクはありません";

    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: message },
    ];

    let responseText = "";
    const MAX_ITERATIONS = 10;

    // ── アジェンティックループ（ツールが不要になるまで繰り返す）──

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await client.messages.create({
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
- 操作後は何をしたか日本語で簡潔に（1〜3文）伝えてください`,
        tools,
        messages,
      });

      // テキストを収集
      responseText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      // ツール呼び出しがなければ終了
      if (response.stop_reason === "end_turn") break;

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );
      if (toolUseBlocks.length === 0) break;

      // ツールを実行して結果をメッセージに追加
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map(
        (tool) => {
          const { result, todos: updatedTodos } = executeTool(
            tool.name,
            tool.input as Record<string, unknown>,
            workingTodos
          );
          workingTodos = updatedTodos;
          return {
            type: "tool_result",
            tool_use_id: tool.id,
            content: result,
          };
        }
      );

      messages.push({ role: "user", content: toolResults });
    }

    return NextResponse.json({
      todos: workingTodos,
      message: responseText || "完了しました",
    });
  } catch (error) {
    console.error("Agent error:", error);
    const errMsg = error instanceof Error ? error.message : "不明なエラー";
    return NextResponse.json(
      { error: `AIの処理中にエラーが発生しました: ${errMsg}` },
      { status: 500 }
    );
  }
}
