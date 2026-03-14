import type { Spec, UIElement } from "@json-render/core";
import { FRAGMENT, type JrxElement, type JrxNode, type RenderOptions, isJrxElement } from "./types";

/**
 * Flatten a JrxNode tree into a json-render `Spec`.
 *
 * Analogous to `ReactDOM.render` but produces JSON instead of DOM mutations.
 *
 * @param node  - Root JrxNode (produced by JSX)
 * @param options - Optional render configuration (e.g. initial state)
 * @returns A json-render `Spec` ready for any renderer
 *
 * @example
 * ```tsx
 * const spec = render(
 *   <Card title="Hello">
 *     <Text content="World" />
 *   </Card>,
 *   { state: { count: 0 } }
 * );
 * ```
 */
export function render(node: JrxNode, options?: RenderOptions): Spec {
  if (!isJrxElement(node)) {
    throw new Error("render() expects a JrxElement produced by JSX.");
  }

  if (node.type === FRAGMENT) {
    throw new Error(
      "render() requires a single root element. Fragments cannot be used at the root level.",
    );
  }

  const counters = new Map<string, number>();
  const elements: Record<string, UIElement> = {};
  const usedKeys = new Set<string>();

  const rootKey = flattenNode(node, elements, counters, usedKeys);

  const spec: Spec = { root: rootKey, elements };

  if (options?.state) {
    spec.state = options.state;
  }

  return spec;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Generate a unique key for a node based on its type.
 * Pattern: `{lowercase-type}-{counter}` (e.g. `card-1`, `card-2`).
 */
function generateKey(
  type: string,
  counters: Map<string, number>,
): string {
  const base = type.toLowerCase();
  const count = (counters.get(base) ?? 0) + 1;
  counters.set(base, count);
  return `${base}-${count}`;
}

/**
 * Resolve the children of a node, expanding fragments inline.
 * Returns an array of concrete (non-fragment) JrxElements.
 */
function expandChildren(children: JrxElement[]): JrxElement[] {
  const result: JrxElement[] = [];
  for (const child of children) {
    if (!isJrxElement(child)) continue;
    if (child.type === FRAGMENT) {
      // Recursively expand nested fragments
      result.push(...expandChildren(child.children));
    } else {
      result.push(child);
    }
  }
  return result;
}

/**
 * Recursively flatten a JrxElement into the elements map.
 * Returns the key assigned to this node.
 */
function flattenNode(
  node: JrxElement,
  elements: Record<string, UIElement>,
  counters: Map<string, number>,
  usedKeys: Set<string>,
): string {
  // Determine key
  const key = node.key ?? generateKey(node.type as string, counters);

  if (usedKeys.has(key)) {
    throw new Error(
      `Duplicate element key "${key}". Keys must be unique within a single render() call.`,
    );
  }
  usedKeys.add(key);

  // Expand fragment children and recursively flatten
  const concreteChildren = expandChildren(node.children);
  const childKeys: string[] = [];

  for (const child of concreteChildren) {
    const childKey = flattenNode(child, elements, counters, usedKeys);
    childKeys.push(childKey);
  }

  // Build the UIElement
  const element: UIElement = {
    type: node.type as string,
    props: node.props,
  };

  if (childKeys.length > 0) {
    element.children = childKeys;
  }

  if (node.visible !== undefined) {
    element.visible = node.visible;
  }

  if (node.on !== undefined) {
    element.on = node.on;
  }

  if (node.repeat !== undefined) {
    element.repeat = node.repeat;
  }

  if (node.watch !== undefined) {
    element.watch = node.watch;
  }

  elements[key] = element;

  return key;
}
