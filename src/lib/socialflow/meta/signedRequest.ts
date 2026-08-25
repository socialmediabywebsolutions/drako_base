/**
 * Verificador del signed_request que Meta manda a los callbacks de Deauthorize y
 * Data Deletion Request — formato estándar de Facebook/Meta Platform, NO el mismo
 * esquema que verifyMetaSignature en conversations/inbound/route.ts (esa firma va en
 * la cabecera X-Hub-Signature-256 sobre el body crudo; esta va embebida en el propio
 * valor `signed_request`, con la firma y el payload codificados juntos en base64url).
 *
 * Formato: "<firma_base64url>.<payload_base64url>" — la firma es HMAC-SHA256 de la
 * porción de payload (el string base64url, no el JSON decodificado) usando el App
 * Secret como clave.
 */

function base64UrlToBase64(input: string): string {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return base64;
}

function base64UrlDecode(input: string): Uint8Array {
  const binary = atob(base64UrlToBase64(input));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export type MetaSignedRequestPayload = {
  algorithm: string;
  issued_at: number;
  user_id: string;
  [key: string]: unknown;
};

export type VerifySignedRequestResult =
  | { ok: true; payload: MetaSignedRequestPayload }
  | { ok: false; error: string };

// Nunca lanza — cualquier fallo de parseo/verificación se traduce a { ok: false }, para
// que el caller siempre pueda devolver una respuesta HTTP válida (Meta reintenta si
// el endpoint da error 5xx, así que un fallo de verificación debe ser un 4xx normal,
// no una excepción sin capturar).
export async function verifyMetaSignedRequest(
  signedRequest: string,
  appSecret: string,
): Promise<VerifySignedRequestResult> {
  if (!signedRequest.trim() || !appSecret.trim()) {
    return { ok: false, error: "signedRequest and appSecret are required" };
  }

  const parts = signedRequest.split(".");
  if (parts.length !== 2) {
    return { ok: false, error: "Malformed signed_request (expected 2 parts)" };
  }
  const [encodedSig, encodedPayload] = parts;

  let payload: MetaSignedRequestPayload;
  try {
    const decoded = base64UrlDecode(encodedPayload);
    const parsed: unknown = JSON.parse(new TextDecoder().decode(decoded));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "Payload is not a JSON object" };
    }
    payload = parsed as MetaSignedRequestPayload;
  } catch {
    return { ok: false, error: "Invalid payload encoding" };
  }

  if (payload.algorithm !== "HMAC-SHA256") {
    return { ok: false, error: `Unsupported algorithm: ${String(payload.algorithm)}` };
  }
  if (typeof payload.user_id !== "string" || !payload.user_id.trim()) {
    return { ok: false, error: "Missing user_id in payload" };
  }

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = base64UrlDecode(encodedSig);
  } catch {
    return { ok: false, error: "Invalid signature encoding" };
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes as BufferSource,
    encoder.encode(encodedPayload),
  );

  if (!valid) {
    return { ok: false, error: "Signature mismatch" };
  }

  return { ok: true, payload };
}
