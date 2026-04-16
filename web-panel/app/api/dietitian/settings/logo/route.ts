import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getInternalApiBaseUrl } from "@/lib/server-api";

export const runtime = "nodejs";

const BACKEND = getInternalApiBaseUrl();

export async function POST(req: Request) {
  const token = cookies().get("access_token")?.value;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const incoming = await req.formData();
    const file = incoming.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "file is required" }, { status: 400 });
    }

    // Forward the file to backend
    const form = new FormData();
    form.set("file", file, file.name);

    const res = await fetch(`${BACKEND}/api/dietitian/settings/logo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    const contentType = res.headers.get("content-type") ?? "application/json";
    const body = await res.text();

    return new NextResponse(body, {
      status: res.status,
      headers: { "content-type": contentType }
    });
  } catch (error) {
    console.error("Logo upload proxy error:", error);
    return NextResponse.json(
      { message: "Failed to upload logo" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const token = cookies().get("access_token")?.value;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${BACKEND}/api/dietitian/settings/logo`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const contentType = res.headers.get("content-type") ?? "application/json";
    const body = await res.text();

    return new NextResponse(body, {
      status: res.status,
      headers: { "content-type": contentType }
    });
  } catch (error) {
    console.error("Logo delete proxy error:", error);
    return NextResponse.json(
      { message: "Failed to delete logo" },
      { status: 500 }
    );
  }
}
