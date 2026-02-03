const express = require("express");

const app = express();
app.use(express.json({ limit: "25mb" }));

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/sync", (req, res) => {
  console.log("SYNC called", new Date().toISOString());
  res.json({ ok: true, message: "Worker online" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`nfe-worker listening on ${port}`));
