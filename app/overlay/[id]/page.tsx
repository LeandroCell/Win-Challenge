import type { Metadata } from "next";
import Overlay from "./overlay";
import "./overlay.css";

export const metadata: Metadata = { title: "Win-Challenge Overlay" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function OverlayPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  return (
    <Overlay
      id={id}
      overlayKey={one(sp.key)}
      view={one(sp.view) === "compact" ? "compact" : "full"}
      accent={one(sp.accent) || "blue"}
      rows={Math.min(20, Math.max(1, Number(one(sp.rows)) || 4))}
    />
  );
}
