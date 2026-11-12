import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AdminOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const now = new Date();
    const currentMonday = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - ((now.getUTCDay() + 6) % 7),
    );
    const firstWeek = new Date(currentMonday - 7 * WEEK_MS);
    const [usage, clients, settings, activeSessions] = await Promise.all([
      this.prisma.$queryRaw<{ week: Date; count: bigint }[]>`
        SELECT date_trunc('week', "issuedAt") AS week, COUNT(*) AS count
        FROM "Session"
        WHERE "issuedAt" >= ${firstWeek}
        GROUP BY 1 ORDER BY 1
      `,
      this.prisma.oidcClient.findMany({
        select: { clientId: true, createdAt: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      this.prisma.platformSetting.findMany({
        select: { key: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      this.prisma.session.count({
        where: { revokedAt: null, expiresAt: { gt: now } },
      }),
    ]);

    const counts = new Map(
      usage.map((row) => [row.week.getTime(), Number(row.count)]),
    );
    const weeks = Array.from({ length: 8 }, (_, index) => {
      const week = new Date(firstWeek.getTime() + index * WEEK_MS);
      return {
        week: week.toISOString(),
        count: counts.get(week.getTime()) ?? 0,
      };
    });
    const changes = [
      ...clients.map((client) => ({
        kind: "client" as const,
        label: client.clientId,
        action:
          client.createdAt.getTime() === client.updatedAt.getTime()
            ? ("created" as const)
            : ("updated" as const),
        at: client.updatedAt.toISOString(),
      })),
      ...settings.map((setting) => ({
        kind: "setting" as const,
        label: setting.key,
        action: "updated" as const,
        at: setting.updatedAt.toISOString(),
      })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 6);

    return { weeks, changes, activeSessions };
  }
}
