export const STATUS_COLORS = {
  OCZEKUJACE: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-300",
    hex: "#6B7280",
    label: "Oczekujące",
  },
  PRZYJETE: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    border: "border-blue-300",
    hex: "#3B82F6",
    label: "Przyjęte",
  },
  W_TOKU: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    border: "border-amber-300",
    hex: "#F59E0B",
    label: "W toku",
  },
  ZAKONCZONE: {
    bg: "bg-green-100",
    text: "text-green-700",
    border: "border-green-300",
    hex: "#10B981",
    label: "Zakończone",
  },
} as const;

export const PRIORITY_COLORS = {
  NISKI: { bg: "bg-gray-100", text: "text-gray-600", hex: "#9CA3AF", label: "Niski" },
  NORMALNY: { bg: "bg-blue-100", text: "text-blue-600", hex: "#60A5FA", label: "Normalny" },
  WYSOKI: { bg: "bg-orange-100", text: "text-orange-600", hex: "#F97316", label: "Wysoki" },
  KRYTYCZNY: { bg: "bg-red-100", text: "text-red-700", hex: "#EF4444", label: "Krytyczny", pulse: true },
} as const;

export const ORDER_TYPE_CONFIG = {
  AWARIA: { label: "Awaria", icon: "⚡", color: "text-red-600" },
  INSTALACJA: { label: "Instalacja", icon: "🔧", color: "text-blue-600" },
  KONSERWACJA: { label: "Konserwacja", icon: "⚙️", color: "text-amber-600" },
  DEMONTAZ: { label: "Demontaż", icon: "🔩", color: "text-purple-600" },
  OGOLNE: { label: "Ogólne", icon: "📋", color: "text-gray-600" },
  WEWNETRZNE: { label: "Wewnętrzne", icon: "🏢", color: "text-gray-600" },
} as const;

export const ORDER_TYPES = Object.keys(ORDER_TYPE_CONFIG) as (keyof typeof ORDER_TYPE_CONFIG)[];
export const ORDER_STATUSES = Object.keys(STATUS_COLORS) as (keyof typeof STATUS_COLORS)[];
export const ORDER_PRIORITIES = Object.keys(PRIORITY_COLORS) as (keyof typeof PRIORITY_COLORS)[];

export const MAINTENANCE_CYCLE_CONFIG = {
  NONE: { label: "Brak" },
  MONTHLY: { label: "Co miesiąc", months: 1 },
  QUARTERLY: { label: "Co kwartał", months: 3 },
  SEMI_ANNUAL: { label: "Co pół roku", months: 6 },
  ANNUAL: { label: "Co rok", months: 12 },
} as const;
