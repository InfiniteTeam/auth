export function NodeAnchor({ node, attributes }: { node: any; attributes: any }) {
  return (
    <a
      className="btn btn-outline"
      href={attributes.href}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        window.location.href = attributes.href;
      }}
    >
      {attributes.title?.text}
    </a>
  );
}