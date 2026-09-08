export function NodeImage({ node, attributes }: { node: any; attributes: any }) {
  return (
    <img
      src={attributes.src}
      alt={node.meta?.label?.text || ''}
      style={{ maxWidth: '100%' }}
    />
  );
}