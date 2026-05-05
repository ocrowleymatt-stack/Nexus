import { GraphBuilder } from '../graph/buildGraph';
import { getZipJson } from './zipInspector';

export async function processPhotosMetadata(zipFile: File, paths: string[]): Promise<GraphBuilder> {
  const builder = new GraphBuilder();
  const jsonFiles = paths.filter(p => p.endsWith('.json') && !p.includes('metadata.json')); // Generic photos sidecars

  for (let i = 0; i < Math.min(jsonFiles.length, 100); i++) {
    const path = jsonFiles[i];
    const data = await getZipJson(zipFile, path);
    if (data?.title) {
      const photoId = builder.addNode({
        name: data.title,
        type: "file",
        group: "Media",
        description: data.description || "",
        first_seen: data.photoTakenTime?.formatted,
        metadata: {
          geoData: data.geoData,
          geoDataExif: data.geoDataExif
        },
        source_ref: {
          source_type: "photos_metadata",
          source_file: path,
          source_confidence: "direct",
          timestamp: data.photoTakenTime?.formatted
        }
      });

      if (data.geoData?.latitude !== 0) {
        const locId = builder.addNode({
          name: `Coord: ${data.geoData.latitude}, ${data.geoData.longitude}`,
          type: "location",
          group: "Geodata"
        });
        
        builder.addLink({
          source: photoId,
          target: locId,
          relationship: "ATTRIBUTED_LOCATION",
          basis: "fact_from_file",
          timestamp: data.photoTakenTime?.formatted
        });
      }
    }
  }

  return builder;
}
