import { getNodeLabel, isUiNodeInputAttributes, NodeInputProps } from '@/lib/ui-helpers';

export function NodeInputDefault(props: NodeInputProps) {
  const { node, attributes, value = '', setValue, disabled } = props;

  const hasError = node.messages?.some(({ type }) => type === 'error');

  return (
    <div className="ui-text">
      <label className="node-label" htmlFor={attributes.name}>
        {getNodeLabel(node)}
      </label>
      <input
        id={attributes.name}
        type={attributes.type === 'text' || attributes.type === 'password' || attributes.type === 'email' || attributes.type === 'number' ? attributes.type : 'text'}
        name={attributes.name}
        value={(value as string) || ''}
        onChange={(e) => setValue(e.target.value)}
        disabled={attributes.disabled || disabled}
        onClick={attributes.onclick ? () => { const run = new Function(attributes.onclick as string); run(); } : undefined}
        style={{ borderColor: hasError ? 'var(--danger)' : undefined }}
      />
      {node.messages?.map((msg, k) => (
        <div key={`${msg.id}-${k}`} className="message message-info" data-testid={`ui/message/${msg.id}`}>
          {msg.text}
        </div>
      ))}
    </div>
  );
}