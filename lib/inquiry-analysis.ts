export interface InquiryAnalysis {
  tags: string[];
  score: "LOW" | "MEDIUM" | "HIGH";
  suggestedOffer: "MINIMUM" | "STANDARD" | "PRO";
  clientType: "budget" | "standard" | "premium";
  justification: string;
  warnings: string[];
  expressUpcharge: boolean;
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
  budgetRange?: string | null;
  internalNotes?: string | null;
  _count?: { photos: number };
}

function safeJsonParse<T>(str: string, fallback: T): T {
  try { return JSON.parse(str); } catch { return fallback; }
}

const BUDGET_PRIORITIES = ["NAJNIZSZA_CENA"];
const PREMIUM_PRIORITIES = ["SPRZET", "NIEZAWODNOSC", "ROZBUDOWA", "ESTETYKA"];
const URGENT_RE = /asap|pilne|natychmiast|dzisiaj|jutro|pilny|jak najszybciej|ekspres|od ręki|błyskawicznie/i;
const MODERNIZATION_TYPES = ["AWARIA", "MODERNIZACJA"];
const MODERNIZATION_ANSWERS_RE = /nie wiem|modernizacja|rozbudowa/i;
const EXISTING_RE = /wymienić|rozbudować/i;
const BUDGET_TEXT_RE = /tanio|najtaniej|budżetowo|podstawowo|jak najtaniej|minimalny|oszczędnie/i;
const PREMIUM_TEXT_RE = /profesjonalnie|niezawodnie|estetycznie|premium|najlepszy sprzęt|bezawaryjnie|najwyższa jakość|bez kompromisów/i;
const HIGH_BUDGET_RE = /wysoki|duży|bez limitu|nieograniczony|komfortowy/i;
const LOW_BUDGET_RE = /niski|mały|ograniczony|minimalny|skromny/i;

