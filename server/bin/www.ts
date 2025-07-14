#!/usr/bin/env node

import app from "../app";
import debugLib from "debug";
import https from "https";
import fs from "fs";
import path from "path";

const debug = debugLib("server:server");

const options = {
  key: fs.readFileSync(path.join(__dirname, "../certs/key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "../certs/cert.pem")),
};

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

console.log("Starting server...");
const port = normalizePort(process.env.PORT || "5000");
const server = https.createServer(options, app);

console.log(`Attempting to listen on port ${port}...`);
server.listen(Number(port), "0.0.0.0", () => {
  console.log(`Server is running on https://0.0.0.0:${port}`);
});
server.on("error", onError);
server.on("listening", onListening);

function normalizePort(val: string) {
  const port = parseInt(val, 10);
  if (isNaN(port)) return val;
  if (port >= 0) return port;
  return false;
}

function onError(error: NodeJS.ErrnoException) {
  if (error.syscall !== "listen") throw error;
  const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening() {
  const addr = server.address();
  const bind =
    typeof addr === "string" ? "pipe " + addr : "port " + (addr?.port || port);
  console.log("Listening on " + bind);
  debug("Listening on " + bind);
}
