import { useEffect, useRef, useState } from "react";

type CameraStatus = "idle" | "starting" | "running" | "error";

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const busyRef = useRef(false);

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [message, setMessage] = useState(
    "لما تشغّل الكاميرا، سند هيبدأ يوصف المشهد بالعربي."
  );
  const [error, setError] = useState("");
  const [speaking, setSpeaking] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [fontScale, setFontScale] = useState(100);
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    const previousSize = document.documentElement.style.fontSize;
    document.documentElement.style.fontSize =
      `${16 * fontScale / 100}px`;

    return () => {
      document.documentElement.style.fontSize = previousSize;
    };
  }, [fontScale]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  function speak(text: string) {
    if (!speaking || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar";
    utterance.rate = 0.95;

    window.speechSynthesis.speak(utterance);
  }

  async function analyzeFrame() {
    if (busyRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;

    if (video.readyState < 2 || video.videoWidth === 0) return;

    busyRef.current = true;

    try {
      const canvas = canvasRef.current;
      const maxWidth = 768;
      const scale = Math.min(1, maxWidth / video.videoWidth);

      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("تعذر تجهيز الصورة للتحليل.");
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const image = canvas.toDataURL("image/jpeg", 0.62);

      const response = await fetch("/api/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image })
      });

      const data = await response.json() as {
        description?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "حصلت مشكلة أثناء تحليل الصورة.");
      }

      if (data.description) {
        setMessage(data.description);

        setLastUpdated(
          new Date().toLocaleTimeString("ar-EG", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
          })
        );

        speak(data.description);
      }
    } catch (e) {
      const text = e instanceof Error ? e.message : "تعذر تحليل المشهد.";

      setError(text);

      if (text.includes("OPENAI_API_KEY")) {
        setMessage(
          "ميزة وصف المشهد تحتاج إعداد مفتاح الخدمة بشكل آمن في إعدادات Vercel."
        );
      }
    } finally {
      busyRef.current = false;
    }
  }

  async function startCamera() {
    setError("");
    setStatus("starting");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "المتصفح لا يدعم الكاميرا هنا. افتح الموقع عبر HTTPS ومن متصفح حديث."
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setStatus("running");
      setMessage("الكاميرا شغالة. جاري وصف المشهد...");

      await analyzeFrame();

      timerRef.current = window.setInterval(analyzeFrame, 4500);
    } catch (e) {
      const text = e instanceof Error
        ? e.message
        : "لم نتمكن من تشغيل الكاميرا.";

      setError(text);
      setStatus("error");
    }
  }

  function stopCamera() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
    }

    timerRef.current = null;

    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    busyRef.current = false;
    setStatus("idle");
    setMessage("الكاميرا متوقفة. تقدر تشغّلها وقت ما تحتاج.");
  }

  function changeFont(amount: number) {
    setFontScale(current =>
      Math.min(140, Math.max(85, current + amount))
    );
  }

  return (
    <main
      style={{
        filter: highContrast ? "contrast(1.35)" : "none"
      }}
    >
      <a className="skip-link" href="#main">
        تخطّي إلى المحتوى
      </a>

      <header className="topbar">
        <a className="brand" href="#" aria-label="سند، الصفحة الرئيسية">
          <span className="brand-mark">س</span>
          <span>
            سند <small>SANAD AI</small>
          </span>
        </a>

        <span className="top-note">معاك في كل خطوة</span>
      </header>

      <section
        aria-label="إعدادات سهولة الاستخدام"
        style={{
          padding: "18px 5%",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          background: "#eef5ff"
        }}
      >
        <strong>إعدادات سهولة الاستخدام</strong>

        <button
          type="button"
          onClick={() => changeFont(-10)}
          disabled={fontScale <= 85}
          aria-label="تصغير حجم الخط"
          style={accessButton}
        >
          A−
        </button>

        <span aria-live="polite">{fontScale}%</span>

        <button
          type="button"
          onClick={() => changeFont(10)}
          disabled={fontScale >= 140}
          aria-label="تكبير حجم الخط"
          style={accessButton}
        >
          A+
        </button>

        <button
          type="button"
          onClick={() => setHighContrast(value => !value)}
          aria-pressed={highContrast}
          style={accessButton}
        >
          {highContrast ? "إيقاف تحسين التباين" : "تحسين التباين"}
        </button>
      </section>

      <section className="hero" id="main">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="dot" /> مساعد إتاحة ذكي
          </span>

          <h1>
            العالم أوضح،
            <br />
            <em>مع سند.</em>
          </h1>

          <p>
            مساعدك الذكي لفهم ما حولك والوصول للمعلومات بطريقة أسهل،
            باللغة العربية.
          </p>

          <a className="primary-link" href="#eye">
            جرّب عين سند <span aria-hidden="true">←</span>
          </a>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="orb orb-one" />
          <div className="orb orb-two" />

          <div className="hero-card">
            <span className="hero-symbol">✦</span>
            <strong>أنا سند</strong>
            <span>هنا علشان أساعدك</span>

            <div className="wave">
              <i /><i /><i /><i /><i /><i /><i />
            </div>
          </div>
        </div>
      </section>

      <section className="feature-strip" aria-label="مميزات سند">
        <div>
          <span>◉</span>
          <strong>وصف المشاهد</strong>
          <small>افهم اللي حواليك</small>
        </div>

        <div>
          <span>◖</span>
          <strong>صوت عربي</strong>
          <small>اسمع وصف سند</small>
        </div>

        <div>
          <span>◇</span>
          <strong>تحكم واضح</strong>
          <small>تشغيل وإيقاف وقت ما تحب</small>
        </div>
      </section>

      <section className="camera-section" id="eye">
        <div className="section-heading">
          <span className="eyebrow">الميزة الأولى</span>

          <h2>
            عين سند <span>•</span>
          </h2>

          <p>
            وجّه الكاميرا للمشهد، وسند هيحاول يوصف العناصر الظاهرة بصوت عربي.
          </p>
        </div>

        <div className="camera-layout">
          <div className="camera-frame">
            <video
              ref={videoRef}
              playsInline
              muted
              aria-label="عرض مباشر من كاميرا الهاتف"
            />

            {status !== "running" && (
              <div className="camera-placeholder">
                <div className="camera-icon">▣</div>

                <strong>
                  {status === "starting"
                    ? "بنفتح الكاميرا..."
                    : "الكاميرا جاهزة"}
                </strong>

                <span>
                  اضغط تشغيل واسمح للمتصفح باستخدام الكاميرا
                </span>
              </div>
            )}

            {status === "running" && (
              <span className="live-pill">
                <i /> مباشر
              </span>
            )}

            <canvas ref={canvasRef} className="hidden-canvas" />
          </div>

          <div className="assistant-panel">
            <div className="assistant-title">
              <div className="assistant-avatar">س</div>

              <div>
                <strong>سند بيقولك</strong>
                <small>
                  {status === "running"
                    ? "بيحلل المشهد"
                    : "جاهز للمساعدة"}
                </small>
              </div>
            </div>

            <p className="description" aria-live="polite">
              {message}
            </p>

            {lastUpdated && (
              <small className="updated">
                آخر تحديث: {lastUpdated}
              </small>
            )}

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}

            <div className="controls">
              {status === "running" ? (
                <button className="stop-button" onClick={stopCamera}>
                  إيقاف الكاميرا
                </button>
              ) : (
                <button
                  className="start-button"
                  onClick={startCamera}
                  disabled={status === "starting"}
                >
                  {status === "starting"
                    ? "جاري التشغيل..."
                    : "تشغيل الكاميرا"}
                </button>
              )}

              <button
                className="sound-button"
                onClick={() => {
                  setSpeaking(value => !value);

                  if (speaking) {
                    window.speechSynthesis?.cancel();
                  }
                }}
                aria-pressed={speaking}
              >
                {speaking ? "🔊 الصوت مفعّل" : "🔇 الصوت متوقف"}
              </button>
            </div>

            <p className="privacy-note">
              🔒 لا يتم حفظ الفيديو. تُرسل لقطة صغيرة للتحليل عند كل تحديث،
              ويمكنك إيقاف الكاميرا في أي وقت.
            </p>
          </div>
        </div>

        <div className="safety-note">
          <strong>تنبيه مهم</strong>

          <span>
            وصف سند قد يخطئ أو لا يلاحظ بعض التفاصيل. لا تعتمد عليه وحده
            لعبور الطريق أو تجنّب المخاطر؛ استخدم وسائل المساعدة المعتادة.
          </span>
        </div>
      </section>

      <section className="coming" id="services">
        <span className="eyebrow">خدمات سند</span>

        <h2>مساعدة أكتر، باستقلالية أكبر.</h2>

        <p>
          بنطوّر سند ليقدم أدوات مساعدة لمختلف الاحتياجات.
          الخدمات التالية ضمن مراحل التطوير وليست مفعّلة كلها بعد.
        </p>

        <div className="coming-grid">
          <article>
            <b>👁️</b>
            <strong>دعم الإعاقة البصرية</strong>
            <p>وصف المشاهد وقراءة النصوص ومساعدة المستخدم على فهم محيطه.</p>
            <small>عين سند متاحة للتجربة</small>
          </article>

          <article>
            <b>👂</b>
            <strong>دعم الإعاقة السمعية</strong>
            <p>أدوات تحويل الكلام إلى نص ووسائل تواصل مرئية.</p>
            <small>قيد التطوير</small>
          </article>

          <article>
            <b>♿</b>
            <strong>دعم الإعاقة الحركية</strong>
            <p>تسهيل التفاعل والتحكم الصوتي في الخدمات المتوافقة.</p>
            <small>قيد التطوير</small>
          </article>

          <article>
            <b>📚</b>
            <strong>دعم صعوبات التعلم</strong>
            <p>شرح مبسط ومساعدة في القراءة والتعلم خطوة بخطوة.</p>
            <small>قيد التطوير</small>
          </article>

          <article>
            <b>🎙️</b>
            <strong>المساعد الصوتي</strong>
            <p>التفاعل مع سند باللغة العربية بالصوت.</p>
            <small>قيد التطوير</small>
          </article>

          <article>
            <b>📖</b>
            <strong>قراءة المستندات</strong>
            <p>التعرف على النصوص في الصور والمستندات وقراءتها.</p>
            <small>قيد التطوير</small>
          </article>
        </div>
      </section>

      <footer>
        <span className="brand-footer">سند · SANAD AI</span>
        <span>التكنولوجيا لخدمة الإنسان</span>
      </footer>
    </main>
  );
}

const accessButton: React.CSSProperties = {
  border: "1px solid #b8c9e2",
  borderRadius: "10px",
  padding: "10px 14px",
  background: "#ffffff",
  color: "#15365c",
  fontWeight: 700,
  cursor: "pointer",
  minHeight: "42px"
};
