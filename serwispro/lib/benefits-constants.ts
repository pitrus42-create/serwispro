export const SERVICE_TYPES = [
  { value: "CCTV", label: "CCTV" },
  { value: "ALARM", label: "Alarm" },
  { value: "BRAMA", label: "Automatyka bramowa" },
  { value: "DOMOFON", label: "Domofon" },
  { value: "SIEC", label: "Sieć LAN/Wi-Fi" },
  { value: "KONSERWACJA", label: "Konserwacja" },
  { value: "AWARIA", label: "Awaria" },
  { value: "MODERNIZACJA", label: "Modernizacja" },
  { value: "INNE", label: "Inne" },
];

export const PACKAGE_TYPES = [
  { value: "MINIMUM", label: "Minimum" },
  { value: "STANDARD", label: "Standard" },
  { value: "PRO", label: "Premium / Pro" },
  { value: "SINGLE_VARIANT", label: "Jeden wariant" },
];

export const CLIENT_TYPES = [
  { value: "STANDARDOWY", label: "Standardowy" },
  { value: "BUDZETOWY", label: "Budżetowy" },
  { value: "PREMIUM", label: "Premium" },
  { value: "PILNY", label: "Pilny" },
];

export interface DefaultBenefitsTemplate {
  name: string;
  packageType: string | null;
  clientType: string | null;
  serviceType: string | null;
  title: string;
  points: string[];
}

export const DEFAULT_BENEFITS_TEMPLATES: DefaultBenefitsTemplate[] = [
  {
    name: "Minimum — Ekonomiczny",
    packageType: "MINIMUM",
    clientType: null,
    serviceType: null,
    title: "Ekonomiczne rozwiązanie spełniające podstawowe założenia systemu.",
    points: [
      "Spełnia podstawowe założenia systemu zabezpieczeń.",
      "Zapewnia codzienne poczucie bezpieczeństwa przy rozsądnym budżecie.",
      "Obejmuje niezbędny sprzęt i podstawową konfigurację.",
      "Pozwala ograniczyć koszt inwestycji.",
      "Może być rozbudowany w przyszłości, jeśli pozwala na to instalacja.",
    ],
  },
  {
    name: "Standard — Rekomendowany",
    packageType: "STANDARD",
    clientType: null,
    serviceType: null,
    title: "Rekomendowany wariant dla większości realizacji — najlepszy balans ceny, jakości i niezawodności.",
    points: [
      "Oparty na sprawdzonym sprzęcie o bardzo dobrym stosunku jakości do ceny.",
      "Zapewnia stabilną pracę systemu w codziennym użytkowaniu.",
      "Obejmuje pełniejszą konfigurację i lepsze dopasowanie do potrzeb klienta.",
      "Daje większy komfort użytkowania niż wariant podstawowy.",
      "Pozwala uzyskać profesjonalny efekt bez wchodzenia w najwyższy budżet.",
    ],
  },
  {
    name: "Premium / Pro",
    packageType: "PRO",
    clientType: null,
    serviceType: null,
    title: "Rozwiązanie dla klientów oczekujących wyższej niezawodności, estetyki i indywidualnego dopasowania systemu.",
    points: [
      "Profesjonalny sprzęt dobrany pod wyższe wymagania.",
      "Konfiguracja dopasowana do sposobu użytkowania obiektu.",
      "Staranny montaż z dbałością o estetykę.",
      "Większe możliwości rozbudowy systemu.",
      "Dodatkowe konsultacje po uruchomieniu.",
      "Priorytetowe ustalenie najbliższego możliwego terminu montażu.",
      "Karta SIM na 12 miesięcy w cenie, jeśli system wymaga łączności GSM/LTE.",
    ],
  },
  {
    name: "Jeden wariant — Rekomendowane rozwiązanie",
    packageType: "SINGLE_VARIANT",
    clientType: null,
    serviceType: null,
    title: "Rozwiązanie przygotowane indywidualnie na podstawie przesłanych informacji.",
    points: [
      "Zakres dobrany do potrzeb wskazanych przez klienta.",
      "Obejmuje sprzęt, montaż i konfigurację zgodnie z ustaleniami.",
      "Zapewnia kompletne uruchomienie systemu.",
      "Pozwala uniknąć wyboru między wariantami, gdy zakres prac jest jasno określony.",
      "Oferta została przygotowana po analizie zapytania i dostępnych informacji.",
    ],
  },
  {
    name: "Klient budżetowy — Minimum",
    packageType: "MINIMUM",
    clientType: "BUDZETOWY",
    serviceType: null,
    title: "Rozwiązanie w rozsądnym budżecie zapewniające podstawowe bezpieczeństwo.",
    points: [
      "Koszt inwestycji ograniczony do niezbędnego minimum.",
      "Zapewnia realne poczucie bezpieczeństwa.",
      "Obejmuje sprzęt i montaż niezbędny do działania systemu.",
      "Bez zbędnych rozszerzeń podnoszących koszt.",
      "Możliwość rozbudowy w przyszłości.",
    ],
  },
  {
    name: "Klient premium — Pro",
    packageType: "PRO",
    clientType: "PREMIUM",
    serviceType: null,
    title: "Rozwiązanie premium z naciskiem na niezawodność, estetykę i indywidualne podejście.",
    points: [
      "Sprzęt najwyższej klasy dobrany pod wymagania obiektu.",
      "Precyzyjna konfiguracja dostosowana do sposobu użytkowania.",
      "Montaż z dbałością o każdy detal i estetykę wykończenia.",
      "Profesjonalne konsultacje na każdym etapie realizacji.",
      "Priorytetowe ustalenie terminu.",
      "Karta SIM na 12 miesięcy w cenie dla systemów wymagających łączności.",
      "Gwarancja profesjonalnego efektu końcowego.",
    ],
  },
  {
    name: "Klient pilny — Realizacja priorytetowa",
    packageType: null,
    clientType: "PILNY",
    serviceType: null,
    title: "Realizacja w możliwie najkrótszym terminie.",
    points: [
      "Najbliższy dostępny termin montażu ustalony po potwierdzeniu.",
      "Priorytetowe przygotowanie materiałów.",
      "Skrócony czas od akceptacji do realizacji.",
      "Stały kontakt w sprawie terminu i postępu prac.",
      "Kompletna realizacja bez zbędnych opóźnień.",
    ],
  },
];
