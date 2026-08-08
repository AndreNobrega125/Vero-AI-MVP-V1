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
  CRITICO: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  ALERTA:
    "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  OK: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

export function statusStyle(status: string) {
  return STATUS_STYLES[status] ?? "bg-black/5 dark:bg-white/10 border-black/10";
}
