import type {
  ActionBinding,
  VisibilityCondition,
} from "@json-render/core";

// ---------------------------------------------------------------------------
// JrxNode — intermediate representation produced by the JSX factory
// ---------------------------------------------------------------------------

/**
 * Sentinel symbol identifying a JrxNode (prevents plain objects from
 * being mistaken for nodes).
 */
export const JRX_NODE = Symbol.for("jrx.node");

/**
 * Sentinel symbol for Fragment grouping.
 */
export const FRAGMENT = Symbol.for("jrx.fragment");

/**
 * A concrete element in the intermediate JSX tree.
 *
 * Created by the `jsx` / `jsxs` factory functions and consumed by `render()`
 * which flattens the tree into a json-render `Spec`.
 *
 * Analogous to React's `ReactElement`.
 */
export interface JrxElement {
  /** Brand symbol — always `JRX_NODE` */
  $$typeof: typeof JRX_NODE;

  /**
   * Component type name (e.g. `"Card"`, `"Button"`).
   * For fragments this is the `FRAGMENT` symbol.
   */
  type: string | typeof FRAGMENT;

  /** Component props (reserved props already extracted) */
  props: Record<string, unknown>;

  /** Child nodes */
  children: JrxElement[];

  // -- Reserved / meta fields (extracted from JSX props) --

  /** Explicit element key (overrides auto-generation) */
  key: string | undefined;

  /** Visibility condition */
  visible: VisibilityCondition | undefined;

  /** Event bindings */
  on: Record<string, ActionBinding | ActionBinding[]> | undefined;

  /** Repeat configuration */
  repeat: { statePath: string; key?: string } | undefined;

  /** State watchers */
  watch: Record<string, ActionBinding | ActionBinding[]> | undefined;
}

/**
 * Any value that can appear as a JSX child or component return value.
 *
 * Analogous to React's `ReactNode` — includes `null` and `undefined`
 * so components can conditionally render nothing.
 */
export type JrxNode = JrxElement | null | undefined;

// ---------------------------------------------------------------------------
// JrxComponent — a function usable as a JSX tag that maps to a type string
// ---------------------------------------------------------------------------

/**
 * A jrx component function. Works like a React function component:
 * when used as a JSX tag (`<Card />`), the factory calls the function
 * with props and gets back a JrxNode (which may be null/undefined).
 */
export type JrxComponent = (props: Record<string, unknown>) => JrxNode;

/**
 * Define a jrx component for use as a JSX tag.
 *
 * Creates a function that, when called with props, produces a JrxNode
 * with the given type name — just like a React component returns
 * React elements.
 *
 * @example
 * ```tsx
 * const Card = component("Card");
 * const spec = render(<Card title="Hello"><Text content="World" /></Card>);
 * ```
 */
export function component(typeName: string): JrxComponent {
  // Import createNodeFromString lazily to avoid circular dep
  // (jsx-runtime imports types). Instead, we build the node inline.
  return (props: Record<string, unknown>): JrxElement => {
    return {
      $$typeof: JRX_NODE,
      type: typeName,
      props: filterReserved(props),
      children: normalizeChildrenRaw(props.children),
      key: props.key != null ? String(props.key) : undefined,
      visible: props.visible as VisibilityCondition | undefined,
      on: props.on as Record<string, ActionBinding | ActionBinding[]> | undefined,
      repeat: props.repeat as { statePath: string; key?: string } | undefined,
      watch: props.watch as Record<string, ActionBinding | ActionBinding[]> | undefined,
    };
  };
}

const RESERVED = new Set(["key", "children", "visible", "on", "repeat", "watch"]);

function filterReserved(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(props)) {
    if (!RESERVED.has(k)) out[k] = props[k];
  }
  return out;
}

function normalizeChildrenRaw(raw: unknown): JrxElement[] {
  if (raw == null || typeof raw === "boolean") return [];
  if (Array.isArray(raw)) {
    const result: JrxElement[] = [];
    for (const child of raw) {
      if (child == null || typeof child === "boolean") continue;
      if (Array.isArray(child)) {
        result.push(...normalizeChildrenRaw(child));
      } else {
        result.push(child as JrxElement);
      }
    }
    return result;
  }
  return [raw as JrxElement];
}

// ---------------------------------------------------------------------------
// render() options
// ---------------------------------------------------------------------------

export interface RenderOptions {
  /** Initial state to include in the Spec output */
  state?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

export function isJrxElement(value: unknown): value is JrxElement {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as JrxElement).$$typeof === JRX_NODE
  );
}

/** @deprecated Use `isJrxElement` instead. */
export const isJrxNode = isJrxElement;
