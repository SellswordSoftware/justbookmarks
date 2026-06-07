import { createApp } from "./app/create-app.js";

const params = new URL(window.location.href).searchParams;
const testMode = params.get("test");

if (testMode === "json" || testMode === "html") {
  await import("../tests/browser/run.js");
} else {
  const root = document.getElementById("app");

  if (!root) {
    throw new Error("App root #app was not found");
  }

  createApp(root);
}
