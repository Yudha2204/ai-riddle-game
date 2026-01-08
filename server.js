// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

// Middleware
app.use(cors({ origin: "*" })); // untuk dev; production bisa dibatasi
app.use(express.json());
app.use(express.static('public')); // Serve frontend files

// Konfigurasi .env
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const OPENROUTER_SITE_URL = process.env.OPENROUTER_SITE_URL || "http://localhost";
const OPENROUTER_APP_TITLE = process.env.OPENROUTER_APP_TITLE || "Riddle Game";
const PORT = process.env.PORT || 4000;

// Model default
const DEFAULT_MODEL = process.env.MODEL;
const DEFAULT_MODEL_HG = process.env.HUGGINGFACE_MODEL;
const riddles = require("./riddles.json");

// System prompt: 
const RIDDLE_UNIFIED_RULES = `
Kamu adalah "Riddle Master" dalam sebuah game teka-teki berbahasa Indonesia.

Tugasmu: MENERIMA satu input dari pemain, lalu:
1) Menentukan apakah input itu:
   - jawaban teka-teki,
   - permintaan hint/petunjuk,
   - pertanyaan tentang teka-teki,
   - atau hal lain yang tidak relevan.
2) Membalas SELALU dengan JSON murni, TANPA TEKS LAIN.

Format JSON WAJIB:
{
  "type": "answer_check" | "hint" | "question" | "other",
  "result": "BENAR" | "SALAH" | "HAMPIR" | null,
  "message": "teks singkat dalam Bahasa Indonesia untuk pemain"
}

Aturan klasifikasi:
- Jika pemain jelas menyebut dugaan jawaban (misalnya: "jawabanku kursi", "kayaknya itu meja",
  hanya satu kata benda, atau seperti "meja?"),
  anggap itu sebagai "answer_check".
- Jika pemain berkata "aku nyerah", "aku menyerah", "nggak tau", "ga tau", "tolong kasih jawaban",
  itu juga dianggap "answer_check" (mereka menyerah). Jika reveal_answer = true, kamu BOLEH
  menyebut jawaban yang benar dalam "message".
- Jika pemain meminta bantuan tanpa memberi jawaban (contoh: "kasih hint dong", "petunjuk dong",
  "terlalu susah", "bantu aku"), gunakan "hint".
- Jika pemain bertanya tentang sifat atau penggunaan objek (contoh: "apakah ini hewan?",
  "apakah ada di rumah?", "lebih besar dari manusia?", "biasanya aku digunakan untuk apa?",
  "apa fungsi benda ini?", "untuk apa biasanya ini dipakai?"), gunakan "question".
- HANYA gunakan "other" jika pesan JELAS tidak ada hubungannya dengan teka-teki
  (misalnya ngomongin hal di luar game, spam, atau topik lain yang tidak relevan sama sekali).

Aturan jawaban:
- Untuk type = "answer_check":
  - "result" harus salah satu: "BENAR", "SALAH", atau "HAMPIR".
  - "message" = respon singkat (1–3 kalimat).
  - Jika reveal_answer = false, JANGAN tulis jawaban benar secara eksplisit meskipun pemain salah.
  - Jika reveal_answer = true dan pemain jelas menyerah atau minta jawabannya,
    kamu boleh menyebut jawaban benar di dalam "message".

- Untuk type = "question":
  - "result" selalu null.
  - "message" HARUS diawali dengan salah satu:
    - "YA, ..." jika untuk kebanyakan kasus jawaban resmi memenuhi hal tersebut.
    - "TIDAK, ..." jika untuk kebanyakan kasus jawaban resmi tidak memenuhi hal tersebut.
    - "MUNGKIN, ..." hanya jika benar-benar sangat bergantung konteks/variasi
      (misalnya warna, model, atau gaya yang sangat berbeda-beda).
  - Jika dalam dunia nyata sifat atau penggunaan tersebut UMUM/LAZIM untuk jawaban resmi, pilih "YA".
    Contoh: untuk jawaban "Meja", pertanyaan "apakah itu digunakan untuk belajar?"
    → "YA, meja sering digunakan untuk belajar."
  - Jika sifat tersebut JARANG untuk jawaban resmi, pilih "TIDAK".
  - Jangan menjawab mengambang atau menghindar.
  - DILARANG menjawab seperti:
    - "Mungkin, tergantung yang kamu bayangkan."
    - "Aku tidak bisa memberitahu secara spesifik."
    - atau kalimat serupa yang terlalu umum.
  - Untuk pertanyaan seperti "biasanya aku digunakan untuk apa?", "apa fungsi benda ini?",
    wajib jelaskan fungsi umum benda tersebut TANPA menyebut nama bendanya secara eksplisit.

- Untuk type = "hint":
  - "result" harus null.
  - "message" harus memberikan petunjuk YANG RELEVAN dengan jawaban resmi
    dan selaras dengan daftar hints yang diberikan.
  - Kamu boleh menggunakan salah satu atau beberapa hint yang diberikan, atau merangkumnya
    dengan kata-kata sendiri, selama maknanya tetap sama.
  - Petunjuk boleh menyebut kategori sifat (misalnya dingin, besar, mengapung, bersalju, berbahaya),
    tetapi TIDAK boleh menyebut nama objek secara langsung.
  - Petunjuk TIDAK BOLEH terlalu umum seperti "pikirkan sesuatu yang ada di lingkungan sehari-hari".
  - Petunjuk HARUS menggambarkan ciri umum yang nyata dari jawaban resmi.
  - Contoh:
    Jika jawabannya "Gunung Es", petunjuk yang benar:
    "Benda ini terbentuk dari air beku dan sering ditemukan di lautan yang sangat dingin."
    Bukan:
    "Pikirkan sesuatu yang ada di jalan atau tempat umum."

- Untuk type = "other":
  - "result" harus null.
  - "message" arahkan pemain kembali ke teka-teki
    (misal: "Fokuslah pada teka-tekinya.").
  - Jangan gunakan "other" untuk pertanyaan yang masih bisa dijawab
    menggunakan informasi riddle, jawaban resmi, atau hints.

Jawablah SELALU dalam JSON murni, tanpa penjelasan tambahan, tanpa teks sebelum atau sesudah JSON.
`;

