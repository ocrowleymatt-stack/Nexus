import { GraphBuilder } from '../graph/buildGraph';

export async function processBrowserHistory(file: File): Promise<GraphBuilder> {
  const builder = new GraphBuilder();
  const text = await file.text();
  
  try {
    const data = JSON.parse(text);
    const history = data["Browser History"] || data || [];
    
    if (Array.isArray(history)) {
      history.slice(0, 500).forEach((item: any, index: number) => {
        const url = item.url || item.URL || "";
        const title = item.title || item.Title || url.substring(0, 50);
        const time = item.time_usec || item.timestamp || item.Date;
        
        const siteId = builder.addNode({
          name: title,
          type: "app",
          description: url,
          source_ref: {
            source_type: "browser_history",
            source_file: file.name,
            source_index: index,
            source_confidence: "direct",
            timestamp: new Date(time / 1000).toISOString()
          }
        });

        const domain = new URL(url).hostname;
        const domainId = builder.addNode({
          name: domain,
          type: "account",
          group: "Web Domains"
        });

        builder.addLink({
          source: siteId,
          target: domainId,
          relationship: "HOSTED_ON",
          basis: "metadata_inference"
        });
      });
    }
  } catch (e) {
    console.error("Failed to parse browser history", e);
  }

  return builder;
}
