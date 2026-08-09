const WIKIPEDIA_SUMMARY_URL = "https://es.wikipedia.org/api/rest_v1/page/summary";

// API pública de Wikipedia (REST Summary), sin autenticación. Nunca lanza — null en
// cualquier fallo de red/parseo o si la página no existe (404, el caso normal para un
// placeName que Wikipedia no tiene, ej. un negocio pequeño sin artículo propio). Si
// placeName es una ciudad grande, el extract sale genérico — se acepta a propósito (ver
// Sprint I): mejor un contexto genérico del lugar que ninguno.
export async function getWikipediaContext(placeName: string): Promise<string | null> {
  if (!placeName.trim()) return null;

  try {
    const url = `${WIKIPEDIA_SUMMARY_URL}/${encodeURIComponent(placeName.trim())}`;
    const res = await fetch(url);
    if (!res.ok) {
      // 404 es el resultado normal cuando no hay artículo para este lugar — no es un
      // error real, solo no hay contexto que añadir.
      if (res.status !== 404) {
        console.error("WIKIPEDIA_SUMMARY_HTTP_ERROR", res.status);
      }
      return null;
    }

    const data = (await res.json()) as { extract?: string };
    return typeof data.extract === "string" && data.extract.trim() ? data.extract.trim() : null;
  } catch (error) {
    console.error("WIKIPEDIA_SUMMARY_FAILED", error);
    return null;
  }
}
