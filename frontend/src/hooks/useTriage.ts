import { useState, useCallback } from "react";
import { TriageApiError, postTriage, validateFiles } from "../api";
import type { ChatMessage, TriageResponse } from "../types";

export type Mode = "chat" | "form";

function randomConversationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useTriage() {
  const [mode, setMode] = useState<Mode>("chat");
  const [conversationId] = useState(randomConversationId);

  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [files, setFiles] = useState<File[]>([]);

  const [locale, setLocale] = useState("IN");
  const [pincode, setPincode] = useState("");
  const [address, setAddress] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<TriageResponse | null>(null);

  const mergeNewFiles = useCallback((incoming: FileList | File[]) => {
    try {
      const next = [...files, ...Array.from(incoming)];
      validateFiles(next);
      setFiles(next);
      setError(null);
    } catch (err) {
      if (err instanceof TriageApiError) {
        setError(err.message);
      }
    }
  }, [files]);

  const removeFile = useCallback((idx: number) => {
    setFiles((f) => f.filter((_, i) => i !== idx));
  }, []);

  const clearSession = useCallback(() => {
    setHistory([]);
    setLastResponse(null);
    setError(null);
    setFiles([]);
  }, []);

  const submitTriage = async (
    message: string,
    isForm: boolean = false
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await postTriage(
        {
          message,
          messages: isForm ? [] : history,
          locale: locale.trim() || null,
          pincode: pincode.trim() || null,
          address: address.trim() || null,
          conversation_id: conversationId,
        },
        files
      );
      
      setLastResponse(res);
      
      if (isForm) {
        setHistory([
          { role: "user", content: message },
          { role: "assistant", content: res.triage.user_message },
        ]);
        setMode("chat");
      } else {
        const userVisible = message.trim() || "(Attached file(s) only)";
        setHistory((h) => [
          ...h,
          { role: "user", content: userVisible },
          { role: "assistant", content: res.triage.user_message },
        ]);
      }
      
      setFiles([]);
      return true; // success
    } catch (err) {
      if (err instanceof TriageApiError) {
        setError(err.message);
      } else {
        setError(
          err instanceof Error ? err.message : "Something went wrong. Try again."
        );
      }
      return false; // failure
    } finally {
      setLoading(false);
    }
  };

  return {
    mode, setMode,
    conversationId,
    history,
    files, mergeNewFiles, removeFile,
    locale, setLocale,
    pincode, setPincode,
    address, setAddress,
    loading,
    error, setError,
    lastResponse,
    clearSession,
    submitTriage
  };
}
