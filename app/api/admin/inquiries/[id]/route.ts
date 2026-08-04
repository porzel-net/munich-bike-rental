import { NextResponse } from "next/server";

export const runtime = "nodejs";

const response = () => NextResponse.json({ message: "This legacy endpoint is archived. Use booking commands." }, { status: 410 });

export async function POST() { return response(); }
export async function PATCH() { return response(); }
