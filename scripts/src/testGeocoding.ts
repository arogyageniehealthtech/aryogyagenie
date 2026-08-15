import { resolveProviderCoordinates } from "../../artifacts/api-server/src/lib/locationService";

async function main() {
  const testAddresses = [
    "Premises No. 99, Lake Town Road, Kolkata 700089",
    "Dum Dum Cantonment, 700028",
    "Salt Lake Sector 5, Kolkata 700091",
    "Baguiati Main Road, 700059",
    "South Dumdum Municipality, Kolkata",
    "Park Street, Kolkata 700016",
    "New Town Action Area 1, 700156",
  ];

  console.log("Testing Unified Geocoding Engine:");
  for (const addr of testAddresses) {
    const res = await resolveProviderCoordinates({ address: addr });
    console.log(`Address: "${addr}" -> (${res.lat.toFixed(4)}, ${res.lng.toFixed(4)})`);
  }
}

main().catch(console.error);
