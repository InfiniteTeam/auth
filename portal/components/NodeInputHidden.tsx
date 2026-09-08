'use client';

import { useEffect } from 'react';
import { callWebauthnFunction, NodeInputProps } from '@/lib/ui-helpers';

export function NodeInputHidden({ attributes }: NodeInputProps) {
  useEffect(() => {
    if (attributes.onload) {
      const intervalHandle = callWebauthnFunction(attributes.onload as string);
      return () => {
        window.clearInterval(intervalHandle);
      };
    }
  }, [attributes.onload]);

  return (
    <input type={attributes.type} name={attributes.name} value={attributes.value || 'true'} />
  );
}