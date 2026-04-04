function getCharacterNames(characters) {
  return Object.values(characters)
    .map(c => c.personality?.name)
    .filter(Boolean)
}

export function validate(scene, state, characters) {
  const violations = []

  const knownNames = getCharacterNames(characters)

  const words = scene.split(/\s+/)

  words.forEach(word => {
    if (/^[A-Z][a-z]+$/.test(word) && !knownNames.includes(word)) {
      violations.push(`Unknown name: ${word}`)
    }
  })

  const forbidden = [
    "suddenly appeared",
    "out of nowhere",
    "a creature emerged",
    "they realized what it was",
    "the source was revealed"
  ]

  forbidden.forEach(f => {
    if (scene.toLowerCase().includes(f)) {
      violations.push(`Forbidden: ${f}`)
    }
  })

  return {
    valid: violations.length === 0,
    violations
  }
}