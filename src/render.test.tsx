import { describe, it, expect } from "bun:test";
import { render } from "./render";
import { FRAGMENT, type JrxNode } from "./types";
import { jsx } from "./jsx-runtime";
import {
  Stack,
  Card,
  Text,
  Button,
  Badge,
  List,
  ListItem,
  Select,
} from "./test-components";

// =============================================================================
// render() — basic output shape
// =============================================================================

describe("render() output shape", () => {
  it("produces a Spec with root and elements", () => {
    const spec = render(<Card title="Hello" />);
    expect(spec.root).toBeDefined();
    expect(spec.elements).toBeDefined();
    expect(typeof spec.root).toBe("string");
    expect(typeof spec.elements).toBe("object");
  });

  it("root key points to an existing element", () => {
    const spec = render(<Card />);
    expect(spec.elements[spec.root]).toBeDefined();
  });

  it("single element has correct type and props", () => {
    const spec = render(<Button label="Click" />);
    const el = spec.elements[spec.root];
    expect(el.type).toBe("Button");
    expect(el.props).toEqual({ label: "Click" });
  });

  it("single element without children omits children field", () => {
    const spec = render(<Text content="hi" />);
    const el = spec.elements[spec.root];
    expect(el.children).toBeUndefined();
  });
});

// =============================================================================
// Key auto-generation
// =============================================================================

describe("key auto-generation", () => {
  it("generates keys from lowercase type name", () => {
    const spec = render(<Card />);
    expect(spec.root).toBe("card-1");
  });

  it("increments counter for same type", () => {
    const spec = render(
      <Stack>
        <Card title="A" />
        <Card title="B" />
      </Stack>,
    );
    const childKeys = spec.elements[spec.root].children!;
    expect(childKeys).toEqual(["card-1", "card-2"]);
  });

  it("uses separate counters per type", () => {
    const spec = render(
      <Stack>
        <Card />
        <Text />
        <Card />
      </Stack>,
    );
    const childKeys = spec.elements[spec.root].children!;
    expect(childKeys).toEqual(["card-1", "text-1", "card-2"]);
  });

  it("counter resets between render() calls", () => {
    const spec1 = render(<Card />);
    const spec2 = render(<Card />);
    expect(spec1.root).toBe("card-1");
    expect(spec2.root).toBe("card-1");
  });
});

// =============================================================================
// Explicit key override
// =============================================================================

describe("explicit key override", () => {
  it("uses explicit key when provided", () => {
    const spec = render(<Card key="main-card" />);
    expect(spec.root).toBe("main-card");
  });

  it("explicit key does not appear in props", () => {
    const spec = render(<Card title="Hi" key="my-card" />);
    const el = spec.elements["my-card"];
    expect(el.props).toEqual({ title: "Hi" });
    expect((el.props as Record<string, unknown>).key).toBeUndefined();
  });

  it("throws on duplicate explicit keys", () => {
    expect(() =>
      render(
        <Stack>
          <Card key="same" />
          <Text key="same" />
        </Stack>,
      ),
    ).toThrow(/Duplicate element key "same"/);
  });

  it("throws when explicit key collides with auto-generated key", () => {
    expect(() =>
      render(
        <Stack>
          <Card />
          <Button key="card-1" />
        </Stack>,
      ),
    ).toThrow(/Duplicate element key "card-1"/);
  });
});

// =============================================================================
// Nested children
// =============================================================================

describe("nested children", () => {
  it("flattens a two-level tree", () => {
    const spec = render(
      <Card title="Root">
        <Text content="Child" />
      </Card>,
    );

    expect(Object.keys(spec.elements)).toHaveLength(2);
    expect(spec.elements[spec.root].children).toEqual(["text-1"]);
    expect(spec.elements["text-1"].type).toBe("Text");
    expect(spec.elements["text-1"].props).toEqual({ content: "Child" });
  });

  it("flattens a deep tree", () => {
    const spec = render(
      <Stack>
        <Card title="A">
          <Text content="Nested" />
        </Card>
        <Button label="Click" />
      </Stack>,
    );

    expect(Object.keys(spec.elements)).toHaveLength(4);
    expect(spec.elements["stack-1"].children).toEqual(["card-1", "button-1"]);
    expect(spec.elements["card-1"].children).toEqual(["text-1"]);
    expect(spec.elements["text-1"].children).toBeUndefined();
    expect(spec.elements["button-1"].children).toBeUndefined();
  });

  it("all child keys reference existing elements", () => {
    const spec = render(
      <Stack>
        <Card>
          <Text />
          <Badge />
        </Card>
        <Button />
      </Stack>,
    );

    for (const el of Object.values(spec.elements)) {
      if (el.children) {
        for (const childKey of el.children) {
          expect(spec.elements[childKey]).toBeDefined();
        }
      }
    }
  });
});

