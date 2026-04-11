export * from "./types";
export { buildCampamentoBaseSnapshot } from "./snapshot";
export { answerQuestion } from "./qa";

export async function ask(query: string) {
  const { buildCampamentoBaseSnapshot } = await import("./snapshot");
  const snapshot = await buildCampamentoBaseSnapshot();
  const { answerQuestion } = await import("./qa");
  return answerQuestion(query, snapshot);
}
