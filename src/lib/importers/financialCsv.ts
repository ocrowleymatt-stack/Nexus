import { GraphBuilder } from '../graph/buildGraph';

export async function processFinancialCsv(file: File): Promise<GraphBuilder> {
  const builder = new GraphBuilder();
  const text = await file.text();
  const lines = text.split('\n');
  const headers = lines[0].split(',');
  
  // Basic heuristic for Monzo/Starling
  const nameIdx = headers.findIndex(h => h.toLowerCase().includes('name') || h.toLowerCase().includes('description'));
  const amountIdx = headers.findIndex(h => h.toLowerCase().includes('amount'));
  const dateIdx = headers.findIndex(h => h.toLowerCase().includes('date'));
  const typeIdx = headers.findIndex(h => h.toLowerCase().includes('type') || h.toLowerCase().includes('category'));

  lines.slice(1, 500).forEach((line, index) => {
    const cols = line.split(',');
    if (cols.length > Math.max(nameIdx, amountIdx, dateIdx)) {
      const name = cols[nameIdx]?.replace(/"/g, '').trim() || "Unknown Transaction";
      const amount = cols[amountIdx]?.trim();
      const date = cols[dateIdx]?.trim();
      const type = cols[typeIdx]?.trim() || "Transaction";

      const merchantId = builder.addNode({
        name: name,
        type: "account",
        group: "Merchants",
        source_ref: {
          source_type: "financial",
          source_file: file.name,
          source_index: index,
          source_confidence: "direct",
          timestamp: date
        }
      });

      const txId = builder.addNode({
        name: `${type}: ${amount}`,
        type: "transaction",
        group: "Financial Activity",
        description: `Ref: ${name} | Amount: ${amount}`,
        first_seen: date
      });

      builder.addLink({
        source: txId,
        target: merchantId,
        relationship: "PAID_TO",
        timestamp: date,
        basis: "fact_from_file"
      });
    }
  });

  return builder;
}
