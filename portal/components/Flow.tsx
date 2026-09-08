'use client';

import { useEffect, useState } from 'react';

import {
  getNodeId,
  isUiNodeAnchorAttributes,
  isUiNodeImageAttributes,
  isUiNodeInputAttributes,
  isUiNodeScriptAttributes,
  isUiNodeTextAttributes,
  ValueSetter,
} from '@/lib/ui-helpers';
import { UiNode, UiText } from '@ory/client';
import { Messages } from './Messages';
import { NodeAnchor } from './NodeAnchor';
import { NodeImage } from './NodeImage';
import { NodeInput } from './NodeInput';
import { NodeScript } from './NodeScript';
import { NodeText } from './NodeText';

function emptyValues<T>(): T {
  return {} as T;
}

export type Methods = 'oidc' | 'password' | 'profile' | 'totp' | 'webauthn' | 'passkey' | 'link' | 'lookup_secret' | 'code' | 'saml';

export interface FlowProps {
  flow?: {
    ui: {
      action: string;
      method: string;
      nodes: UiNode[];
      messages?: UiText[];
    };
    return_to?: string;
    refresh?: boolean;
    requested_aal?: string;
    id: string;
  };
  only?: Methods[];
  exclude?: string[];
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  hideGlobalMessages?: boolean;
}

export function Flow({
  flow,
  only,
  exclude,
  onSubmit,
  hideGlobalMessages,
}: FlowProps) {
  const [values, setValues] = useState<Record<string, unknown>>(() => emptyValues());
  const [isLoading, setIsLoading] = useState(false);

  const filterNodes = (): UiNode[] => {
    if (!flow) return [];
    return flow.ui.nodes.filter((node) => {
      const { group } = node;
      if (exclude?.includes(getNodeId(node))) return false;
      if (!only) return true;
      return group === 'default' || only.includes(group as Methods);
    });
  };

  useEffect(() => {
    const nodes = filterNodes();
    const vals: Record<string, unknown> = {};
    nodes.forEach((node) => {
      if (isUiNodeInputAttributes(node.attributes)) {
        if (node.attributes.type === 'button' || node.attributes.type === 'submit') {
          return;
        }
        vals[getNodeId(node)] = node.attributes.value;
      }
    });
    setValues(vals);
  }, [flow?.id]);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement> | React.MouseEvent
  ) => {
    event.stopPropagation();
    event.preventDefault();

    if (isLoading) return;

    const body: Record<string, unknown> = {};

    if (
      event.currentTarget &&
      event.currentTarget instanceof HTMLFormElement
    ) {
      const formData = new FormData(event.currentTarget);
      for (const [key, value] of formData.entries()) {
        body[key] = value;
      }

      const nativeEvent = event.nativeEvent as { submitter?: HTMLInputElement };
      if (nativeEvent.submitter) {
        body[nativeEvent.submitter.name] = nativeEvent.submitter.value;
      }
    }

    setIsLoading(true);
    try {
      await onSubmit({ ...body, ...values });
    } finally {
      setIsLoading(false);
    }
  };

  const setValue = (id: string): ValueSetter => {
    return (value) =>
      new Promise((resolve) => {
        setValues((prev) => ({ ...prev, [id]: value }));
        resolve();
      });
  };

  if (!flow) {
    return (
      <div className="flow-loading" role="status">
        <span className="spinner" />
        인증 정보를 불러오는 중입니다.
      </div>
    );
  }

  const nodes = filterNodes();

  return (
    <form
      className="flow-form"
      action={flow.ui.action}
      method={flow.ui.method}
      onSubmit={handleSubmit}
      aria-busy={isLoading}
    >
      {!hideGlobalMessages && <Messages messages={flow.ui.messages} />}
      {nodes.map((node, k) => {
        const id = getNodeId(node);
        if (isUiNodeImageAttributes(node.attributes)) {
          return <NodeImage key={`${id}-${k}`} node={node} attributes={node.attributes} />;
        }
        if (isUiNodeScriptAttributes(node.attributes)) {
          return <NodeScript key={`${id}-${k}`} attributes={node.attributes as any} />;
        }
        if (isUiNodeTextAttributes(node.attributes)) {
          return <NodeText key={`${id}-${k}`} node={node} attributes={node.attributes as any} />;
        }
        if (isUiNodeAnchorAttributes(node.attributes)) {
          return <NodeAnchor key={`${id}-${k}`} node={node} attributes={node.attributes as any} />;
        }
        if (isUiNodeInputAttributes(node.attributes)) {
          return (
            <NodeInput
              key={`${id}-${k}`}
              node={node}
              attributes={node.attributes}
              value={values[id]}
              disabled={isLoading}
              dispatchSubmit={handleSubmit}
              setValue={setValue(id)}
            />
          );
        }
        return null;
      })}
    </form>
  );
}
