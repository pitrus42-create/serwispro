import { prisma } from "./prisma";

interface CreateNotificationParams {
  userIds: string[];
  type: string;
  priority?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  title: string;
  message?: string;
  link?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  const { userIds, ...data } = params;
  if (!userIds.length) return;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: data.type,
      priority: data.priority ?? 3,
      title: data.title,
      message: data.message,
      link: data.link,
      relatedEntityType: data.relatedEntityType,
      relatedEntityId: data.relatedEntityId,
    })),
  });
}

export async function notifyAdmins(
  params: Omit<CreateNotificationParams, "userIds">
) {
  const admins = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: "ADMIN" } },
    },
    select: { id: true },
  });
  if (!admins.length) return;
  await createNotification({ ...params, userIds: admins.map((a) => a.id) });
}