// Helper panggil OpenRouter
async function callOpenRouter(messages, retry = 1, model = DEFAULT_MODEL) {
    try {
        if (!OPENROUTER_API_KEY) {
            throw new Error("OPENROUTER_API_KEY belum di-set di .env");
        }

        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model,
            messages,
            stream: false
        },
            {
                headers: {
                    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": OPENROUTER_SITE_URL,
                    "X-Title": OPENROUTER_APP_TITLE
                },
                timeout: 20000
            }
        );


        const choice = response.data.choices && response.data.choices[0];
        let content = "";

        if (choice && choice.message && choice.message.content) {
            content = choice.message.content.trim();
        } else if (choice && choice.delta && choice.delta.content) {
            content = choice.delta.content.trim();
        }

        if (!content && retry > 0) {
            console.warn("Empty content, retrying...");
            return await callOpenRouter(messages, retry - 1);
        }

        return content;
    } catch (err) {
        if (retry > 0) {
            console.warn("Request error, retrying...", err.message);
            return await callOpenRouter(messages, retry - 1);
        }
        throw err;
    }
}

// Helper panggil HuggingFace
async function callHuggingFaceRouter(messages, retry = 1, model = DEFAULT_MODEL_HG) {
    try {
        if (!HUGGINGFACE_API_KEY) {
            throw new Error("HUGGINGFACE_API_KEY belum di-set di .env");
        }

        const response = await axios.post("https://router.huggingface.co/v1/chat/completions", {
            model,
            messages,
            stream: false
        },
            {
                headers: {
                    Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
                    "Content-Type": "application/json"
                },
                timeout: 20000
            }
        );


        const choice = response.data.choices && response.data.choices[0];
        let content = "";

        if (choice && choice.message && choice.message.content) {
            content = choice.message.content.trim();
        }

        if (!content && retry > 0) {
            console.warn("Empty content, retrying...");
            return await callHuggingFaceRouter(messages, retry - 1);
        }

        return content;
    } catch (err) {
        if (retry > 0) {
            console.warn("Request error, retrying...", err.message);
            return await callHuggingFaceRouter(messages, retry - 1);
        }
        throw err;
    }
}

async function callLLMWithFallback(messages) {
    // 1) Coba OpenRouter dulu
    try {
        const content = await callOpenRouter(messages);
        if (content && content.trim() !== "") {
            return {
                provider: "openrouter",
                content
            };
        }
    } catch (err) {
        // Kalau 429 / network error dll, kita log aja, nanti fallback
        const status = (err.response && err.response.status) || err.message;
        console.warn("OpenRouter failed:", status);
    }

    // 2) Kalau OpenRouter gagal/kosong → coba Hugging Face
    try {
        const content = await callHuggingFaceRouter(messages);
        if (content && content.trim() !== "") {
            return {
                provider: "huggingface",
                content
            };
        }
        throw new Error("HuggingFace returned empty content.");
    } catch (err2) {
        const status = (err2.response && err2.response.status) || err2.message;
        console.error("HuggingFace failed:", status);
        throw err2; // biar endpoint bisa balikin error/fallback message ke user
    }
}


