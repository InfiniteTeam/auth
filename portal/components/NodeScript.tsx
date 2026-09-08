'use client';

import { useEffect } from 'react';

interface ScriptAttrs {
  id: string;
  src: string;
  async: boolean;
  crossorigin: string;
  integrity: string;
  referrerpolicy: string;
  type: string;
}

export function NodeScript({ attributes }: { attributes: ScriptAttrs }) {
  useEffect(() => {
    const script = document.createElement('script');
    script.async = attributes.async;
    script.src = attributes.src;
    if (attributes.crossorigin) script.crossOrigin = attributes.crossorigin;
    if (attributes.integrity) script.integrity = attributes.integrity;
    if (attributes.referrerpolicy) {
      script.referrerPolicy = attributes.referrerpolicy as React.HTMLAttributeReferrerPolicy;
    }
    script.type = attributes.type || 'text/javascript';
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [attributes]);

  return null;
}