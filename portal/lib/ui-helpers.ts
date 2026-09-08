import {
  UiNode,
  UiNodeAttributes,
  UiNodeInputAttributes,
  UiNodeAnchorAttributes,
  UiNodeImageAttributes,
  UiNodeScriptAttributes,
  UiNodeTextAttributes,
} from '@ory/client';

export type ValueSetter = (
  value: string | number | boolean | undefined
) => Promise<void>;

export type FormDispatcher = (
  e: React.FormEvent<HTMLFormElement> | React.MouseEvent
) => Promise<void>;

export interface NodeInputProps {
  node: UiNode;
  attributes: UiNodeInputAttributes;
  value: unknown;
  disabled: boolean;
  dispatchSubmit: FormDispatcher;
  setValue: ValueSetter;
}

export function isUiNodeInputAttributes(
  attrs: UiNodeAttributes
): attrs is { node_type: 'input' } & UiNodeInputAttributes {
  return attrs.node_type === 'input';
}

export function isUiNodeAnchorAttributes(
  attrs: UiNodeAttributes
): attrs is { node_type: 'a' } & UiNodeAnchorAttributes {
  return attrs.node_type === 'a';
}

export function isUiNodeImageAttributes(
  attrs: UiNodeAttributes
): attrs is { node_type: 'img' } & UiNodeImageAttributes {
  return attrs.node_type === 'img';
}

export function isUiNodeScriptAttributes(
  attrs: UiNodeAttributes
): attrs is { node_type: 'script' } & UiNodeScriptAttributes {
  return attrs.node_type === 'script';
}

export function isUiNodeTextAttributes(
  attrs: UiNodeAttributes
): attrs is { node_type: 'text' } & UiNodeTextAttributes {
  return attrs.node_type === 'text';
}

export function getNodeId(node: UiNode): string {
  const attrs = node.attributes as unknown as Record<string, unknown>;
  if (typeof attrs.name === 'string') return attrs.name;
  if (typeof attrs.id === 'string') return attrs.id;
  return '';
}

export function getNodeLabel(node: UiNode): string {
  return node.meta?.label?.text || getNodeId(node);
}

export function filterNodesByGroups(
  nodes: UiNode[],
  groups?: string[]
): UiNode[] {
  if (!groups) return nodes;
  return nodes.filter(({ group }) => {
    return group === 'default' || groups.includes(group);
  });
}

export function filterNodesByGroup(
  nodes: UiNode[],
  group: string
): UiNode[] {
  return nodes.filter((n) => n.group === group);
}

export const callWebauthnFunction = (functionBody: string) => {
  const run = new Function(functionBody);
  const intervalHandle = window.setInterval(() => {
    if ((window as unknown as Record<string, unknown>).__oryWebAuthnInitialized) {
      run();
      window.clearInterval(intervalHandle);
    }
  }, 100);
  return intervalHandle;
};