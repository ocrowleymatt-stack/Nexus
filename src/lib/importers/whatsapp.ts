import { GraphBuilder } from '../graph/buildGraph';

export async function processWhatsAppExport(file: File): Promise<GraphBuilder> {
  console.log("[WHATSAPP_IMPORTER] Processing file:", file.name);
  const builder = new GraphBuilder();
  const text = await file.text();
  const lines = text.split('\n');
  const maxLines = 5000;
  console.log("[WHATSAPP_IMPORTER] Total lines read:", lines.length);

  // Regex example: [15/02/2021, 14:32:01] John Doe: Hello
  const messageRegex = /^\[?(\d{2}\/\d{2}\/\d{4},\s\d{2}:\d{2}:\d{2})\]?\s(.*?):\s(.*)$/;

  let matchedCount = 0;
  lines.slice(0, maxLines).forEach((line, index) => {
    const match = line.match(messageRegex);
    if (match) {
      matchedCount++;
      const [_, timestamp, sender, content] = match;
      
      const personId = builder.addNode({
        name: sender,
        type: "person",
        group: "WhatsApp Contacts",
        source_ref: {
          source_type: "whatsapp",
          source_file: file.name,
          source_index: index,
          source_confidence: "direct",
          timestamp
        }
      });

      const threadId = builder.addNode({
        name: `WhatsApp Thread: ${file.name.replace('.txt', '')}`,
        type: "message_thread",
        group: "Communications"
      });

      builder.addLink({
        source: personId,
        target: threadId,
        relationship: "MESSAGED",
        timestamp,
        basis: "fact_from_file",
        confidence: "direct"
      });
    }
  });

  return builder;
}