// =============================================================================
// Fragment support
// =============================================================================

describe("fragments", () => {
  it("expands fragment children inline", () => {
    const spec = render(
      <Stack>
        <>
          <Text content="A" />
          <Text content="B" />
        </>
      </Stack>,
    );

    expect(spec.elements["stack-1"].children).toEqual(["text-1", "text-2"]);
    expect(Object.keys(spec.elements)).toHaveLength(3);
  });

  it("expands nested fragments", () => {
    const spec = render(
      <Stack>
        <>
          <>
            <Text content="Deep" />
          </>
        </>
      </Stack>,
    );

    expect(spec.elements["stack-1"].children).toEqual(["text-1"]);
  });

  it("throws when fragment is at root", () => {
    expect(() =>
      render(
        <>
          <Card />
          <Text />
        </>,
      ),
    ).toThrow(/single root element/);
  });
});

// =============================================================================
// Reserved prop extraction
// =============================================================================

describe("reserved prop extraction", () => {
  it("places visible on UIElement, not in props", () => {
    const condition = { $state: "/show" };
    const spec = render(<Text content="hi" visible={condition} />);
    const el = spec.elements[spec.root];
    expect(el.visible).toEqual(condition);
    expect((el.props as Record<string, unknown>).visible).toBeUndefined();
  });

  it("places on bindings on UIElement, not in props", () => {
    const onBindings = { press: { action: "submit" } };
    const spec = render(<Button label="Go" on={onBindings} />);
    const el = spec.elements[spec.root];
    expect(el.on).toEqual(onBindings);
    expect((el.props as Record<string, unknown>).on).toBeUndefined();
  });

  it("places repeat on UIElement, not in props", () => {
    const repeatConfig = { statePath: "/items", key: "id" };
    const spec = render(
      <List repeat={repeatConfig}>
        <ListItem />
      </List>,
    );
    const el = spec.elements[spec.root];
    expect(el.repeat).toEqual(repeatConfig);
    expect((el.props as Record<string, unknown>).repeat).toBeUndefined();
  });

  it("places watch on UIElement, not in props", () => {
    const watchConfig = { "/country": { action: "loadCities" } };
    const spec = render(<Select watch={watchConfig} />);
    const el = spec.elements[spec.root];
    expect(el.watch).toEqual(watchConfig);
    expect((el.props as Record<string, unknown>).watch).toBeUndefined();
  });

  it("omits undefined meta fields from UIElement", () => {
    const spec = render(<Text content="plain" />);
    const el = spec.elements[spec.root];
    expect("visible" in el).toBe(false);
    expect("on" in el).toBe(false);
    expect("repeat" in el).toBe(false);
    expect("watch" in el).toBe(false);
  });
});

// =============================================================================
// State passthrough
// =============================================================================

describe("state passthrough", () => {
  it("includes state in Spec when provided", () => {
    const state = { count: 0, items: ["a", "b"] };
    const spec = render(<Card />, { state });
    expect(spec.state).toEqual(state);
  });

  it("omits state from Spec when not provided", () => {
    const spec = render(<Card />);
    expect(spec.state).toBeUndefined();
  });
});

// =============================================================================
// Error handling
// =============================================================================

describe("error handling", () => {
  it("throws for non-JrxElement input", () => {
    expect(() => render({} as JrxNode)).toThrow(/expects a JrxElement/);
  });

  it("throws when given null", () => {
    expect(() => render(null)).toThrow(/expects a JrxElement/);
  });

  it("throws when given undefined", () => {
    expect(() => render(undefined)).toThrow(/expects a JrxElement/);
  });
});
