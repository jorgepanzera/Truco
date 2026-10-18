// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { App } from "../src/App.js";

describe("pantalla inicial", () => {
  it("muestra el título y el estado de preparación", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    try {
      await act(async () => root.render(<App />));
      expect(container.querySelector("h1")?.textContent).toBe("Truco Uruguayo");
      expect(container.textContent).toContain("En preparación");
    } finally {
      await act(async () => root.unmount());
      container.remove();
      delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    }
  });
});
