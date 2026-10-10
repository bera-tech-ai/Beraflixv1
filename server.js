const express = require("express");
const { Readable } = require("stream");

const app = express();
const PORT = process.env.PORT || 7860;

app.set("trust proxy", 1);
app.use(express.json());

const API_MAIN =
  process.env.MOVIE_API_MAIN ||
  "https://apiv1.freehandyflix.online";

const API_DETAILS =
  process.env.MOVIE_API_DETAILS ||
  "https://apii.freehandyflix.online";

const HEADERS = {
  Accept: "application/json, text/plain, */*",
  "User-Agent": "Mozilla/5.0 BERAFLIX/1.0"
};

// Fetch from the upstream movie API.
async function forward(req, res, base, route) {
  const url = new URL(route, base);
  url.search = new URL(
    req.originalUrl,
    "http://localhost"
  ).search;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(url, {
      headers: HEADERS,
      signal: controller.signal,
      redirect: "follow"
    });

    res.status(response.status);

    const type = response.headers.get("content-type");
    if (type) res.setHeader("Content-Type", type);

    if (response.body) {
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error("BERAFLIX API error:", error.message);

    if (!res.headersSent) {
      res.status(error.name === "AbortError" ? 504 : 502).json({
        success: false,
        service: "BERAFLIX",
        error: "Unable to retrieve data from the movie API."
      });
    } else {
      res.destroy(error);
    }
  } finally {
    clearTimeout(timeout);
  }
}

app.get("/health", (req, res) => {
  res.json({ success: true, service: "BERAFLIX" });
});

app.get("/api/config", (req, res) => {
  res.json({
    name: "BERAFLIX",
    maintenanceMode: false
  });
});

// Home and trending
app.get("/api/homepage", (req, res) =>
  forward(req, res, API_MAIN, "/api/homepage")
);

app.get("/api/trending", (req, res) =>
  forward(req, res, API_MAIN, "/api/trending")
);

// Search
app.get("/api/search/:query", (req, res) =>
  forward(
    req,
    res,
    API_MAIN,
    "/api/search/" + encodeURIComponent(req.params.query)
  )
);

// Movie details and playback sources
app.get("/api/info/:movieId", (req, res) =>
  forward(
    req,
    res,
    API_DETAILS,
    "/api/info/" + encodeURIComponent(req.params.movieId)
  )
);

app.get("/api/sources/:movieId", (req, res) =>
  forward(
    req,
    res,
    API_DETAILS,
    "/api/sources/" + encodeURIComponent(req.params.movieId)
  )
);

// Downloads and subtitles
app.get("/api/download/*", (req, res) =>
  forward(
    req,
    res,
    API_DETAILS,
    "/api/download/" + (req.params[0] || "")
  )
);

app.get("/api/subtitles/*", (req, res) =>
  forward(
    req,
    res,
    API_DETAILS,
    "/api/subtitles/" + (req.params[0] || "")
  )
);

// Single-file frontend
app.get("*", (req, res) => {
  res.sendFile(require("path").join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`BERAFLIX running on port ${PORT}`);
});
