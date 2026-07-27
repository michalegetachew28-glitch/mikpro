const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ALLOWED_REGIONS = [
  { name: 'Addis Ababa', abbreviation: 'AA' },
  { name: 'Oromia', abbreviation: 'OR' },
  { name: 'Amhara', abbreviation: 'AM' },
  { name: 'Tigray', abbreviation: 'TG' },
  { name: 'Sidama', abbreviation: 'SD' },
  { name: 'South Ethiopia', abbreviation: 'SE' },
  { name: 'Somali', abbreviation: 'SM' },
  { name: 'Afar', abbreviation: 'AF' },
  { name: 'Benishangul-Gumuz', abbreviation: 'BG' },
  { name: 'Gambela', abbreviation: 'GB' },
  { name: 'Harari', abbreviation: 'HR' },
  { name: 'Dire Dawa', abbreviation: 'DR' }
];

function tryParsePlateData(plateNumber) {
  if (!plateNumber) return null;
  
  // Standardize DD to DR in incoming string
  let cleanPlate = plateNumber.trim().replace(/^DD\b/i, 'DR').replace(/\bDD\b/gi, 'DR');
  const parts = cleanPlate.split(/\s+/);
  
  if (parts.length >= 4) {
    const abbrev = parts[0].toUpperCase();
    const regionMatch = ALLOWED_REGIONS.find(r => r.abbreviation === abbrev);
    const code = parseInt(parts[1], 10);
    const amharic = parts[2];
    const number = parts[3];
    
    if (regionMatch && !isNaN(code) && code >= 1 && code <= 5 && /^\d+$/.test(number)) {
      return {
        regionName: regionMatch.name,
        regionAbbreviation: regionMatch.abbreviation,
        regionCode: code,
        amharicLetters: amharic,
        vehicleNumber: number,
        plateNumber: `${regionMatch.abbreviation} ${code} ${amharic} ${number}`
      };
    }
  }
  
  // Custom parsing fallback for plates like 'AA-3-A-12345'
  const dashedParts = cleanPlate.split(/[-/]+/);
  if (dashedParts.length >= 4) {
    const abbrev = dashedParts[0].toUpperCase();
    const regionMatch = ALLOWED_REGIONS.find(r => r.abbreviation === abbrev);
    const code = parseInt(dashedParts[1], 10);
    const amharic = dashedParts[2];
    const number = dashedParts[3];
    
    if (regionMatch && !isNaN(code) && code >= 1 && code <= 5 && /^\d+$/.test(number)) {
      return {
        regionName: regionMatch.name,
        regionAbbreviation: regionMatch.abbreviation,
        regionCode: code,
        amharicLetters: amharic,
        vehicleNumber: number,
        plateNumber: `${regionMatch.abbreviation} ${code} ${amharic} ${number}`
      };
    }
  }

  // Raw fallback if it does not fit standard Ethiopian format cleanly
  return {
    regionName: 'Addis Ababa',
    regionAbbreviation: 'AA',
    regionCode: 1,
    amharicLetters: 'አአ',
    vehicleNumber: cleanPlate.replace(/\D/g, '') || '00000',
    plateNumber: `AA 1 አአ ${cleanPlate.replace(/\D/g, '') || '00000'}`
  };
}

async function main() {
  try {
    console.log('Fetching all registered vehicles...');
    const vehicles = await prisma.vehicle.findMany();
    console.log(`Found ${vehicles.length} vehicles.`);

    let updatedCount = 0;
    for (const vehicle of vehicles) {
      const originalPlate = vehicle.plateNumber;
      const parsed = tryParsePlateData(originalPlate);
      
      if (parsed) {
        await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: {
            regionName: parsed.regionName,
            regionAbbreviation: parsed.regionAbbreviation,
            regionCode: parsed.regionCode,
            amharicLetters: parsed.amharicLetters,
            vehicleNumber: parsed.vehicleNumber,
            plateNumber: parsed.plateNumber
          }
        });
        
        if (originalPlate !== parsed.plateNumber || !vehicle.regionAbbreviation) {
          console.log(`Normalized Vehicle Link ID: ${vehicle.id} | "${originalPlate}" -> "${parsed.plateNumber}"`);
          updatedCount++;
        }
      }
    }

    console.log(`Database normalization complete. Successfully updated/normalized ${updatedCount} vehicles.`);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
