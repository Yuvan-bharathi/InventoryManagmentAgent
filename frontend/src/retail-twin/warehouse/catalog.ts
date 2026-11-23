import type { Rng } from './random'

/** Manufacturing electronics SKU naming so the inspector card matches actual factory inventory. */
const CATEGORIES = [
  {
    name: 'Active Semiconductor',
    nouns: [
      'Snapdragon 8 Gen 2 AP SoC',
      'PM8350 Power Management IC',
      '5G Sub-6 RF Transceiver',
      'Audio DAC Codec Cirrus',
      'AMOLED Display Driver IC',
      'Haptic Driver Controller',
    ],
  },
  {
    name: 'Memory & Storage',
    nouns: [
      'LPDDR5 8GB Memory IC',
      'LPDDR5 12GB Memory IC',
      'UFS 3.1 128GB Flash Storage',
      'UFS 3.1 256GB Flash Storage',
      'eMMC 5.1 64GB NAND Storage',
      'I2C Serial EEPROM 256Kb',
    ],
  },
  {
    name: 'Display Modules',
    nouns: [
      '6.5in 120Hz AMOLED Display',
      '6.7in QHD+ OLED Display Panel',
      'Capacitive Touch Digitizer Assembly',
      'Polarizing Filter Glass Sheet',
      'COF High-Density Display Flex',
      'OLED OCA Optical Adhesive Film',
    ],
  },
  {
    name: 'Electro-Optics',
    nouns: [
      '50MP OIS Wide Main Camera Module',
      '12MP 120° Ultra-Wide Lens Module',
      '16MP HDR Front Selfie Camera',
      'ToF Laser Autofocus Sensor',
      'Dual-Tone High-CRI LED Flash',
      'IR Ambient Light & Proximity Sensor',
    ],
  },
  {
    name: 'Power & Energy',
    nouns: [
      '5000mAh High-Density Li-ion Battery',
      '4500mAh 65W Fast-Charge Battery Pack',
      'Battery Protection Circuit Module (PCM)',
      '15W Qi Wireless Charging Induction Coil',
      'USB-PD 3.0 Fast Charge Controller',
      'Multilayer Battery Graphite Thermal Wrap',
    ],
  },
  {
    name: 'Mechanical Enclosure',
    nouns: [
      'CNC Aluminium Mid-frame Chassis',
      'Corning Gorilla Glass Victus Cover Glass',
      'Dual Nano SIM Card Metal Tray',
      'CNC Volume & Power Side Button Set',
      'Laser-Etched Glass Back Cover Panel',
      'Acoustic Dust Mesh & Gasket Set',
    ],
  },
  {
    name: 'Printed Circuit Board',
    nouns: [
      '6-layer High-Density Interconnect (HDI) Main PCB',
      'Sub-board Daughter Card Interface PCB',
      'RF Antenna Flexible Printed Circuit (FPC)',
      'Under-Display Fingerprint Sensor FPC',
      'High-Speed Micro-Coaxial RF Cable',
      'Main-to-Subboard Board-to-Board Flex FPC',
    ],
  },
  {
    name: 'SMT Consumables',
    nouns: [
      'Lead-Free Solder Paste SAC305 (500g Jar)',
      'Thermal Gap Pad 3.0W/mK Die-Cut',
      'Capillary Underfill Epoxy Adhesive (30cc)',
      'No-Clean Liquid SMT Rework Flux (1L)',
      'Thermally Conductive Structural Adhesive',
      'Conformal PCB Silicone Moisture Coating',
    ],
  },
  {
    name: 'Passive Components',
    nouns: [
      '0402 SMD Ceramic Capacitor 10uF 6.3V',
      '0201 Precision Chip Resistor 100k 1%',
      'Shielded Power Inductor 2.2uH 3.2A',
      'Ferrite Bead EMI Filter 0603 120R',
      'TVS ESD Protection Diode Array',
      'TCXO 38.4MHz Precision Crystal Oscillator',
    ],
  },
] as const

const BRANDS = [
  'Qualcomm',
  'Samsung Semiconductor',
  'Sony IMX',
  'Murata Electronics',
  'Foxconn Precision',
  'Amphenol Interconnect',
  'TDK Corporation',
  'Corning Glass',
] as const

export interface CatalogEntry {
  /**
   * Real-world identity, when known — a barcode or item code from an imported
   * catalogue. Left undefined for a synthetic entry, which gets a generated
   * `SKU-000001`-style id instead. Never set by `makeCatalogEntry` itself.
   */
  id?: string
  name: string
  category: string
  /** Real retail price, when known. A synthetic entry gets a random one instead. */
  price?: number
}

export function makeCatalogEntry(rng: Rng): CatalogEntry {
  const cat = rng.pick(CATEGORIES)
  return {
    name: `${rng.pick(BRANDS)} ${rng.pick(cat.nouns)}`,
    category: cat.name,
  }
}
