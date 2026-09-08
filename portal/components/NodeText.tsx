export function NodeText({ node, attributes }: { node: any; attributes: any }) {
  const content = attributes.text;

  if (content.id === 1050015 && content.context?.secrets) {
    const secrets = (content.context.secrets as Array<{ id: number; text: string }>).map(
      (secret, i) => (
        <div key={i} className="code-box" style={{ marginBottom: '0.25rem' }}>
          <code>{secret.id === 1050014 ? 'Used' : secret.text}</code>
        </div>
      )
    );
    return (
      <div>
        {node.meta?.label?.text && <p className="node-label">{node.meta.label.text}</p>}
        <div>{secrets}</div>
      </div>
    );
  }

  return (
    <div>
      {node.meta?.label?.text && <p className="node-label">{node.meta.label.text}</p>}
      <pre className="code-box" style={{ overflow: 'auto' }}>{content.text}</pre>
    </div>
  );
}