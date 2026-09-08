local claims = std.extVar('claims');
{
  identity: {
    traits: {
      "email": claims.email,
      "name": {
        "first": if std.objectHas(claims, 'given_name') then claims.given_name else if std.objectHas(claims, 'global_name') then std.split(claims.global_name, ' ')[0] else '',
        "last": if std.objectHas(claims, 'family_name') then claims.family_name else if std.objectHas(claims, 'global_name') && std.length(std.split(claims.global_name, ' ')) > 1 then std.join(' ', std.slice(std.split(claims.global_name, ' '), 1)) else ''
      },
    },
  },
}
