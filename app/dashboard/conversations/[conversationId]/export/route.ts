import { NextResponse, type NextRequest } from "next/server";
import {
  buildConversationTxtExport,
  getConversationExportData
} from "@/lib/conversation-export";
import { getCurrentSession } from "@/lib/session";

type ExportRouteProps = {
  params: {
    conversationId: string;
  };
};

function getDownloadFilename(conversationId: string) {
  const date = new Date().toISOString().slice(0, 10);
  const safeConversationId = conversationId.replace(/[^a-zA-Z0-9-]/g, "");

  return `conversation-${safeConversationId}-${date}.txt`;
}

export async function GET(_request: NextRequest, { params }: ExportRouteProps) {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.redirect(new URL("/staff-login", _request.url));
  }

  if (session.role !== "agent" && session.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", _request.url));
  }

  const data = await getConversationExportData(params.conversationId);

  if (!data) {
    return new NextResponse("Conversation not found.", { status: 404 });
  }

  const body = buildConversationTxtExport(data);
  const filename = getDownloadFilename(params.conversationId);

  return new NextResponse(body, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}
