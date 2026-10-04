export default function registerShots(app) {
  const SYSTEM = `Tu es réalisateur. Découpe la scène en 6 à 8 plans dont la durée totale est d'environ 60 secondes (chaque plan entre 5 et 12 secondes).
Réponds UNIQUEMENT en JSON : {"shots":[{"number":1,"duration":8,"type":"plan large","action":"","camera":"","light":"","dialogue":"","videoPrompt":""}]}
"videoPrompt" : en anglais, très détaillé (décor, objets, action, expressions, mouvement de caméra, lumière, ambiance, profondeur de champ, continuité avec la scène précédente). Ne redécris pas l'apparence des personnages : elle est ajoutée automatiquement.`;

  app.post("/api/shots", async (req, res) => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return res.status(503).json({ error: "OPENAI_API_KEY n'est pas configurée sur le serveur." });
    const { story, index } = req.body || {};
    const scene = story?.scenes?.[index];
    if (!scene) return res.status(400).json({ error: "Scène introuvable." });

    const present = story.characters.filter(c => (scene.characters || []).includes(c.name));
    const fiches = present.map(c => `${c.name}: ${c.type}. ${c.appearance}. Clothing: ${c.clothing}.`).join(" ");
    const memory = story.scenes.slice(0, index).map(s => `Scène ${s.number} : ${s.summary}`).join("\n") || "Aucune (première scène).";
    const user = `Histoire : ${story.title} — ${story.summary}
Style visuel : ${story.visualStyle || "Animation 3D cartoon"}
Mémoire des scènes précédentes :
${memory}

Scène à découper :
${JSON.stringify(scene)}`;

    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o",
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }]
        })
      });
      const data = await r.json();
      if (!r.ok) return res.status(502).json({ error: data?.error?.message || "Erreur du fournisseur LLM." });
      const parsed = JSON.parse(data.choices[0].message.content);
      if (!Array.isArray(parsed.shots)) throw new Error("Format inattendu");
      const shots = parsed.shots.map(s => ({
        ...s,
        videoPrompt: `${s.videoPrompt} Style: ${story.visualStyle || ""}. Location: ${scene.location}. Characters (fixed visual reference, never change): ${fiches}`
      }));
      const total = shots.reduce((t, s) => t + (Number(s.duration) || 0), 0);
      res.json({ shots, total });
    } catch (e) {
      res.status(500).json({ error: "Génération impossible : " + e.message });
    }
  });
}
