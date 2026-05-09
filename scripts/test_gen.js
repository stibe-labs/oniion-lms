const http = require("http");

const content = "Relations and Functions. A relation R from set A to set B is a subset of AxB. A function f from A to B maps every element in A to exactly one element in B. Types of relations: reflexive, symmetric, transitive. An equivalence relation is reflexive, symmetric, and transitive. Types of functions: one-one (injective), onto (surjective), both (bijective). Composition of functions: (fog)(x) = f(g(x)).";

const prompt = "You are an expert exam question generator.\nSubject: Mathematics\nGrade: 12\nTopic: Relations and Functions\n\nContent:\n" + content + "\n\nGenerate exactly 5 MCQs. Return ONLY a valid JSON array.\n[{\"question_text\":\"...\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correct_answer\":0,\"difficulty\":\"medium\"}]\nGenerate now:";

console.log("Prompt length:", prompt.length);
console.log("Calling Ollama with num_ctx=16384...");
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
      console.log("SUCCESS: " + questions.length + " questions");
      questions.forEach(function(q, i) {
        console.log("  Q" + (i+1) + ": " + q.question_text.substring(0, 80));
      });
    } catch(e) {
      console.error("FAILED:", e.message);
      if (body.length < 2000) {
        console.error("Body:", body);
      } else {
        console.error("Body (first 800):", body.substring(0, 800));
      }
    }
  });
});

req.setTimeout(300000, function() { console.error("TIMEOUT"); req.destroy(); });
req.on("error", function(e) { console.error("Error:", e.message); });
req.write(postData);
req.end();
