
import { GraphBuilder } from '../graph/buildGraph';
import { getZipJson } from './zipInspector';

export async function processGoogleTakeout(zipFile: File, paths: string[]): Promise<GraphBuilder> {
  console.log("[TAKEOUT_IMPORTER] Processing ZIP paths. Total files:", paths.length);
  const builder = new GraphBuilder();

  // 1. Contacts
  const contactsPath = paths.find(p => p.includes('Contacts/All Contacts/All Contacts.json'));
  console.log("[TAKEOUT_IMPORTER] Checking contacts at:", contactsPath);
  if (contactsPath) {
    const data = await getZipJson(zipFile, contactsPath);
    if (Array.isArray(data)) {
      console.log("[TAKEOUT_IMPORTER] Contacts count:", data.length);
      data.forEach((contact: any, index: number) => {
        const name = contact.displayName || contact.name?.formattedName || "Unknown Contact";
        const contactId = builder.addNode({
          name,
          type: "Person",
          group: "Contacts",
          description: contact.emailAddresses?.map((e: any) => e.value).join(', '),
          source_ref: {
            source_type: "google_takeout",
            source_file: contactsPath,
            source_index: index,
            source_confidence: "direct"
          }
        });
      });
    }
  }

  // 2. My Activity (Simplified map)
  const activityFiles = paths.filter(p => p.includes('My Activity') && p.endsWith('.json')).slice(0, 10);
  for (const actPath of activityFiles) {
    const data = await getZipJson(zipFile, actPath);
    if (Array.isArray(data)) {
      data.slice(0, 100).forEach((item: any, index: number) => {
        const serviceNode = builder.addNode({
          name: item.header || "Google Service",
          type: "Service",
          group: "Activity"
        });
        
        const activityId = builder.addNode({
          name: item.title || "Activity Item",
          type: "Event",
          description: item.titleUrl ? `URL: ${item.titleUrl}` : "",
          source_ref: {
            source_type: "google_takeout",
            source_file: actPath,
            source_index: index,
            source_confidence: "direct",
            timestamp: item.time
          }
        });

        builder.addLink({
          source: activityId,
          target: serviceNode,
          relationship: "PERFORMED_ON"
        });
      });
    }
  }

  // 3. Location History
  const locationPath = paths.find(p => p.includes('Location History.json') || p.includes('Records.json'));
  if (locationPath) {
    const data = await getZipJson(zipFile, locationPath);
    const locations = data?.locations || data || [];
    if (Array.isArray(locations)) {
      locations.slice(0, 50).forEach((loc: any, index: number) => {
        const lat = (loc.latitudeE7 || loc.latitude) / 1e7;
        const lon = (loc.longitudeE7 || loc.longitude) / 1e7;
        
        builder.addNode({
          name: `Location ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          type: "Location",
          group: "Timeline",
          metadata: { lat, lon },
          source_ref: {
            source_type: "google_takeout",
            source_file: locationPath,
            source_index: index,
            source_confidence: "direct",
            timestamp: loc.timestamp || loc.timestampMs
          }
        });
      });
    }
  }

  return builder;
}
