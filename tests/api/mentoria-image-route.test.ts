import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/mentoria/session/image/route";

describe("mentoria image preparation route", () => {
  it("accepts a real image payload and returns a prepared asset", async () => {
    const form = new FormData();
    form.append("image", new File([new Uint8Array([137, 80, 78, 71])], "exercise.png", { type: "image/png" }));
    form.append("notes", "Foto del ejercicio de fracciones para interpretacion futura.");

    const response = await POST(
      new Request("https://mentoria.drako.systems/api/mentoria/session/image", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      image: {
        contentType: "image/png",
        status: "received_for_future_interpretation",
        summary: "Foto del ejercicio de fracciones para interpretacion futura.",
      },
    });
  });

  it("rejects non-image uploads", async () => {
    const form = new FormData();
    form.append("image", new File(["plain text"], "notes.txt", { type: "text/plain" }));

    const response = await POST(
      new Request("https://mentoria.drako.systems/api/mentoria/session/image", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "IMAGE_TYPE_NOT_SUPPORTED",
    });
  });
});
