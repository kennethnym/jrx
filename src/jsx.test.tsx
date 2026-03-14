import { describe, it, expect } from "bun:test";
import { render } from "./render";
import { isJrxElement, FRAGMENT } from "./types";
import { jsx, jsxs, Fragment } from "./jsx-runtime";
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
// JSX factory basics (direct function calls — tests the factory itself)
// =============================================================================

describe("jsx factory", () => {
  it("jsx() with string type returns a JrxElement", () => {
    const node = jsx("Card", { title: "Hello" });
    expect(isJrxElement(node)).toBe(true);
    expect(node!.type).toBe("Card");
    expect(node!.props).toEqual({ title: "Hello" });
  });

  it("jsx() with component function resolves typeName", () => {
    const node = jsx(Card, { title: "Hello" });
    expect(isJrxElement(node)).toBe(true);
    expect(node!.type).toBe("Card");
    expect(node!.props).toEqual({ title: "Hello" });
  });

  it("jsxs() returns a JrxElement with children", () => {
    const node = jsxs(Stack, {
      children: [jsx(Text, { content: "A" }), jsx(Text, { content: "B" })],
    });
    expect(isJrxElement(node)).toBe(true);
    expect(node!.children).toHaveLength(2);
  });

  it("Fragment is the FRAGMENT symbol", () => {
    expect(Fragment).toBe(FRAGMENT);
  });

  it("jsx() extracts key from third argument", () => {
    const node = jsx(Card, { title: "Hi" }, "my-key");
    expect(node!.key).toBe("my-key");
    expect(node!.props).toEqual({ title: "Hi" });
  });

  it("jsx() extracts reserved props", () => {
    const vis = { $state: "/show" };
    const on = { press: { action: "submit" } };
    const repeat = { statePath: "/items" };
    const watch = { "/x": { action: "reload" } };

    const node = jsx(Button, {
      label: "Go",
      visible: vis,
      on,
      repeat,
      watch,
    });

    expect(node!.props).toEqual({ label: "Go" });
    expect(node!.visible).toEqual(vis);
    expect(node!.on).toEqual(on);
    expect(node!.repeat).toEqual(repeat);
    expect(node!.watch).toEqual(watch);
  });

  it("jsx() handles null props", () => {
    const node = jsx("Divider", null);
    expect(isJrxElement(node)).toBe(true);
    expect(node!.props).toEqual({});
    expect(node!.children).toEqual([]);
  });

  it("jsx() filters null/boolean children", () => {
    const node = jsxs(Stack, {
      children: [null, jsx(Text, { content: "A" }), false, undefined, true],
    });
    expect(node!.children).toHaveLength(1);
    expect(node!.children[0].type).toBe("Text");
  });
});

// =============================================================================
// Null / undefined component returns
// =============================================================================

describe("null/undefined component returns", () => {
  it("jsx() with a component returning null produces null", () => {
    const NullComponent = (_props: Record<string, unknown>) => null;
    const node = jsx(NullComponent, {});
    expect(node).toBeNull();
    expect(isJrxElement(node)).toBe(false);
  });

  it("jsx() with a component returning undefined produces undefined", () => {
    const UndefinedComponent = (_props: Record<string, unknown>) => undefined;
    const node = jsx(UndefinedComponent, {});
    expect(node).toBeUndefined();
    expect(isJrxElement(node)).toBe(false);
  });

  it("key argument is ignored when component returns null", () => {
    const NullComponent = (_props: Record<string, unknown>) => null;
    const node = jsx(NullComponent, {}, "my-key");
    expect(node).toBeNull();
  });

  it("null-returning component children are filtered out", () => {
    const NullComponent = (_props: Record<string, unknown>) => null;
    const node = jsxs(Stack, {
      children: [jsx(NullComponent, {}), jsx(Text, { content: "A" })],
    });
    expect(node!.children).toHaveLength(1);
    expect(node!.children[0].type).toBe("Text");
  });

  it("undefined-returning component children are filtered out", () => {
    const UndefinedComponent = (_props: Record<string, unknown>) => undefined;
    const node = jsxs(Stack, {
      children: [jsx(Text, { content: "A" }), jsx(UndefinedComponent, {})],
    });
    expect(node!.children).toHaveLength(1);
    expect(node!.children[0].type).toBe("Text");
  });
});

// =============================================================================
// JSX syntax → render() integration
// =============================================================================

