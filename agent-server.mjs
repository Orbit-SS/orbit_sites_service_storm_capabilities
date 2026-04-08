// agent-server.mjs
// Runs INSIDE the Vercel Sandbox — has direct filesystem access

import express from "express";
import cors from "cors";
import { execSync } from "child_process";
import { unstable_v2_createSession } from "@anthropic-ai/claude-agent-sdk";
import "dotenv/config";

const PORT = 4000;

const app = express();
app.use(cors());
app.use(express.json());

// In-memory message log
const messages = [];

// One session per sandbox lifetime (persists conversation across messages)
const session = unstable_v2_createSession({
  model: "claude-sonnet-4-6",
  permissionMode: "acceptEdits",
  allowedTools: ["Read", "Edit", "Write", "Bash", "Glob", "Grep"],
});

function sendSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

app.get("/messages", (_req, res) => {
  res.json(messages);
});



app.post("/message", async (req, res) => {
  const { message } = req.body;

  // Log user message
  messages.push({ role: "user", content: message });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let assistantText = "";

  try {
    // Start streaming before sending so we don't miss events
    const stream = session.stream();
    await session.send(message);

    for await (const msg of stream) {
      switch (msg.type) {
        case "assistant": {
          const text = msg.message.content
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("");
          if (text) {
            assistantText += text;
            sendSSE(res, { type: "text", content: text });
          }
          for (const block of msg.message.content) {
            if (block.type === "tool_use") {
              sendSSE(res, { type: "tool_start", tool: block.name, id: block.id });
            }
          }
          break;
        }

        case "tool_progress":
          sendSSE(res, { type: "tool_progress", tool: msg.tool_name, id: msg.tool_use_id, elapsed: msg.elapsed_time_seconds });
          break;

        case "tool_use_summary":
          sendSSE(res, { type: "tool_done", summary: msg.summary });
          break;

        case "result":
          // Auto-commit and push on success
          if (msg.subtype === "success") {
            try {
              execSync("git add -A", { cwd: "/vercel/sandbox" });
              execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: "/vercel/sandbox" });
              execSync("git push", { cwd: "/vercel/sandbox" });
              sendSSE(res, { type: "saved" });
            } catch (e) {
              // No changes to commit is fine
            }
          }
          sendSSE(res, { type: "done", result: msg.subtype });
          break;
      }
    }

    // Log the full assistant reply
    if (assistantText) {
      messages.push({ role: "assistant", content: assistantText });
    }
  } catch (err) {
    sendSSE(res, { type: "error", message: err.message });
  } finally {
    res.end();
  }
});

app.listen(PORT, () => console.log(`Agent server on :${PORT}`));
