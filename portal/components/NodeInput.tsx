import { NodeInputButton } from './NodeInputButton';
import { NodeInputCheckbox } from './NodeInputCheckbox';
import { NodeInputDefault } from './NodeInputDefault';
import { NodeInputHidden } from './NodeInputHidden';
import { NodeInputSubmit } from './NodeInputSubmit';
import { NodeInputProps } from '@/lib/ui-helpers';

export function NodeInput(props: NodeInputProps) {
  const { attributes } = props;

  switch (attributes.type) {
    case 'hidden':
      return <NodeInputHidden {...props} />;
    case 'checkbox':
      return <NodeInputCheckbox {...props} />;
    case 'button':
      return <NodeInputButton {...props} />;
    case 'submit':
      return <NodeInputSubmit {...props} />;
  }

  return <NodeInputDefault {...props} />;
}