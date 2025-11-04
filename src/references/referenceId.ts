/**
 * Hash one or more strings using SHA-256
 * Uses NUL separator to avoid collisions like ("ab","c") vs ("a","bc")
 */
async function hashStrings(...parts: string[]): Promise<string> {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error(
      "Web Crypto API (crypto.subtle) is not available in this environment.",
    );
  }

  const encoder = new TextEncoder();
  const joined = parts.join("\0");
  const data = encoder.encode(joined);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest).toHex();
}

export async function referenceId(
  filePath: string,
  exportName: string,
): Promise<string> {
  return await hashStrings(filePath, exportName);
}

/**
 * Compute a top-level ref ID by hashing the declaration name
 */
export async function computeTopLevelRefId(
  refName: string,
): Promise<string> {
  return await hashStrings(refName);
}

/**
 * Compute a nested ref ID by hashing the parentRef with the new ref name
 */
export async function computeNestedRefId(
  parentRefId: string,
  refName: string,
): Promise<string> {
  return await hashStrings(parentRefId, refName);
}
