const express = require("express");
const path = require("path");
const fs = require("fs");
const morgan = require("morgan");

const app = express();
app.use(morgan("dev"));
app.use(express.json());

// serve client static files
app.use("/", express.static(path.join(__dirname, "..", "client")));

const { generate } = require("./app/generate");

app.post("/api/generate", (req, res) => {
  try {
    const payload = generate({
      prompt: req.body?.prompt,
      sessionId: req.body?.sessionId,
    });
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message || "generation failed" });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () =>
  console.log("server-v2 listening on http://localhost:" + port)
);
