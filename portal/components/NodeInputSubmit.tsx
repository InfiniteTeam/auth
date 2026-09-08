import { getNodeLabel, NodeInputProps } from '@/lib/ui-helpers';

export function NodeInputSubmit({ node, attributes, disabled }: NodeInputProps) {
  return (
    <button
      type="submit"
      name={attributes.name}
      value={attributes.value || ''}
      disabled={attributes.disabled || disabled}
      className="btn btn-primary"
    >
      {getNodeLabel(node)}
    </button>
  );
}