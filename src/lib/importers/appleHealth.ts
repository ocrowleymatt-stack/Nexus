import { GraphBuilder } from '../graph/buildGraph';

export async function processAppleHealth(file: File): Promise<GraphBuilder> {
  const builder = new GraphBuilder();
  const text = await file.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, "text/xml");
  
  const records = xmlDoc.getElementsByTagName("Record");
  const maxRecords = 5000;
  
  for (let i = 0; i < Math.min(records.length, maxRecords); i++) {
    const record = records[i];
    const type = record.getAttribute("type") || "GenericMetric";
    const value = record.getAttribute("value") || "0";
    const startDate = record.getAttribute("startDate");
    const unit = record.getAttribute("unit") || "";
    
    const metricName = type.replace("HKQuantityTypeIdentifier", "");
    
    const nodeId = builder.addNode({
      name: `${metricName}: ${value} ${unit}`,
      type: "health_metric",
      group: "Apple Health",
      first_seen: startDate || undefined,
      source_ref: {
        source_type: "apple_health",
        source_file: file.name,
        source_index: i,
        source_confidence: "direct",
        timestamp: startDate || undefined
      }
    });

    // Link to an "Apple Health Device" node
    const deviceId = builder.addNode({
      name: "Apple Health Source",
      type: "device",
      group: "Biological Monitoring"
    });

    builder.addLink({
      source: nodeId,
      target: deviceId,
      relationship: "RECORDED_BY",
      timestamp: startDate || undefined,
      basis: "fact_from_file",
      confidence: "direct"
    });
  }

  return builder;
}
