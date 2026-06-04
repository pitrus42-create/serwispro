export interface InquiryAnalysis {
  tags: string[];
  score: "LOW" | "MEDIUM" | "HIGH";
  suggestedOffer: "MINIMUM" | "STANDARD" | "PRO";
  warnings: string[];
}

interface InquiryData {
  serviceType: string;
  aestheticsScale: number | null;
  priorities: string;
  expectedDate: string | null;
  formAnswers: string;
  contactPhone: string | null;
  contactEmail: string | null;
  investmentAddress: string | null;
  investmentCity: string | null;
  _count?: { photos: number };
}

function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

const BUDGET_PRIORITIES = ["NAJNIZSZA_CENA"];
const PREMIUM_PRIORITIES = ["SPRZET", "NIEZAWODNOSC", "ROZBUDOWA"];
const URGENT_RE = /asap|pilne|natychmiast|dzisiaj|jutro|pilny|jak najszybciej/i;
const MODERNIZATION_TYPES = ["AWARIA", "MODERNIZACJA"];
const MODERNIZATION_ANSWERS_RE = /nie wiem|modernizacja|rozbudowa/i;
const EXISTING_RE = /wymienić|rozbudować/i;

export function analyzeInquiry(inquiry: InquiryData): InquiryAnalysis {
  const priorities: string[] = safeJsonParse(inquiry.priorities, []);
  const formAnswers: Record<string, string> = safeJsonParse(inquiry.formAnswers, {});
  const tags: string[] = [];
  const warnings: string[] = [];

  const scale = inquiry.aestheticsScale;

  // Budżetowy system
  if (priorities.some((p) => BUDGET_PRIORITIES.includes(p)) || (scale !== null && scale !== undefined && scale <= 4)) {
    tags.push("Budżetowy system");
  }

  // Klient premium
  if (priorities.some((p) => PREMIUM_PRIORITIES.includes(p)) || (scale !== null && scale !== undefined && scale >= 8)) {
    tags.push("Klient premium");
  }

  // Pilny termin
  if (inquiry.expectedDate && URGENT_RE.test(inquiry.expectedDate)) {
    tags.push("Pilny termin");
    warnings.push("Klient oczekuje szybkiej realizacji");
  }

  // Brakuje zdjęć
  if (inquiry._count !== undefined && inquiry._count.photos === 0) {
    tags.push("Brakuje zdjęć");
    warnings.push("Brak zdjęć obiektu — utrudnia przygotowanie wyceny");
  }

  // Brakuje informacji
  const noContact = !inquiry.contactPhone && !inquiry.contactEmail;
  const noAddress = !inquiry.investmentAddress && !inquiry.investmentCity;
  if (noContact || noAddress) {
    tags.push("Brakuje informacji");
    if (noContact) warnings.push("Brak danych kontaktowych (telefon i email)");
    if (noAddress) warnings.push("Brak adresu inwestycji");
  }

  // Wymaga wizji lokalnej
  const answersStr = JSON.stringify(formAnswers);
  if (MODERNIZATION_ANSWERS_RE.test(answersStr) || MODERNIZATION_TYPES.includes(inquiry.serviceType)) {
    tags.push("Wymaga wizji lokalnej");
  }

  // Nowa instalacja
  const existingSystem: string = formAnswers.existingSystem ?? "";
  if (existingSystem === "Nie, to nowy montaż") {
    tags.push("Nowa instalacja");
  }

  // Modernizacja
  if (EXISTING_RE.test(existingSystem) || inquiry.serviceType === "MODERNIZACJA") {
    tags.push("Modernizacja");
  }

  // Scoring
  const hasPremium = priorities.some((p) => PREMIUM_PRIORITIES.includes(p));
  const hasBudget = priorities.some((p) => BUDGET_PRIORITIES.includes(p));

  let score: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM";
  if (hasPremium && scale !== null && scale !== undefined && scale >= 7) {
    score = "HIGH";
  } else if (hasBudget || (scale !== null && scale !== undefined && scale <= 3)) {
    score = "LOW";
  }

  const suggestedOffer: "MINIMUM" | "STANDARD" | "PRO" =
    score === "HIGH" ? "PRO" : score === "LOW" ? "MINIMUM" : "STANDARD";

  return {
    tags: [...new Set(tags)],
    score,
    suggestedOffer,
    warnings,
  };
}
