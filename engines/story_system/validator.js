function getCharacterNames(characters) {
  return Object.values(characters)
    .map(c => c.personality?.name)
    .filter(Boolean)
}

export function validate(scene, state, characters) {
  const violations = []

  const knownNames = getCharacterNames(characters)

  const words = scene.split(/\s+/)

// common capitalized words to ignore
const ignoreWords = new Set([
  "The","A","An","And","But","Or","So","Because",
  "She","He","They","Her","His","Their",
  "In","On","At","With","From","To","Of","As","By",
  "It","This","That","These","Those",
  "Across","Another","Yet","Some","Then","When","While"
])


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