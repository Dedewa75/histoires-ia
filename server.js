import express from "express";
import registerShots from "./shots.js";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));
registerShots(app);

const SYSTEM = `Tu es un scénariste. À partir d'une simple idée, écris UNE histoire continue d'environ 15 minutes en exactement 15 scènes d'environ 1 minute.
L'histoire a : introduction, personnages, objectif, problèmes, conflits, rebondissements, progression, climax, conclusion émotionnelle.
Les scènes s'enchaînent : chacune connaît les précédentes. Écris en français.
Réponds UNIQUEMENT en JSON valide, sans texte autour, avec ce format :
{"title":"","summary":"","setting":"","era":"","visualStyle":"",
"characters":[{"name":"","type":"","appearance":"","personality":"","clothing":""}],
"scenes":[{"number":1,"title":"","summary":"","goal":"","characters":[""],"location":"","action":"","dialogue":"","narration":"","emotion":"","transition":""}]}
"appearance" doit être précise (couleurs, taille, visage, accessoires) : elle servira de référence permanente.`;

app.post("/api/story", async (req, res) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(503).json({ error: "OPENAI_API_KEY n'est pas configurée sur le serveur." });
  const { idea, style } = req.body || {};
  if (!idea || idea.trim().length < 5) return res.status(400).json({ error: "Écris une idée un peu plus longue." });
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Idée : ${idea}\nStyle visuel : ${style || "Animation 3D cartoon"}` }
        ]
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || "Erreur du fournisseur LLM." });
    const story = JSON.parse(data.choices[0].message.content);
    if (!Array.isArray(story.scenes) || !Array.isArray(story.characters)) throw new Error("Format inattendu");
    res.json(story);
  } catch (e) {
    res.status(500).json({ error: "Génération impossible : " + e.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log("Serveur prêt"));
