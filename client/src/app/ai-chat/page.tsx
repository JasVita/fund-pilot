/* ──────────────────────────────────────────────────────────
   ai-chat/page.tsx
────────────────────────────────────────────────────────── */
"use client";

import React, { useState } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import axios from "axios";

import {
  Send,
  User,
  Bot,
  Database,
  FileText,
  BarChart3,
  History,
  ChevronRight,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5003";

/* ─── types ─── */
interface Message {
  id: string;
  content: string;
  sender: "user" | "assistant";
  timestamp: Date;
}

/* ─── component ─── */
export default function AIChatPage() {
  /* state */
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content:
        "Hello! I'm your fund management AI assistant. I here to answer questions about your portfolios. What would you like to know?",
      sender: "assistant",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);

  /* shortcuts / examples */
  const promptShortcuts = [
    { icon: Database, label: "/sql", description: "Generate SQL queries" },
    { icon: FileText, label: "/explain", description: "Explain data insights" },
    { icon: BarChart3, label: "/summary", description: "Create summaries" },
  ];

  const exampleQs = [
    "What are the top performing investors this quarter?",
    "Show me NAV trends for the equity fund",
    "Which redemptions are overdue?",
    "Generate a P&L summary for November",
    "Analyze cash-flow patterns this year",
  ];

  const recentQueries = [
    "Top 10 investors by AUM",
    "Monthly P&L analysis",
    "Redemption queue status",
    "Fund performance comparison",
  ];

  /* helpers */
  // const ts = (d: Date) =>
  //   d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const ts = (d: Date) =>
    d.toLocaleTimeString("en-GB", {   // 24-hour, same everywhere
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Hong_Kong",     // or your canonical zone
    });
  const send = async () => {
    if (!input.trim()) return;

    const user: Message = {
      id: Date.now().toString(),
      sender: "user",
      content: input,
      timestamp: new Date(),
    };
    setMessages((m) => [...m, user]);
    setInput("");
    setThinking(true);
    // make request to server
    const {data} = await axios.post(`${API_BASE}/ai-chat`, { question: user.content });
    console.log("data", data);

    /* pretend we call an LLM */
    setTimeout(() => {
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        // content: mockLLM(user.content),
        content: data.answer,
        timestamp: new Date(),
      };
      setMessages((m) => [...m, reply]);
      setThinking(false);
    }, 1500);
  };

  /* very short mock responder */
  const mockLLM = (q: string) =>
    `You asked: **${q}**\n\n(Here the assistant would return an insightful answer generated from your fund data.)`;

  /* ── render ── */
  return (
    <div className="flex h-[calc(100vh-8rem)] p-6 space-x-6">
      {/* chat column */}
      <div className="flex-1 flex flex-col">
        <Card className="flex-1 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bot className="w-5 h-5" />
              <span>AI&nbsp;Assistant</span>
              <Badge variant="outline" className="ml-auto">
                Online
              </Badge>
            </CardTitle>
          </CardHeader>

          {/* messages + input */}
          <CardContent className="flex-1 flex flex-col p-0">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-start space-x-3 ${
                      m.sender === "user"
                        ? "flex-row-reverse space-x-reverse"
                        : ""
                    }`}
                  >
                    {/* avatar */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        m.sender === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {m.sender === "user" ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <Bot className="w-4 h-4" />
                      )}
                    </div>

                    {/* bubble */}
                    <div
                      className={`flex-1 max-w-[80%] ${
                        m.sender === "user" ? "text-right" : ""
                      }`}
                    >
                      <div
                        className={`rounded-lg p-3 text-sm whitespace-pre-wrap ${
                          m.sender === "user"
                            ? "bg-primary text-primary-foreground ml-auto inline-block"
                            : "bg-muted"
                        }`}
                        dangerouslySetInnerHTML={{ __html: m.content }}
                      />

                      <div className="text-xs text-muted-foreground mt-1">
                        {ts(m.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}

                {/* typing indicator */}
                {thinking && (
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                        <div
                          className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        />
                        <div
                          className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <Separator />

            {/* quick actions */}
            <div className="p-4 border-b">
              <div className="text-sm font-medium mb-2">Quick Actions:</div>
              <div className="flex space-x-2">
                {promptShortcuts.map((s) => (
                  <Button
                    key={s.label}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setInput(s.label + " ")}
                  >
                    <s.icon className="w-3 h-3 mr-1" /> {s.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* input */}
            <div className="p-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="Ask about your fund data…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  disabled={thinking}
                />
                <Button onClick={send} disabled={thinking || !input.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* sidebar */}
      <div className="w-80 space-y-4">
        {/* recent queries */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center space-x-2">
              <History className="w-4 h-4" />
              <span>Recent&nbsp;Queries</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentQueries.map((q) => (
              <Button
                key={q}
                variant="ghost"
                size="sm"
                className="w-full justify-between h-auto p-2 text-left text-xs"
                onClick={() => setInput(q)}
              >
                {q}
                <ChevronRight className="w-3 h-3" />
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* example questions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Example Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {exampleQs.map((q) => (
              <Button
                key={q}
                variant="ghost"
                size="sm"
                className="w-full h-auto p-2 text-left text-xs"
                onClick={() => setInput(q)}
              >
                {q}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
