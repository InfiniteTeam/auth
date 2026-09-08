import { getNodeLabel, NodeInputProps, translateUiText } from '@/lib/ui-helpers';

export function NodeInputCheckbox({ node, attributes, setValue, disabled }: NodeInputProps) {
  const hasError = node.messages?.some(({ type }) => type === 'error');

  return (
    <div className="ui-checkbox">
      <label>
        <input
          type="checkbox"
          name={attributes.name}
          defaultChecked={attributes.value as boolean}
          onChange={(e) => setValue(e.target.checked)}
          disabled={attributes.disabled || disabled}
        />
        {getNodeLabel(node)}
      </label>
      {hasError && node.messages?.map((msg, k) => (
        <div key={`${msg.id}-${k}`} className="message message-error" data-testid={`ui/message/${msg.id}`}>
          {translateUiText(msg.text)}
        </div>
      ))}
    </div>
  );
}
