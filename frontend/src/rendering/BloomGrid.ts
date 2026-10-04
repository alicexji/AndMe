export const GRID_SPACING = 32

// Match the CSS dot lattice, whose first center is half a cell from the origin.
export function gridAnchor(normalized: number, extent: number) {
  const first = GRID_SPACING / 2
  const last = Math.max(0, Math.floor((extent - first) / GRID_SPACING))
  const cell = Math.max(0, Math.min(last, Math.round((normalized * extent - first) / GRID_SPACING)))
  return first + cell * GRID_SPACING
}
