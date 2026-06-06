/**
 * Compact bright-star catalogue (J2000). Right ascension in hours, declination
 * in degrees, visual magnitude, and a stable id used to wire constellation
 * lines. ~50 of the brightest stars — enough for a convincing real-sky overlay
 * without shipping a full HYG database.
 */
export type CatalogStar = {
  id: string;
  name: string;
  raHours: number;
  decDeg: number;
  mag: number;
};

export const STAR_CATALOG: CatalogStar[] = [
  { id: 'sirius', name: 'Sirius', raHours: 6.752, decDeg: -16.716, mag: -1.46 },
  { id: 'canopus', name: 'Canopus', raHours: 6.399, decDeg: -52.696, mag: -0.74 },
  { id: 'arcturus', name: 'Arcturus', raHours: 14.261, decDeg: 19.182, mag: -0.05 },
  { id: 'vega', name: 'Vega', raHours: 18.615, decDeg: 38.784, mag: 0.03 },
  { id: 'capella', name: 'Capella', raHours: 5.278, decDeg: 45.998, mag: 0.08 },
  { id: 'rigel', name: 'Rigel', raHours: 5.242, decDeg: -8.202, mag: 0.13 },
  { id: 'procyon', name: 'Procyon', raHours: 7.655, decDeg: 5.225, mag: 0.34 },
  { id: 'betelgeuse', name: 'Betelgeuse', raHours: 5.919, decDeg: 7.407, mag: 0.5 },
  { id: 'achernar', name: 'Achernar', raHours: 1.629, decDeg: -57.237, mag: 0.46 },
  { id: 'altair', name: 'Altair', raHours: 19.846, decDeg: 8.868, mag: 0.77 },
  { id: 'aldebaran', name: 'Aldebaran', raHours: 4.599, decDeg: 16.509, mag: 0.85 },
  { id: 'antares', name: 'Antares', raHours: 16.49, decDeg: -26.432, mag: 1.09 },
  { id: 'spica', name: 'Spica', raHours: 13.42, decDeg: -11.161, mag: 0.97 },
  { id: 'pollux', name: 'Pollux', raHours: 7.755, decDeg: 28.026, mag: 1.14 },
  { id: 'fomalhaut', name: 'Fomalhaut', raHours: 22.961, decDeg: -29.622, mag: 1.16 },
  { id: 'deneb', name: 'Deneb', raHours: 20.69, decDeg: 45.28, mag: 1.25 },
  { id: 'regulus', name: 'Regulus', raHours: 10.139, decDeg: 11.967, mag: 1.35 },
  { id: 'adhara', name: 'Adhara', raHours: 6.977, decDeg: -28.972, mag: 1.5 },
  { id: 'castor', name: 'Castor', raHours: 7.577, decDeg: 31.888, mag: 1.57 },
  { id: 'shaula', name: 'Shaula', raHours: 17.56, decDeg: -37.104, mag: 1.62 },
  { id: 'bellatrix', name: 'Bellatrix', raHours: 5.418, decDeg: 6.35, mag: 1.64 },
  { id: 'elnath', name: 'Elnath', raHours: 5.438, decDeg: 28.608, mag: 1.65 },
  { id: 'alnilam', name: 'Alnilam', raHours: 5.604, decDeg: -1.202, mag: 1.69 },
  { id: 'alnitak', name: 'Alnitak', raHours: 5.679, decDeg: -1.943, mag: 1.77 },
  { id: 'mintaka', name: 'Mintaka', raHours: 5.533, decDeg: -0.299, mag: 2.25 },
  { id: 'saiph', name: 'Saiph', raHours: 5.796, decDeg: -9.67, mag: 2.06 },
  { id: 'alioth', name: 'Alioth', raHours: 12.9, decDeg: 55.96, mag: 1.76 },
  { id: 'dubhe', name: 'Dubhe', raHours: 11.062, decDeg: 61.751, mag: 1.79 },
  { id: 'alkaid', name: 'Alkaid', raHours: 13.792, decDeg: 49.313, mag: 1.85 },
  { id: 'merak', name: 'Merak', raHours: 11.031, decDeg: 56.383, mag: 2.37 },
  { id: 'phecda', name: 'Phecda', raHours: 11.897, decDeg: 53.695, mag: 2.44 },
  { id: 'megrez', name: 'Megrez', raHours: 12.257, decDeg: 57.033, mag: 3.31 },
  { id: 'mizar', name: 'Mizar', raHours: 13.399, decDeg: 54.925, mag: 2.23 },
  { id: 'polaris', name: 'Polaris', raHours: 2.53, decDeg: 89.264, mag: 1.98 },
  { id: 'mirfak', name: 'Mirfak', raHours: 3.405, decDeg: 49.861, mag: 1.79 },
  { id: 'algol', name: 'Algol', raHours: 3.136, decDeg: 40.956, mag: 2.12 },
  { id: 'denebola', name: 'Denebola', raHours: 11.818, decDeg: 14.572, mag: 2.11 },
  { id: 'alhena', name: 'Alhena', raHours: 6.629, decDeg: 16.399, mag: 1.93 },
  { id: 'kaus-australis', name: 'Kaus Australis', raHours: 18.403, decDeg: -34.385, mag: 1.85 },
  { id: 'sadr', name: 'Sadr', raHours: 20.371, decDeg: 40.257, mag: 2.23 },
  { id: 'gienah-cyg', name: 'Gienah', raHours: 20.77, decDeg: 33.97, mag: 2.46 },
  { id: 'albireo', name: 'Albireo', raHours: 19.512, decDeg: 27.96, mag: 3.18 },
  { id: 'schedar', name: 'Schedar', raHours: 0.675, decDeg: 56.537, mag: 2.24 },
  { id: 'caph', name: 'Caph', raHours: 0.153, decDeg: 59.15, mag: 2.28 },
  { id: 'gamma-cas', name: 'Gamma Cas', raHours: 0.945, decDeg: 60.717, mag: 2.47 },
  { id: 'ruchbah', name: 'Ruchbah', raHours: 1.43, decDeg: 60.235, mag: 2.68 },
  { id: 'segin', name: 'Segin', raHours: 1.907, decDeg: 63.67, mag: 3.35 },
  { id: 'hadar', name: 'Hadar', raHours: 14.064, decDeg: -60.373, mag: 0.61 },
  { id: 'rigil-kent', name: 'Rigil Kentaurus', raHours: 14.66, decDeg: -60.835, mag: -0.27 },
  { id: 'acrux', name: 'Acrux', raHours: 12.443, decDeg: -63.099, mag: 0.77 },
  { id: 'mimosa', name: 'Mimosa', raHours: 12.795, decDeg: -59.689, mag: 1.25 },
  { id: 'gacrux', name: 'Gacrux', raHours: 12.519, decDeg: -57.113, mag: 1.63 }
];

/** Faint constellation lines, as pairs of catalogue ids. */
export const CONSTELLATION_LINES: Array<[string, string]> = [
  // Orion
  ['betelgeuse', 'alnitak'], ['alnitak', 'alnilam'], ['alnilam', 'mintaka'], ['mintaka', 'bellatrix'],
  ['bellatrix', 'betelgeuse'], ['alnitak', 'saiph'], ['mintaka', 'rigel'], ['saiph', 'rigel'],
  // Big Dipper
  ['dubhe', 'merak'], ['merak', 'phecda'], ['phecda', 'megrez'], ['megrez', 'dubhe'],
  ['megrez', 'alioth'], ['alioth', 'mizar'], ['mizar', 'alkaid'],
  // Cygnus (Northern Cross)
  ['deneb', 'sadr'], ['sadr', 'albireo'], ['gienah-cyg', 'sadr'],
  // Cassiopeia
  ['caph', 'schedar'], ['schedar', 'gamma-cas'], ['gamma-cas', 'ruchbah'], ['ruchbah', 'segin'],
  // Southern Cross
  ['acrux', 'gacrux'], ['mimosa', 'gacrux']
];
