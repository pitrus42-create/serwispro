import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const sendData = async () => {
        try {
          const count = await prisma.notification.count({
            where: { userId, isRead: false },
          });
          const data = `data: ${JSON.stringify({ unreadCount: count })}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          controller.close();
        }
      };

      sendData();
      const interval = setInterval(sendData, 30_000);

      // Cleanup
      const timeout = setTimeout(() => {
        clearInterval(interval);
        controller.close();
      }, 5 * 60 * 1000); // close after 5 min

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