export function analyzeInquiry(inquiry: InquiryData): InquiryAnalysis {
  const priorities: string[] = safeJsonParse(inquiry.priorities, []);
  const formAnswers: Record<string, string> = safeJsonParse(inquiry.formAnswers, {});
  const tags: string[] = [];
  const warnings: string[] = [];

  const scale = inquiry.aestheticsScale;
  const answersStr = JSON.stringify(formAnswers).toLowerCase();
  const notesStr = (inquiry.internalNotes ?? "").toLowerCase();
  const budgetStr = (inquiry.budgetRange ?? "").toLowerCase();
  const expectedDate = (inquiry.expectedDate ?? "").toLowerCase();

  // ── Tagi budżetowe / premium ─────────────────────────────────────────────────

  const isBudgetPriority = priorities.some((p) => BUDGET_PRIORITIES.includes(p));
  const isPremiumPriority = priorities.some((p) => PREMIUM_PRIORITIES.includes(p));
  const isBudgetScale = scale !== null && scale !== undefined && scale <= 4;
  const isPremiumScale = scale !== null && scale !== undefined && scale >= 8;
  const isBudgetText = BUDGET_TEXT_RE.test(answersStr) || BUDGET_TEXT_RE.test(notesStr);
  const isPremiumText = PREMIUM_TEXT_RE.test(answersStr) || PREMIUM_TEXT_RE.test(notesStr);
  const isHighBudget = HIGH_BUDGET_RE.test(budgetStr);
  const isLowBudget = LOW_BUDGET_RE.test(budgetStr);

  const budgetSignals = [isBudgetPriority, isBudgetScale, isBudgetText, isLowBudget].filter(Boolean).length;
  const premiumSignals = [isPremiumPriority, isPremiumScale, isPremiumText, isHighBudget].filter(Boolean).length;

  if (budgetSignals >= 1) tags.push("Budżetowy system");
  if (premiumSignals >= 1) tags.push("Klient premium");

  // ── Pilny termin ──────────────────────────────────────────────────────────────

  const isUrgent = URGENT_RE.test(expectedDate) || URGENT_RE.test(answersStr) ||
    inquiry.serviceType === "AWARIA";

  if (isUrgent) {
    tags.push("Pilny termin");
    warnings.push("Klient oczekuje szybkiej realizacji");
  }

  // ── Dopłata ekspresowa ────────────────────────────────────────────────────────

  const expressUpcharge = isUrgent && budgetSignals === 0;
  if (expressUpcharge) {
    tags.push("Możliwa dopłata ekspresowa");
  }

  // ── Brakuje zdjęć ─────────────────────────────────────────────────────────────

  if (inquiry._count !== undefined && inquiry._count.photos === 0) {
    tags.push("Brakuje zdjęć");
    warnings.push("Brak zdjęć obiektu — utrudnia przygotowanie wyceny");
  }

  // ── Brakuje informacji ────────────────────────────────────────────────────────

  const noContact = !inquiry.contactPhone && !inquiry.contactEmail;
  const noAddress = !inquiry.investmentAddress && !inquiry.investmentCity;
  if (noContact || noAddress) {
    tags.push("Brakuje informacji");
    if (noContact) warnings.push("Brak danych kontaktowych (telefon i email)");
    if (noAddress) warnings.push("Brak adresu inwestycji");
  }

  // ── Wizja lokalna / typ instalacji ───────────────────────────────────────────

  if (MODERNIZATION_ANSWERS_RE.test(answersStr) || MODERNIZATION_TYPES.includes(inquiry.serviceType)) {
    tags.push("Wymaga wizji lokalnej");
  }

  const existingSystem: string = formAnswers.existingSystem ?? "";
  if (existingSystem === "Nie, to nowy montaż") tags.push("Nowa instalacja");
  if (EXISTING_RE.test(existingSystem) || inquiry.serviceType === "MODERNIZACJA") tags.push("Modernizacja");
  if (inquiry.serviceType === "AWARIA") tags.push("Awaria");

  // ── Scoring i typ klienta ─────────────────────────────────────────────────────

  let score: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM";
  if (premiumSignals >= 2 || (isPremiumPriority && (isPremiumScale || isPremiumText))) {
    score = "HIGH";
  } else if (budgetSignals >= 2 || (isBudgetPriority && isBudgetScale)) {
    score = "LOW";
  } else if (premiumSignals >= 1) {
    score = "HIGH";
  } else if (budgetSignals >= 1) {
    score = "LOW";
  }

  const clientType: "budget" | "standard" | "premium" =
    score === "HIGH" ? "premium" : score === "LOW" ? "budget" : "standard";

  if (score === "HIGH") tags.push("Wysoki potencjał");

  const suggestedOffer: "MINIMUM" | "STANDARD" | "PRO" =
    score === "HIGH" ? "PRO" : score === "LOW" ? "MINIMUM" : "STANDARD";

  // ── Uzasadnienie ──────────────────────────────────────────────────────────────

  let justification = "";
  if (clientType === "premium") {
    const reasons: string[] = [];
    if (isPremiumPriority) reasons.push("wybrano priorytet niezawodności lub profesjonalnego sprzętu");
    if (isPremiumScale) reasons.push(`wysoka skala estetyki (${scale}/10)`);
    if (isPremiumText) reasons.push("użyte frazy wskazujące na oczekiwania premium");
    if (isHighBudget) reasons.push("wysoki budżet");
    justification = `Klient premium — ${reasons.join(", ")}. Sugerowany wariant: Standard lub Pro.`;
  } else if (clientType === "budget") {
    const reasons: string[] = [];
    if (isBudgetPriority) reasons.push("najniższa cena jako priorytet");
    if (isBudgetScale) reasons.push(`niska skala estetyki (${scale}/10)`);
    if (isBudgetText) reasons.push("frazy wskazujące na budżetowe oczekiwania");
    if (isLowBudget) reasons.push("ograniczony budżet");
    justification = `Klient budżetowy — ${reasons.join(", ")}. Sugerowany wariant: Minimum lub Standard.`;
  } else {
    justification = "Klient standardowy — brak silnych sygnałów premium lub budżetowych. Sugerowany wariant: Standard.";
  }

  if (isUrgent && expressUpcharge) {
    justification += " Wykryto pilny termin — możliwa dopłata za realizację priorytetową.";
  }

  return {
    tags: [...new Set(tags)],
    score,
    suggestedOffer,
    clientType,
    justification,
    warnings,
    expressUpcharge,
  };
}
