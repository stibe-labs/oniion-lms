// Test with actual PDF extraction + Ollama (full pipeline simulation)
const fs = require("fs");
const http = require("http");

// Read the textbook PDF and extract text using a simple approach
const pdfPath = "/var/www/stibe-portal/public/uploads/exam-topics/76628f74-3cc5-4ebe-90bf-728bead6f9f1_lemh101__1_.pdf";

// We'll just use the first 4000 chars as the actual pipeline does
const pdfBuffer = fs.readFileSync(pdfPath);

// Quick text extraction by searching for stream content (rough but works for test)
// Actually, let's call the real pipeline via the Next.js API with a proper session
// Instead, let's just test Ollama with a realistic-length prompt

const content = fs.readFileSync(pdfPath, "latin1").replace(/[^\x20-\x7e\n]/g, " ").substring(0, 4000);

const prompt = "You are an expert exam question generator for school students.\nYou are given educational content on a topic - create exam questions that test understanding.\n\nSubject: Mathematics\nGrade: 12\nTopic: Relations and Functions - Full Chapter\n\nContent from uploaded file(s):\n---\n" + content.slice(0, 4000) + "\n---\n\nINSTRUCTIONS FOR TOPIC CONTENT:\n1. Generate exactly 10 MCQs based ONLY on the content provided.\n2. Questions should test understanding, not just memorization.\n3. Mix difficulty: ~30% easy, ~50% medium, ~20% hard.\n4. Each question must be clear, unambiguous, and grade-appropriate.\n\nRULES FOR ALL QUESTIONS:\n- Each question must have exactly 4 options (A, B, C, D).\n- Exactly one option must be correct.\n- Options should be plausible.\n\nOutput Format: Return ONLY a valid JSON array. No markdown, no code fences, no explanation.\n[{\"question_text\":\"The question?\",\"options\":[\"Option A\",\"Option B\",\"Option C\",\"Option D\"],\"correct_answer\":0,\"difficulty\":\"easy\"}]\nGenerate the questions now:";

console.log("Prompt length:", prompt.length, "chars");
console.log("Calling Ollama (10 questions, num_ctx=16384)...");
const start = Date.now();

const postData = JSON.stringify({
  model: "qwen2.5:7b",
  prompt: prompt,
  stream: false,
  options: { temperature: 0.7, num_predict: 8192, num_ctx: 16384 }
});

const req = http.request({
  hostname: "localhost",
  port: 11434,
  path: "/api/generate",
  method: "POST",
  headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) }
}, function(res) {
  let body = "";
  res.on("data", function(chunk) { body += chunk; });
  res.on("end", function() {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    try {
      const resp = JSON.parse(body);
      console.log("Done in " + elapsed + "s, response: " + (resp.response ? resp.response.length : 0) + " chars");
      
      var jsonStr = resp.response.trim();
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      var m = jsonStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (m) jsonStr = m[0];
      jsonStr = jsonStr.replace(/,\s*([\]\}])/g, "$1");
      
      var questions = JSON.parse(jsonStr);
      console.log("SUCCESS: " + questions.length + " questions parsed");
      questions.forEach(function(q, i) {
        console.log("  Q" + (i+1) + " [" + q.difficulty + "]: " + q.question_text.substring(0, 80));
      });
    } catch(e) {
      console.error("PARSE FAILED:", e.message);
      if (body.length > 500) {
        try {
          var resp2 = JSON.parse(body);
          console.error("Raw AI response (first 800):", resp2.response.substring(0, 800));
        } catch(e2) {
          console.error("Raw body (first 800):", body.substring(0, 800));
        }
      } else {
        console.error("Raw body:", body);
      }
    }
  });
});

req.setTimeout(300000, function() { console.error("TIMEOUT after 5min"); req.destroy(); });
req.on("error", function(e) { console.error("Fetch error:", e.message); });
req.write(postData);
req.end();
