export function getResponsiveGridItemWidth(
  containerWidth: number,
  columns: number,
  gap: number,
) {
  if (containerWidth <= 0 || columns <= 0) return 0;
  return Math.floor((containerWidth - gap * (columns - 1)) / columns);
}
