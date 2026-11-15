import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "طريقة الطلب غير مدعومة." });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "OPENAI_API_KEY غير مضبوط في إعدادات Vercel." });

  const image = (req.body as { image?: unknown } | undefined)?.image;
  if (typeof image !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(image)) {
    return res.status(400).json({ error: "الصورة المرسلة غير صالحة." });
  }
  if (image.length > 5_500_000) return res.status(413).json({ error: "حجم الصورة كبير. حاول مرة أخرى." });

  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        store: false,
        max_output_tokens: 130,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: "أنت سند، مساعد إتاحة عربي. صف بإيجاز ووضوح ما يظهر في الصورة للمستخدم الذي قد لا يستطيع رؤيتها. اذكر الأشياء الواضحة ومواقعها النسبية وأي عائق ظاهر بحذر. لا تخمّن ولا تدّعِ معرفة شيء غير واضح. إذا كان المشهد قد يتضمن خطرًا، قل إنك غير متأكد واطلب من المستخدم التوقف وطلب مساعدة بشرية؛ لا تعطِ توجيهات ملاحية حاسمة. استخدم جملتين قصيرتين بالعربية المصرية المفهومة." },
            { type: "input_image", image_url: image, detail: "low" }
          ]
        }]
      })
    });
    const payload = await upstream.json() as {
      output_text?: string;
      error?: { message?: string };
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };
    if (!upstream.ok) {
      console.error("Vision provider error:", payload.error?.message || upstream.status);
      return res.status(502).json({ error: "خدمة تحليل الصور لم تستجب الآن. جرّب بعد قليل." });
    }
    const text = payload.output_text || payload.output?.flatMap(item => item.content || []).find(part => part.type === "output_text")?.text;
    if (!text) return res.status(502).json({ error: "لم يصل وصف واضح للصورة. جرّب توجيه الكاميرا مرة أخرى." });
    return res.status(200).json({ description: text });
  } catch (error) {
    console.error("Describe route failed:", error);
    return res.status(500).json({ error: "حصل خطأ مؤقت أثناء تحليل المشهد." });
  }
}
