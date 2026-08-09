export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Reading = {
  timestamp_s: number;
  height_cm: number;
  status: string;
  color: string;
};

export type ProcessResult = {
  video_id: number;
  filename: string;
  average_height_cm: number;
  status: string;
  color: string;
  readings: Reading[];
};

export type VideoRow = {
  id: number;
  filename: string;
  created_at: string;
  average_height_cm: number;
  status: string;
};

export const STATUS_STYLES: Record<string, string> = {
  CRITICO: "bg-negative/10 text-negative border-negative/30",
  ALERTA: "bg-alert/15 text-[#946200] border-alert/40 dark:text-alert",
  OK: "bg-positive/10 text-positive border-positive/30",
};

export const STATUS_BAR: Record<string, string> = {
  CRITICO: "bg-negative",
  ALERTA: "bg-alert",
  OK: "bg-positive",
};

export function statusStyle(status: string) {
  return STATUS_STYLES[status] ?? "bg-black/5 dark:bg-white/10 border-black/10";
}

export function statusBar(status: string) {
  return STATUS_BAR[status] ?? "bg-muted";
}
