// Request flow (steps 1 & 8 happen in quiz.html):
// 1. Frontend sends request → 2. Express receives → 3. Middleware → 4. Route runs
// → 5. askGemini() calls API → 6. Response comes back → 7. Send to frontend → 8. UI updates

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// 3. Middleware processes it (runs on every request before your routes)
app.use(cors()); // allow browser requests from the page
app.use(express.json()); // parse JSON body from frontend into req.body
app.use(express.static(path.join(__dirname), { index: "quiz.html" })); // serve quiz.html and assets

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyA3qdIytJQn7eTGD3jTn8eqfvi4GGdNQQk";
const QUIZ_QUESTION_COUNT = 5;

const GEMINI_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];
const RETRY_DELAYS_MS = [2000, 4000, 8000, 12000];
const MAX_ATTEMPTS_PER_MODEL = RETRY_DELAYS_MS.length + 1;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(status, data) {
  const msg = (data?.error?.message || "").toLowerCase();
  const code = data?.error?.code;
  const statusStr = (data?.error?.status || "").toUpperCase();

  if ([503, 429, 500, 502, 504].includes(status)) return true;
  if (code === 503 || code === 429) return true;
  if (statusStr === "UNAVAILABLE" || statusStr === "RESOURCE_EXHAUSTED") return true;

  return (
    msg.includes("high demand") ||
    msg.includes("overloaded") ||
    msg.includes("try again") ||
    msg.includes("resource has been exhausted") ||
    msg.includes("quota")
  );
}

// 5. askGemini() calls API — low-level fetch to Google's Gemini endpoint
async function callGeminiModel(model, prompt, temperature) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature },
      }),
    }
  );

  const data = await response.json();
  return { response, data, model };
}

// 5. askGemini() calls API (with retries / fallback models)
async function askGemini(prompt, temperature = 0.4) {
  let lastError = null;

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_MODEL; attempt++) {
      const { response, data } = await callGeminiModel(model, prompt, temperature);

      if (response.ok) {
        // 6. Response comes back — extract text from Gemini's JSON payload
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (text) return text;
        lastError = { status: 500, data: { error: { message: "Empty response from Gemini" } } };
      } else {
        console.error(`Gemini ${model} attempt ${attempt + 1}:`, data?.error?.message || response.status);
        lastError = { status: response.status, data };

        if (!isRetryableError(response.status, data)) {
          break;
        }

        if (attempt < MAX_ATTEMPTS_PER_MODEL - 1) {
          const delay = RETRY_DELAYS_MS[attempt] || 12000;
          console.log(`Retrying ${model} in ${delay}ms...`);
          await sleep(delay);
        }
      }
    }
  }

  const err = new Error("Gemini API error");
  err.status = lastError?.status || 503;
  err.data = lastError?.data || { error: { message: "All models busy. Please try again in a minute." } };
  throw err;
}

function reconcileGradeScore(gradeText, questionCount) {
  const correctCount = (gradeText.match(/^Q\d+:\s*Correct\b/gim) || []).length;

  if (correctCount > 0) {
    const scoreLine = `SCORE: ${correctCount}/${questionCount}`;
    const fixedText = /SCORE:\s*\d+\s*\/\s*\d+/i.test(gradeText)
      ? gradeText.replace(/SCORE:\s*\d+\s*\/\s*\d+/i, scoreLine)
      : scoreLine + "\n" + gradeText;
    return { text: fixedText, score: correctCount };
  }

  const match = gradeText.match(new RegExp(`SCORE:\\s*(\\d+)\\s*\\/\\s*${questionCount}`, "i"));
  const score = match ? parseInt(match[1], 10) : 0;
  return { text: gradeText, score };
}

// 2. Express receives it — POST /generate (after step 1: frontend fetch in quiz.html)
app.post("/generate", async (req, res) => {
  // 4. Your route runs — read parsed body, validate, build prompt
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "No text provided" });
  }

  const prompt = `You are a quiz master. Based ONLY on the study materials below, generate exactly ${QUIZ_QUESTION_COUNT} multiple choice questions. Each question must have exactly 4 options labeled a), b), c), and d). Number questions 1 through ${QUIZ_QUESTION_COUNT}.

STUDY MATERIALS:
${text}`;

  try {
    const output = await askGemini(prompt, 0.4);
    // 7. You send it to frontend (step 8: quiz.html updates #output / #status)
    res.json({ result: output });
  } catch (err) {
    if (err.data) return res.status(503).json(err.data);
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// 2. Express receives it — POST /grade (after step 1: frontend submitAnswers() fetch)
app.post("/grade", async (req, res) => {
  // 4. Your route runs — read quiz + answers, validate, build grading prompt
  const { quiz, answers } = req.body;

  if (!quiz) {
    return res.status(400).json({ error: "No quiz provided" });
  }

  if (!Array.isArray(answers) || answers.length !== QUIZ_QUESTION_COUNT) {
    return res.status(400).json({ error: `Exactly ${QUIZ_QUESTION_COUNT} answers (A–D) required` });
  }

  const invalid = answers.some((a) => !/^[ABCD]$/.test(a));
  if (invalid) {
    return res.status(400).json({ error: "Each answer must be A, B, C, or D" });
  }

  const answerLines = answers.map((a, i) => `Question ${i + 1}: ${a}`).join("\n");

  const prompt = `You are grading a multiple-choice quiz. Use the quiz below to determine the correct answer for each question (only one correct option per question: A, B, C, or D — map a)/b)/c)/d) options to A/B/C/D).

QUIZ:
${quiz}

STUDENT ANSWERS:
${answerLines}

Grade all ${QUIZ_QUESTION_COUNT} questions. Your response MUST start with a single line in this exact format:
SCORE: X/${QUIZ_QUESTION_COUNT}
(where X MUST equal the exact number of "Correct" lines in your breakdown — count carefully)

Then give a breakdown with exactly ${QUIZ_QUESTION_COUNT} lines, one per question:
"Q1: Correct" or "Q2: Incorrect (you: B, correct: C)".
End with one encouraging sentence.`;

  try {
    const output = await askGemini(prompt, 0.2);
    const { text, score } = reconcileGradeScore(output, QUIZ_QUESTION_COUNT);
    // 7. You send it to frontend (step 8: quiz.html updates #gradeOutput / #gradeStatus)
    res.json({ result: text, score });
  } catch (err) {
    if (err.data) return res.status(503).json(err.data);
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000/quiz.html");
});
