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
  const id = getNodeId(node);
  const source = node.meta?.label?.text || id;
  const labels: Record<string, string> = {
    email: '이메일',
    identifier: '이메일',
    password: '비밀번호',
    'traits.email': '이메일',
    'traits.name.first': '이름',
    'traits.name.last': '성',
    code: '인증 코드',
  };
  const translations: Record<string, string> = {
    ID: '이메일',
    Email: '이메일',
    'E-Mail': '이메일',
    'First Name': '이름',
    'Last Name': '성',
    Password: '비밀번호',
    'Sign up': '가입하기',
    'Sign in with password': '로그인',
    Continue: '계속',
    Submit: '확인',
    Save: '저장',
  };

  return translations[source] || labels[id] || source;
}

export function translateUiText(text: string): string {
  const exact: Record<string, string> = {
    'The password can not be empty.': '비밀번호를 입력해 주세요.',
    'The provided credentials are invalid, check for spelling mistakes in your password or username, email address, or phone number.': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'An account with the same identifier (email, phone, username, ...) exists already.': '이미 사용 중인 이메일입니다.',
    'The flow expired 0 minutes ago, please try again.': '인증 시간이 만료되었습니다. 다시 시도해 주세요.',
  };

  if (exact[text]) return exact[text];
  if (/property .* is missing/i.test(text)) return '필수 항목을 입력해 주세요.';
  if (/must be a valid email/i.test(text)) return '올바른 이메일 주소를 입력해 주세요.';
  if (/password.*at least/i.test(text)) return '비밀번호 길이 조건을 확인해 주세요.';
  return text;
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
