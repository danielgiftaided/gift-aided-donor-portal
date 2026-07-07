// k-anonymity HIBP check — the full password never leaves the browser.
// Only the first 5 characters of its SHA-1 hash are sent to the API.
export async function isPasswordBreached(password: string): Promise<boolean> {
  try {
    const msgBuffer = new TextEncoder().encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
    const prefix = hashHex.slice(0, 5)
    const suffix = hashHex.slice(5)
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`)
    if (!response.ok) return false
    const text = await response.text()
    return text.split('\n').some(line => line.startsWith(suffix))
  } catch {
    return false
  }
}

export const PASSWORD_MIN_LENGTH = 12

export function passwordStrengthMessage(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
  if (!/[A-Z]/.test(password)) return 'Include at least one uppercase letter.'
  if (!/[a-z]/.test(password)) return 'Include at least one lowercase letter.'
  if (!/[0-9]/.test(password)) return 'Include at least one number.'
  return null
}
