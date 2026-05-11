export async function loadSessionsFromAnotherProduct() {
  return fetch("/api/mentoria/sessions");
}
