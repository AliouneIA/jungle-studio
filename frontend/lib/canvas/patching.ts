export type PatchOperation = {
  op: 'replace' | 'insert' | 'delete'
  start: number
  end: number
  text?: string
}

export function applyPatch(content: string, operations: PatchOperation[]): string {
  let newContent = content

  // On trie les opérations par index de fin décroissant pour éviter que les décalages
  // d'index n'affectent les opérations suivantes si elles sont appliquées séquentiellement.
  // Note: Pour des opérations simples générées par l'IA, on suppose qu'elles sont cohérentes.
  const sortedOps = [...operations].sort((a, b) => b.start - a.start)

  for (const op of sortedOps) {
    const { op: type, start, end, text = '' } = op

    if (start < 0 || end < start || start > newContent.length) {
      console.error('Invalid operation range:', op, 'Content length:', newContent.length)
      continue
    }

    // Sécurité supplémentaire sur end pour éviter les débordements si le contenu a changé
    const safeEnd = Math.min(end, newContent.length)

    if (type === 'replace') {
      newContent = newContent.substring(0, start) + text + newContent.substring(safeEnd)
    } else if (type === 'insert') {
      newContent = newContent.substring(0, start) + text + newContent.substring(start)
    } else if (type === 'delete') {
      newContent = newContent.substring(0, start) + newContent.substring(safeEnd)
    }
  }

  return newContent
}