app.get("/api/riddle/list", (req, res) => {
    res.json({
        ok: true,
        data: riddles.map(riddle => ({
            level: riddle.order,
            initialHint: riddle.initialHint,
            image: riddle.image
        }))
    });
});


// POST /api/riddle/interact
// Body:
// {
//   "riddleText": "Teka-teki...",
//   "playerInput": "apapun yang diketik pemain",
//   "level": "level"
//   "revealAnswer": false,
//   "history": [ { "question": "...", "answer": "..." }, ... ] // optional
// }
app.post("/api/riddle/interact", async (req, res) => {
    try {
        let isLose = false;
        let revealAnswer = false;
        const { playerInput, level, history } = req.body;

        if (!playerInput || !level) {
            return res.status(400).json({
                ok: false,
                error: "playerInput, level wajib diisi"
            });
        }

        if (playerInput.toLowerCase().includes("nyerah")) {
            revealAnswer = true;
            isLose = true;
        } else {
            revealAnswer = req.body.revealAnswer || false;
        }

        const riddle = riddles.find(riddle => riddle.order === level);
        if (!riddle) {
            return res.status(400).json({
                ok: false,
                error: "riddle tidak ditemukan"
            });
        }

        let systemPrompt = `${RIDDLE_UNIFIED_RULES}
            Sekarang pemain berada di level ${level}.
            Jawaban resmi teka-teki ini adalah: "${riddle.answer}".
            Berikut daftar hints untuk teka-teki ini: [${riddle.hints.join(" | ")}] atau kamu boleh memberikan hint lainnya yang sesuai.

            Aturan tambahan khusus jawaban resmi:
            - Gunakan jawaban resmi ini sebagai patokan untuk menentukan apakah input pemain BENAR, SALAH, atau HAMPIR.
            - Jangan sebut jawaban resmi secara eksplisit KECUALI jika reveal_answer = true DAN pemain jelas menyerah atau meminta jawaban.
            - Jika pemain mengetik sesuatu yang sangat mirip (misalnya typo kecil, beda huruf besar/kecil, atau sinonim yang sangat dekat),
            kamu boleh pakai "HAMPIR" dengan penjelasan di message.
            `;
        const messages = [
            { role: "system", content: systemPrompt }
        ];

        // optional: history chat sebelumnya biar konteks nyambung
        if (Array.isArray(history)) {
            history.forEach(turn => {
                if (turn.user) {
                    messages.push({ role: "user", content: turn.user });
                }
                if (turn.assistant) {
                    messages.push({ role: "assistant", content: turn.assistant });
                }
            });
        }

        // User message saat ini
        messages.push({
            role: "user",
            content:
                `Teka-teki: "${riddle.initialHint}".\n` +
                `Input pemain: "${playerInput}".\n` +
                `reveal_answer = ${revealAnswer}.\n` +
                `Ingat: balas HANYA JSON sesuai format yang sudah ditentukan.`
        });
        let raw;
        try {
            const data = await callLLMWithFallback(messages);
            raw = data.content;
            const provider = data.provider;
            console.log("Using provider:", provider);

        } catch (err) {
            return res.json({
                ok: false,
                type: "other",
                result: null,
                message: "Aku sedang kewalahan. Coba lagi beberapa saat."
            });
        }

        // Coba ambil JSON murni dari jawaban (kalau ada teks lain, dipotong)
        let parsed;
        try {
            const firstBrace = raw.indexOf("{");
            const lastBrace = raw.lastIndexOf("}");
            if (firstBrace !== -1 && lastBrace !== -1) {
                const jsonString = raw.slice(firstBrace, lastBrace + 1);
                parsed = JSON.parse(jsonString);
            }
        } catch (parseErr) {
            console.warn("Gagal parse JSON:", parseErr.message);
        }

        if (!parsed || !parsed.type) {
            // fallback: kirim apa adanya
            return res.json({
                ok: true,
                raw,
                warning: "Respon tidak dalam format JSON yang valid, gunakan 'raw'."
            });
        }

        res.json({
            ok: true,
            isLose,
            ...parsed
        });
    } catch (err) {
        console.error("Error /api/riddle/interact:", err.message);
        res.status(500).json({
            ok: false,
            error: "Terjadi kesalahan saat memproses riddle."
        });
    }
});

// Root
app.get("/", (req, res) => {
    res.send("Riddle unified backend with OpenRouter is running.");
});

// Start server
app.listen(PORT, () => {
    console.log(`Riddle backend listening on http://localhost:${PORT}`);
});
