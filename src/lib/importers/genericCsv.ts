import { GraphBuilder } from '../graph/buildGraph';

export async function processGenericCsv(file: File): Promise<GraphBuilder> {
  const builder = new GraphBuilder();
  const text = await file.text();
  const rows = text.split('\n').map(r => r.split(',').map(c => c.trim()));
  
  if (rows.length < 2) return builder;
  
  const headers = rows[0];
  const data = rows.slice(1);
  
  // Look for potential IDs
  const emailIdx = headers.findIndex(h => h.toLowerCase().includes('email'));
  const phoneIdx = headers.findIndex(h => h.toLowerCase().includes('phone'));
  const nameIdx = headers.findIndex(h => h.toLowerCase().includes('name'));
  const dateIdx = headers.findIndex(h => h.toLowerCase().includes('date') || h.toLowerCase().includes('time'));

  data.forEach((row, i) => {
    if (row.length < headers.length) return;
    
    let nodeId = `csv_row_${i}`;
    let name = `Record ${i}`;
    
    if (emailIdx !== -1 && row[emailIdx]) {
      nodeId = row[emailIdx];
      name = row[emailIdx];
    } else if (nameIdx !== -1 && row[nameIdx]) {
      nodeId = row[nameIdx];
      name = row[nameIdx];
    }
    
    builder.addNode({
      name,
      type: "PERSON",
      description: row.map((val, idx) => `${headers[idx]}: ${val}`).join(' | ')
    });
  });

  return builder;
}
