export const normalizePin = (pin) => String(pin ?? "").trim();

const encodeHex = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export const hashPin = async (pin) => {
  const normalized = normalizePin(pin);
  if (!normalized) return "";
  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure hashing is not available in this browser.");
  }
  const data = new TextEncoder().encode(normalized);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return encodeHex(digest);
};

export const verifyPin = async (inputPin, expectedHash) => {
  const normalizedHash = String(expectedHash ?? "").trim().toLowerCase();
  if (!normalizedHash) return false;
  const inputHash = await hashPin(inputPin);
  return inputHash.toLowerCase() === normalizedHash;
};
