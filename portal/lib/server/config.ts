export function serverEnv() {
  return {
    kratosPublicUrl: process.env.KRATOS_PUBLIC_URL || 'http://kratos:4433',
    kratosAdminUrl: process.env.KRATOS_ADMIN_URL || 'http://kratos:4434',
    hydraPublicUrl: process.env.HYDRA_PUBLIC_URL || 'http://hydra:4444',
    hydraAdminUrl: process.env.HYDRA_ADMIN_URL || 'http://hydra:4445',
    selfUrl: process.env.SELF_URL || 'http://localhost:3000',
    hydraIssuerUrl: process.env.HYDRA_ISSUER_URL || 'http://localhost:3000',
    discordBotToken: process.env.DISCORD_BOT_TOKEN || '',
    discordGuildId: process.env.DISCORD_GUILD_ID || '',
    adminDiscordRoles: (process.env.ADMIN_DISCORD_ROLES || '').split(',').map((r) => r.trim()).filter(Boolean),
    domainPortal: process.env.DOMAIN_PORTAL || 'id.inft.kr',
  };
}