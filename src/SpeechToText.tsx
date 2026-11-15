import { useEffect, useRef, useState } from "react";

type SpeechResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechEvent = {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
};

type SpeechEngine = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechEngine;
  webkitSpeechRecognition?: new () => SpeechEngine;
};

export default function SpeechToText() {
  const recognition = useRef<SpeechEngine | null>(null);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      recognition.current?.stop();
    };
  }, []);

  function startListening() {
    const browser = window as SpeechWindow;
    const Recognition =
      browser.SpeechRecognition || browser.webkitSpeechRecognition;

    if (!Recognition) {
      setError("المتصفح لا يدعم تحويل الكلام إلى نص. جرّب متصفحًا حديثًا.");
      return;
    }

    setError("");
    setInterim("");

    const engine = new Recognition();
    recognition.current = engine;

    engine.lang = "ar-EG";
    engine.continuous = true;
    engine.interimResults = true;

    engine.onresult = (event) => {
      let finalText = "";
      let temporaryText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalText += transcript + " ";
        } else {
          temporaryText += transcript;
        }
      }

      if (finalText) {
        setText((previous) => previous + finalText);
      }

      setInterim(temporaryText);
    };

    engine.onerror = (event) => {
      setError("تعذر استخدام الميكروفون: " + event.error);
      setListening(false);
    };

    engine.onend = () => {
      setListening(false);
    };

    try {
      engine.start();
      setListening(true);
    } catch {
      setError("تعذر بدء الاستماع. حاول مرة أخرى.");
      setListening(false);
    }
  }

  function stopListening() {
    recognition.current?.stop();
    setListening(false);
    setInterim("");
  }

  return (
    <section
      dir="rtl"
      style={{
        background: "#fff",
        borderRadius: 20,
        padding: 24,
        boxShadow: "0 8px 30px rgba(20,50,90,.08)",
        border: "1px solid #e4edf8",
        color: "#17375d"
      }}
    >
      <h2>🎙️ سند يسمع ويكتب</h2>

      <p>
        حوّل الكلام المسموع إلى نص عربي يظهر أمامك.
      </p>

      <div
        aria-live="polite"
        style={{
          background: "#f1f6fc",
          borderRadius: 14,
          padding: 18,
          minHeight: 110,
          lineHeight: 1.9,
          margin: "18px 0"
        }}
      >
        {text || "النص الذي يتم التعرف عليه سيظهر هنا..."}
        {interim && (
          <span style={{ color: "#52749b" }}>
            {" "}{interim}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {!listening ? (
          <button
            type="button"
            onClick={startListening}
            style={buttonStyle}
          >
            🎤 ابدأ الاستماع
          </button>
        ) : (
          <button
            type="button"
            onClick={stopListening}
            style={{ ...buttonStyle, background: "#b93838" }}
          >
            إيقاف الاستماع
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setText("");
            setInterim("");
            setError("");
          }}
          style={{ ...buttonStyle, background: "#52677f" }}
        >
          مسح النص
        </button>

        <button
          type="button"
          onClick={() => {
            if (text && navigator.clipboard) {
              navigator.clipboard.writeText(text);
            }
          }}
          style={{ ...buttonStyle, background: "#16765b" }}
        >
          نسخ النص
        </button>
      </div>

      {listening && (
        <p role="status" style={{ color: "#16765b" }}>
          ● الميكروفون يعمل الآن
        </p>
      )}

      {error && (
        <p role="alert" style={{ color: "#b93838" }}>
          {error}
        </p>
      )}

      <small>
        يحتاج الميكروفون إلى إذنك. دقة التعرف على الكلام تختلف حسب
        المتصفح واللغة والضوضاء المحيطة.
      </small>
    </section>
  );
}

const buttonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 10,
  padding: "13px 17px",
  background: "#1766c2",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer"
};
