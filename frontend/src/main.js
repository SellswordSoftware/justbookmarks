// @ts-check

import "./styles/app.css";
import { createApp } from "./app/create-app.js";

const root = document.getElementById("app");

if (!root) {
  throw new Error("App root #app was not found");
}

createApp(root);
