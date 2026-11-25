import { getPhoto } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const photo = getPhoto(id);
  if (!photo) {
    return new Response("Niet gevonden", { status: 404 });
  }

  const body = new Uint8Array(photo.data).buffer;
  return new Response(body, {
    headers: {
      "Content-Type": photo.contentType,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
