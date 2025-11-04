export async function referenceId(
  filePath: string,
  exportName: string,
): Promise<string> {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error(
      "Web Crypto API (crypto.subtle) is not available in this environment.",
    );
  }

  const encoder = new TextEncoder();
  // Use a NUL separator to avoid collisions like ("ab","c") vs ("a","bc")
  const data = encoder.encode(`${filePath}\0${exportName}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest).toHex();
}
