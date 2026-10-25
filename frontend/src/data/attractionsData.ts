export type AttractionCategory = 'all' | 'wonders' | 'asia' | 'europe' | 'modern';

export interface AttractionItem {
  id: string;
  name: string;
  location: string;
  country: string;
  image: string;
  tag: string;
  coordinates: string;
  confidence: number;
  highlight: string;
  category: 'wonders' | 'asia' | 'europe' | 'modern';
}

export const LOGIN_ATTRACTIONS: AttractionItem[] = [
  {
    id: "attr-wat-phra-kaew",
    name: "Wat Phra Kaew (Emerald Buddha)",
    location: "Bangkok",
    country: "Thailand",
    image: "/attraction/Wat_Phra_Kaew.jpg",
    tag: "Royal Heritage",
    coordinates: "13.7516° N, 100.4927° E",
    confidence: 99.8,
    highlight: "Sacred royal temple & gilded chedis in the Grand Palace",
    category: "asia"
  },
  {
    id: "attr-eiffel-tower",
    name: "Eiffel Tower (Tour Eiffel)",
    location: "Paris",
    country: "France",
    image: "/attraction/Eiffel_Tower.jpg",
    tag: "Romantic Landmark",
    coordinates: "48.8584° N, 2.2945° E",
    confidence: 99.7,
    highlight: "Iconic wrought-iron lattice tower on the Champ de Mars",
    category: "europe"
  },
  {
    id: "attr-taj-mahal",
    name: "Taj Mahal",
    location: "Agra, Uttar Pradesh",
    country: "India",
    image: "/attraction/Taj_Mahal.jpg",
    tag: "World Wonder",
    coordinates: "27.1751° N, 78.0421° E",
    confidence: 99.6,
    highlight: "Ivory-white marble mausoleum on the Yamuna riverbank",
    category: "wonders"
  },
  {
    id: "attr-colosseum",
    name: "The Colosseum",
    location: "Rome",
    country: "Italy",
    image: "/attraction/Colosseum.jpg",
    tag: "Ancient Wonder",
    coordinates: "41.8902° N, 12.4922° E",
    confidence: 99.5,
    highlight: "Greatest amphitheatre of the Roman Empire",
    category: "wonders"
  },
  {
    id: "attr-pyramid-giza",
    name: "Great Pyramid of Giza",
    location: "Giza, Cairo",
    country: "Egypt",
    image: "/attraction/Pyramid_of_Giza.jpg",
    tag: "Ancient Wonder",
    coordinates: "29.9792° N, 31.1342° E",
    confidence: 99.9,
    highlight: "Oldest of the Seven Wonders of the Ancient World",
    category: "wonders"
  },
  {
    id: "attr-golden-gate",
    name: "Golden Gate Bridge",
    location: "San Francisco",
    country: "United States",
    image: "/attraction/Golden_Gate_Bridge.jpg",
    tag: "Pacific Icon",
    coordinates: "37.8199° N, 122.4783° W",
    confidence: 99.4,
    highlight: "Famous International Orange suspension bridge",
    category: "modern"
  },
  {
    id: "attr-sydney-opera",
    name: "Sydney Opera House",
    location: "Sydney Harbour",
    country: "Australia",
    image: "/attraction/Sydney_Opera_House.jpg",
    tag: "Harbour Icon",
    coordinates: "33.8568° S, 151.2153° E",
    confidence: 99.3,
    highlight: "Expressionist architectural shells on Bennelong Point",
    category: "modern"
  },
  {
    id: "attr-great-wall",
    name: "Great Wall of China",
    location: "Beijing / Huairou",
    country: "China",
    image: "/attraction/Great_Wall_of_China.jpg",
    tag: "World Wonder",
    coordinates: "40.4319° N, 116.5704° E",
    confidence: 99.6,
    highlight: "Ancient fortification winding along mountain ridges",
    category: "wonders"
  },
  {
    id: "attr-sagrada-familia",
    name: "Basílica de la Sagrada Família",
    location: "Barcelona",
    country: "Spain",
    image: "/attraction/Sagrada_Família.jpg",
    tag: "Gaudí Masterpiece",
    coordinates: "41.4036° N, 2.1744° E",
    confidence: 99.2,
    highlight: "Antoni Gaudí's breathtaking organic Gothic-Art Nouveau basilica",
    category: "europe"
  },
  {
    id: "attr-big-ben",
    name: "Big Ben & Elizabeth Tower",
    location: "London",
    country: "United Kingdom",
    image: "/attraction/Big_Ben.jpg",
    tag: "Historic Sights",
    coordinates: "51.5007° N, 0.1246° W",
    confidence: 99.5,
    highlight: "Iconic Great Clock beside the Palace of Westminster",
    category: "europe"
  },
  {
    id: "attr-marina-bay",
    name: "Marina Bay Sands",
    location: "Marina Bay",
    country: "Singapore",
    image: "/attraction/Marina_Bay.jpg",
    tag: "Futuristic City",
    coordinates: "1.2838° N, 103.8591° E",
    confidence: 99.1,
    highlight: "Three-tower resort with world's largest rooftop infinity pool",
    category: "modern"
  },
  {
    id: "attr-christ-redeemer",
    name: "Christ the Redeemer",
    location: "Rio de Janeiro",
    country: "Brazil",
    image: "/attraction/Christ_the_Redeemer.jpg",
    tag: "New 7 Wonders",
    coordinates: "22.9519° S, 43.2105° W",
    confidence: 99.4,
    highlight: "Art Deco statue atop Corcovado mountain overlooking the bay",
    category: "wonders"
  },
  {
    id: "attr-leaning-pisa",
    name: "Leaning Tower of Pisa",
    location: "Pisa, Tuscany",
    country: "Italy",
    image: "/attraction/Leaning_Tower_of_Pisa.jpg",
    tag: "Architectural Marvel",
    coordinates: "43.7230° N, 10.3966° E",
    confidence: 99.3,
    highlight: "Freestanding bell tower famous for its unintended tilt",
    category: "europe"
  },
  {
    id: "attr-burj-khalifa",
    name: "Burj Khalifa",
    location: "Dubai",
    country: "United Arab Emirates",
    image: "/attraction/Burj_Khalifa.jpg",
    tag: "Modern Wonder",
    coordinates: "25.1972° N, 55.2744° E",
    confidence: 99.7,
    highlight: "World's tallest skyscraper rising 828 meters above the desert",
    category: "modern"
  },
  {
    id: "attr-gyeongbokgung",
    name: "Gyeongbokgung Palace",
    location: "Seoul",
    country: "South Korea",
    image: "/attraction/Gyeongbokgung.jpg",
    tag: "Royal Heritage",
    coordinates: "37.5796° N, 126.9770° E",
    confidence: 99.0,
    highlight: "Grand main royal palace of the Joseon Dynasty",
    category: "asia"
  },
  {
    id: "attr-statue-liberty",
    name: "Statue of Liberty",
    location: "New York Harbor",
    country: "United States",
    image: "/attraction/Statue_of_Liberty.jpg",
    tag: "Symbol of Freedom",
    coordinates: "40.6892° N, 74.0445° W",
    confidence: 99.6,
    highlight: "Colossal neoclassical sculpture on Liberty Island",
    category: "modern"
  },
  {
    id: "attr-parthenon",
    name: "The Parthenon, Acropolis",
    location: "Athens",
    country: "Greece",
    image: "/attraction/Parthenon.jpg",
    tag: "Classical Antiquity",
    coordinates: "37.9715° N, 23.7267° E",
    confidence: 99.5,
    highlight: "Temple dedicated to goddess Athena atop the Acropolis",
    category: "wonders"
  },
  {
    id: "attr-hagia-sophia",
    name: "Hagia Sophia",
    location: "Istanbul",
    country: "Turkey",
    image: "/attraction/Hagia_Sophia.jpg",
    tag: "Byzantine Wonder",
    coordinates: "41.0086° N, 28.9802° E",
    confidence: 99.2,
    highlight: "Ancient architectural masterpiece spanning two empires and faiths",
    category: "wonders"
  },
  {
    id: "attr-petronas-towers",
    name: "Petronas Twin Towers",
    location: "Kuala Lumpur",
    country: "Malaysia",
    image: "/attraction/Petronas_Twin_Towers.jpg",
    tag: "Twin Spires",
    coordinates: "3.1578° N, 101.7123° E",
    confidence: 98.9,
    highlight: "Tallest twin towers in the world joined by a skybridge",
    category: "modern"
  },
  {
    id: "attr-brandenburg-gate",
    name: "Brandenburg Gate",
    location: "Berlin",
    country: "Germany",
    image: "/attraction/Brandenburger_Tor.jpg",
    tag: "Historic Monument",
    coordinates: "52.5163° N, 13.3777° E",
    confidence: 99.1,
    highlight: "18th-century neoclassical triumphal monument",
    category: "europe"
  },
  {
    id: "attr-empire-state",
    name: "Empire State Building",
    location: "New York City",
    country: "United States",
    image: "/attraction/Empire_State.jpg",
    tag: "Art Deco Skyline",
    coordinates: "40.7484° N, 73.9857° W",
    confidence: 99.4,
    highlight: "102-story Art Deco skyscraper in Midtown Manhattan",
    category: "modern"
  },
  {
    id: "attr-forbidden-city",
    name: "The Forbidden City",
    location: "Beijing",
    country: "China",
    image: "/attraction/Forbidden_City.jpg",
    tag: "Imperial Palace",
    coordinates: "39.9163° N, 116.3972° E",
    confidence: 99.3,
    highlight: "Imperial palace complex from the Ming to the Qing dynasty",
    category: "asia"
  },
  {
    id: "attr-tower-bridge",
    name: "Tower Bridge",
    location: "London",
    country: "United Kingdom",
    image: "/attraction/Tower_Bridge.jpg",
    tag: "Victorian Engineering",
    coordinates: "51.5055° N, 0.0754° W",
    confidence: 99.2,
    highlight: "Combined bascule and suspension bridge spanning the River Thames",
    category: "europe"
  },
  {
    id: "attr-st-basils",
    name: "Saint Basil's Cathedral",
    location: "Red Square, Moscow",
    country: "Russia",
    image: "/attraction/Saint_Basil's_Cathedral.jpg",
    tag: "Fairytale Domes",
    coordinates: "55.7525° N, 37.6231° E",
    confidence: 99.4,
    highlight: "Iconic colorful onion-domed cathedral in Red Square",
    category: "europe"
  },
  {
    id: "attr-st-peters",
    name: "St. Peter's Basilica",
    location: "Vatican City",
    country: "Vatican City",
    image: "/attraction/St_Peter's_Basilica.jpg",
    tag: "Renaissance Marvel",
    coordinates: "41.9022° N, 12.4539° E",
    confidence: 99.5,
    highlight: "Grandest cathedral of the Catholic Church designed by Michelangelo & Bernini",
    category: "europe"
  }
];

// Split all 25 landmarks into two balanced columns for Dual-Marquee
export const MARQUEE_COLUMN_ONE = LOGIN_ATTRACTIONS.slice(0, 13);
export const MARQUEE_COLUMN_TWO = LOGIN_ATTRACTIONS.slice(13, 25);
