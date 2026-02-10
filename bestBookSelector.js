function selectBestBooks(edges) {
  const bestMap = {}

  edges.forEach(edge => {
    if (!edge.odds || edge.book === 'prizepicks') return

    const key = `${edge.player}-${edge.prop}-${edge.line}`

    if (!bestMap[key] || edge.edge > bestMap[key].edge) {
      bestMap[key] = edge
    }
  })

  return Object.values(bestMap)
}

module.exports = { selectBestBooks }
