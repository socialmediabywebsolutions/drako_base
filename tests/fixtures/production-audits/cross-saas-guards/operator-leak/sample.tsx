export async function loadMentoriaHealthDirectly() {
  return fetch("/api/mentoria/health/system");
}
