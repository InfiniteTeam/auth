'use client';

import { callWebauthnFunction, NodeInputProps } from '@/lib/ui-helpers';
import { getNodeLabel } from '@/lib/ui-helpers';

export function NodeInputButton({ node, attributes, disabled, dispatchSubmit, setValue }: NodeInputProps) {
  const onClick = (e: React.MouseEvent | React.FormEvent<HTMLFormElement>) => {
    if (attributes.onclick) {
      e.stopPropagation();
      e.preventDefault();
      callWebauthnFunction(attributes.onclick as string);
      return;
    }
    setValue(attributes.value).then(() => dispatchSubmit(e));
  };

  return (
    <button
      type="button"
      name={attributes.name}
      value={attributes.value || ''}
      disabled={attributes.disabled || disabled}
      className="btn btn-primary"
      onClick={onClick}
    >
      {getNodeLabel(node)}
    </button>
  );
}