const IGNORE_WORDS = new Set([
  "He","She","It","They","We","You","I",
  "Meanwhile","Still","Then","Now","Here","There"
])

export function validate(rawScene, tokenToName) {
  const violations = []
  const validTokens = new Set(Object.keys(tokenToName))

  const forbidden = [
    "suddenly appeared","out of nowhere","a creature emerged",
    "they realized what it was","the source was revealed"
  ]
  forbidden.forEach(f => {
    if (rawScene.toLowerCase().includes(f)) violations.push(`Forbidden phrase: "${f}"`)
  })

  // Check for unknown CHARACTER_XXX tokens
  const usedTokens = new Set(rawScene.match(/CHARACTER_\d+/g) || [])
  usedTokens.forEach(token => {
    if (!validTokens.has(token)) violations.push(`Unknown token: "${token}"`)
  })

  // Check real names didn't leak back into output
  Object.values(tokenToName).forEach(name => {
    if (rawScene.includes(name)) violations.push(`Real name leaked: "${name}"`)
  })

  return { valid: violations.length === 0, violations }
}