describe("JSX syntax → render() integration", () => {
  it("renders a single element", () => {
    const spec = render(<Card title="Hello" />);
    expect(spec.root).toBe("card-1");
    expect(spec.elements["card-1"].type).toBe("Card");
    expect(spec.elements["card-1"].props).toEqual({ title: "Hello" });
  });

  it("renders nested elements", () => {
    const spec = render(
      <Card title="Root">
        <Text content="Child" />
      </Card>,
    );
    expect(Object.keys(spec.elements)).toHaveLength(2);
    expect(spec.elements["card-1"].children).toEqual(["text-1"]);
    expect(spec.elements["text-1"].props).toEqual({ content: "Child" });
  });

  it("renders multiple children", () => {
    const spec = render(
      <Stack>
        <Card title="A" />
        <Card title="B" />
        <Button label="Click" />
      </Stack>,
    );
    expect(spec.elements["stack-1"].children).toEqual([
      "card-1",
      "card-2",
      "button-1",
    ]);
  });

  it("renders deeply nested tree", () => {
    const spec = render(
      <Stack>
        <Card title="Outer">
          <Stack>
            <Text content="Deep" />
          </Stack>
        </Card>
      </Stack>,
    );
    expect(Object.keys(spec.elements)).toHaveLength(4);
    expect(spec.elements["stack-1"].children).toEqual(["card-1"]);
    expect(spec.elements["card-1"].children).toEqual(["stack-2"]);
    expect(spec.elements["stack-2"].children).toEqual(["text-1"]);
  });

  it("handles explicit key prop", () => {
    const spec = render(<Card key="main" title="Hello" />);
    expect(spec.root).toBe("main");
    expect(spec.elements["main"].props).toEqual({ title: "Hello" });
  });

  it("handles fragments as children", () => {
    const spec = render(
      <Stack>
        <>
          <Text content="A" />
          <Text content="B" />
        </>
        <Button label="C" />
      </Stack>,
    );
    expect(spec.elements["stack-1"].children).toEqual([
      "text-1",
      "text-2",
      "button-1",
    ]);
  });

  it("handles visible prop", () => {
    const spec = render(
      <Text content="Conditional" visible={{ $state: "/show" }} />,
    );
    const el = spec.elements[spec.root];
    expect(el.visible).toEqual({ $state: "/show" });
    expect((el.props as Record<string, unknown>).visible).toBeUndefined();
  });

  it("handles on prop", () => {
    const spec = render(
      <Button label="Submit" on={{ press: { action: "submitForm" } }} />,
    );
    const el = spec.elements[spec.root];
    expect(el.on).toEqual({ press: { action: "submitForm" } });
  });

  it("handles repeat prop", () => {
    const spec = render(
      <List repeat={{ statePath: "/items", key: "id" }}>
        <ListItem />
      </List>,
    );
    const el = spec.elements[spec.root];
    expect(el.repeat).toEqual({ statePath: "/items", key: "id" });
  });

  it("handles watch prop", () => {
    const spec = render(
      <Select watch={{ "/country": { action: "loadCities" } }} />,
    );
    const el = spec.elements[spec.root];
    expect(el.watch).toEqual({ "/country": { action: "loadCities" } });
  });

  it("passes state through render options", () => {
    const spec = render(<Card title="Hello" />, { state: { count: 0 } });
    expect(spec.state).toEqual({ count: 0 });
  });

  it("throws on root fragment", () => {
    expect(() =>
      render(
        <>
          <Card />
          <Text />
        </>,
      ),
    ).toThrow(/single root element/);
  });

  it("handles chained actions", () => {
    const spec = render(
      <Button
        label="Multi"
        on={{
          press: [
            { action: "setState", params: { statePath: "/a", value: 1 } },
            { action: "submitForm" },
          ],
        }}
      />,
    );
    const el = spec.elements[spec.root];
    expect(Array.isArray(el.on!.press)).toBe(true);
    expect((el.on!.press as unknown[]).length).toBe(2);
  });

  it("handles complex visibility conditions", () => {
    const spec = render(
      <Text
        content="Complex"
        visible={{
          $or: [
            { $state: "/isAdmin" },
            { $state: "/count", gt: 5 },
          ],
        }}
      />,
    );
    const el = spec.elements[spec.root];
    expect(el.visible).toEqual({
      $or: [
        { $state: "/isAdmin" },
        { $state: "/count", gt: 5 },
      ],
    });
  });

  it("produces a valid Spec structure (all children exist)", () => {
    const spec = render(
      <Stack>
        <Card title="A">
          <Text content="1" />
          <Badge text="tag" />
        </Card>
        <Card title="B">
          <Button label="Click" />
        </Card>
      </Stack>,
    );

    for (const [, el] of Object.entries(spec.elements)) {
      if (el.children) {
        for (const childKey of el.children) {
          expect(
            spec.elements[childKey],
            `Missing element "${childKey}"`,
          ).toBeDefined();
        }
      }
    }

    expect(spec.elements[spec.root]).toBeDefined();
    expect(Object.keys(spec.elements)).toHaveLength(6);
  });
});
