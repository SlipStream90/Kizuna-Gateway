/** Joins truthy class names (the `cn` helper Watermelon components expect). */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}
